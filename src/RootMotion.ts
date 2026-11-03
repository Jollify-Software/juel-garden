import { Animation } from "@babylonjs/core/Animations/animation";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Bone } from "@babylonjs/core/Bones/bone";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

// Root motion for Babylon 8. The method is ported from Babylon.js 9's RootMotionClip and
// RootMotionController (packages/dev/core/src/Animations/rootMotion.ts, Apache-2.0,
// https://github.com/BabylonJS/Babylon.js): the root's own travel first, else the travel
// deduced from the planted contacts of an in-place cycle; the in-place group is a clone
// with the root's travel taken out of its keys; the motion follows the playback's frame and
// is weighted the way the pose is. Simplified here: straight clips only (no turning), and
// only the travel along the direction of travel is taken out.

/** Where a {@link RootMotionClip}'s travel comes from. */
export type RootMotionSource = "root" | "contact" | "none";

/** Options for {@link RootMotionClip}. */
export interface RootMotionOptions {
    /** The node whose own travel is tried first (the hips). Default: the position-animated node with the most animated nodes under it. */
    rootNode?: TransformNode | Bone;
    /** The nodes that touch the ground, for an in-place clip. Default: the leaf joints that come nearest the ground during the clip. */
    contactNodes?: (TransformNode | Bone)[];
    /** Forces where the travel comes from, instead of the root first and then the contacts. */
    source?: "root" | "contact";
    /** Samples a second of animation is measured at. Default 60. */
    samplesPerSecond?: number;
    /** Travel over a cycle below this share of the character's height is sway, not motion. Default 0.1. */
    minimumTravel?: number;
}

type Channels = { position?: Animation, rotationQuaternion?: Animation, rotation?: Animation, scaling?: Animation };

/** A contact's lowest point may be this share of the character's height above the lowest contact's. */
const ContactHeightBand = 0.1;
/** A contact within this share of the height of its own lowest point is planted. */
const PlantedHeightBand = 0.05;
/** A path whose steps add up to less than this share of its length isn't a straight walk. */
const MinimumStraightness = 0.8;
/** A deduced direction this close to an axis is taken as the axis. */
const SnapAngle = Math.PI / 18;
const Up = Vector3.Up();

const isJoint = (node: any): node is TransformNode => node instanceof TransformNode && !(node instanceof AbstractMesh);
const horizontal = (v: Vector3) => new Vector3(v.x, 0, v.z);

/**
 * The root motion of an animation group: how far one cycle of the clip carries the character,
 * so the character's node can be moved by it while the pose plays in place and the feet stay
 * planted instead of skating. Measured once, without playing the group or changing it:
 *
 * 1. The root node's own travel (the hips, or a root bone), if a cycle ends a meaningful distance
 *    from where it started: {@link source} `"root"`. The {@link inPlace} group is then a clone
 *    with that travel taken out of the root's keys.
 * 2. Otherwise the clip is an in-place cycle (the feet slide back under the body): a planted foot
 *    stays put in the world, so in character space it moves opposite to the character, and what it
 *    gives up the character gains. {@link source} `"contact"`; the group already plays in place, so
 *    {@link inPlace} is the group itself.
 *
 * Measured in the space of `character` (the node a {@link RootMotionController} moves), so a
 * scaled model's stride is in its own units. Straight clips only: a clip that turns the character
 * is measured as the straight line from start to end.
 *
 * @category Core
 */
export class RootMotionClip {
    /** Where the travel came from; `"none"` when the clip neither moves its root nor walks its feet. */
    readonly source: RootMotionSource = "none";
    /** The root node analysed (the hips), or null when the group animates no position. */
    readonly rootNode: TransformNode = null;
    /** The contacts the travel was deduced from (only for `"contact"`). */
    readonly contactNodes: TransformNode[] = [];
    /** The direction of travel in character space (unit length, horizontal). */
    readonly direction = new Vector3(0, 0, 1);
    /** The distance one cycle covers along {@link direction}, in character units. */
    readonly cycleDistance: number = 0;
    /** One cycle's length in seconds at speed 1. */
    readonly duration: number;
    /** The animated hierarchy's height at the first frame, character units. */
    readonly height: number = 0;
    readonly from: number;
    readonly to: number;
    /** The group to play: the clip without the root's travel (or the group itself, for `"contact"` and `"none"`). */
    readonly inPlace: AnimationGroup;

    private channels = new Map<TransformNode, Channels>();
    private samples: number;
    /** Distance along {@link direction} at each sample. */
    private track: Float32Array;

    /** The clip's speed at a speed ratio of 1, character units a second. */
    get speed(): number {
        return this.duration > 0 ? this.cycleDistance / this.duration : 0;
    }

    /** One cycle's travel in character space. */
    get cycleOffset(): Vector3 {
        return this.direction.scale(this.cycleDistance);
    }

    constructor(readonly group: AnimationGroup, readonly character: TransformNode, options: RootMotionOptions = {}) {
        for (let targeted of group.targetedAnimations) {
            let node = resolve(targeted.target);
            let property = targeted.animation.targetProperty as keyof Channels;
            if (!node || !["position", "rotationQuaternion", "rotation", "scaling"].includes(property)) continue;
            let channels = this.channels.get(node) ?? {};
            channels[property] = targeted.animation;
            this.channels.set(node, channels);
        }
        this.from = group.from;
        this.to = group.to;
        let fps = group.targetedAnimations[0]?.animation.framePerSecond || 60;
        this.duration = Math.max(0, (this.to - this.from) / fps);
        this.samples = Math.max(2, Math.ceil(this.duration * (options.samplesPerSecond ?? 60)));
        this.inPlace = group;
        this.track = new Float32Array(this.samples + 1);
        if (!this.channels.size || this.duration <= 0)
            return;

        this.rootNode = options.rootNode ? resolve(options.rootNode) : this.findRoot();
        let base = this.rootNode ?? this.channels.keys().next().value;
        this.height = this.measureHeight(base);
        let minimum = (options.minimumTravel ?? 0.1) * this.height;

        let travel: Vector3[] = null;
        if (options.source != "contact" && this.rootNode && this.channels.get(this.rootNode)?.position)
            travel = this.measureRoot(minimum, options.source == "root");
        if (travel)
            this.source = "root";
        else if (options.source != "root") {
            travel = this.measureContacts(base, options.contactNodes, minimum, options.source == "contact");
            if (travel) this.source = "contact";
        }
        if (!travel)
            return;
        for (let i = 0; i <= this.samples; i++)
            this.track[i] = Vector3.Dot(travel[i], this.direction);
        this.cycleDistance = this.track[this.samples];
        if (this.source == "root")
            this.inPlace = this.buildInPlace();
    }

    /** The distance along {@link direction} reached at `frame`, from the first frame. */
    distanceAt(frame: number): number {
        let range = this.to - this.from;
        if (range <= 0) return 0;
        let exact = Math.min(this.samples, Math.max(0, (frame - this.from) / range * this.samples));
        let i = Math.min(this.samples - 1, Math.floor(exact));
        return this.track[i] + (this.track[i + 1] - this.track[i]) * (exact - i);
    }

    /** Takes the in-place clone away (the source group is never changed). */
    dispose() {
        if (this.inPlace != this.group)
            this.inPlace.dispose();
    }

    private frameAt(sample: number) {
        return this.from + (this.to - this.from) * sample / this.samples;
    }

    /** The position-animated node with the most animated nodes under it. */
    private findRoot(): TransformNode {
        let nodes = [...this.channels.keys()];
        let best: TransformNode = null, bestCount = -1;
        for (let [node, channels] of this.channels) {
            if (!channels.position) continue;
            let count = nodes.filter(other => other != node && other.isDescendantOf(node)).length;
            if (count > bestCount || (count == bestCount && best?.isDescendantOf(node))) {
                best = node;
                bestCount = count;
            }
        }
        return best;
    }

    private localMatrix(node: TransformNode, frame: number, result: Matrix): Matrix {
        let channels = this.channels.get(node);
        let scaling: Vector3 = channels?.scaling ? channels.scaling.evaluate(frame) : node.scaling;
        let position: Vector3 = channels?.position ? channels.position.evaluate(frame) : node.position;
        let rotation: Quaternion = channels?.rotationQuaternion ? channels.rotationQuaternion.evaluate(frame)
            : channels?.rotation ? Quaternion.FromEulerVector(channels.rotation.evaluate(frame))
            : node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation);
        return Matrix.ComposeToRef(scaling, rotation, position, result);
    }

    /** `node`'s matrix in character space at `frame`, from the keys (nothing in the scene is changed). */
    private toCharacter(node: TransformNode, frame: number): Matrix {
        let result = Matrix.Identity(), local = new Matrix();
        for (let current = node; current && current != this.character; current = current.parent as TransformNode) {
            if (current instanceof TransformNode) {
                this.localMatrix(current, frame, local);
                result.multiplyToRef(local, result);
            }
        }
        return result;
    }

    private positionAt(node: TransformNode, frame: number): Vector3 {
        return this.toCharacter(node, frame).getTranslation();
    }

    private measureHeight(base: TransformNode): number {
        let low = Infinity, high = -Infinity;
        for (let node of [base, ...base.getDescendants(false, isJoint) as TransformNode[]]) {
            let y = this.positionAt(node, this.from).y;
            low = Math.min(low, y);
            high = Math.max(high, y);
        }
        return high - low;
    }

    /** The root's travel at each sample, or null when it stays (about) where it starts. */
    private measureRoot(minimum: number, forced: boolean): Vector3[] {
        let start = this.positionAt(this.rootNode, this.from);
        let travel: Vector3[] = [];
        for (let i = 0; i <= this.samples; i++)
            travel.push(horizontal(this.positionAt(this.rootNode, this.frameAt(i)).subtract(start)));
        let end = travel[this.samples];
        if (end.length() < Math.max(minimum, 1e-6) && !forced)
            return null;
        if (end.length() > 1e-6)
            this.direction.copyFrom(end).normalize();
        return travel;
    }

    /**
     * The travel deduced from planted contacts. Each interval takes the contact on the ground whose
     * step is closest to the ground speed of the interval before (a swinging foot sweeps forwards,
     * a planted one moves back at the character's speed), starting from the clip's average step
     * measured with the slowest planted contact; in a run's flight the speed carries on.
     */
    private measureContacts(base: TransformNode, given: (TransformNode | Bone)[], minimum: number, forced: boolean): Vector3[] {
        let contacts = given ? given.map(resolve).filter(n => n)
            : (base.getDescendants(false, isJoint) as TransformNode[]).filter(n => !n.getChildren(isJoint, true).length);
        if (!contacts.length)
            return null;
        let positions = contacts.map(() => [] as Vector3[]);
        let lowest = contacts.map(() => Infinity);
        for (let i = 0; i <= this.samples; i++) {
            let frame = this.frameAt(i);
            contacts.forEach((node, c) => {
                let p = this.positionAt(node, frame);
                positions[c].push(p);
                lowest[c] = Math.min(lowest[c], p.y);
            });
        }
        if (!given) {
            let ground = Math.min(...lowest);
            let keep = lowest.map(l => l <= ground + ContactHeightBand * this.height);
            contacts = contacts.filter((_, c) => keep[c]);
            positions = positions.filter((_, c) => keep[c]);
            lowest = lowest.filter((_, c) => keep[c]);
        }
        let tolerance = PlantedHeightBand * this.height;
        let reference = Vector3.Zero();
        let travelled = Vector3.Zero(), heading = Vector3.Zero(), length = 0;
        let travel: Vector3[] = [];
        let walk = (tracking: boolean) => {
            let previous = reference.clone(), sum = Vector3.Zero(), grounded = 0;
            travelled.setAll(0);
            heading.setAll(0);
            length = 0;
            travel = [Vector3.Zero()];
            for (let i = 1; i <= this.samples; i++) {
                let best = Infinity, chosen = previous.clone();
                for (let c = 0; c < contacts.length; c++) {
                    let before = positions[c][i - 1], after = positions[c][i];
                    if (before.y > lowest[c] + tolerance || after.y > lowest[c] + tolerance) continue;
                    let step = horizontal(before.subtract(after));
                    let score = tracking ? Vector3.DistanceSquared(step, previous) : step.lengthSquared();
                    if (score < best) {
                        best = score;
                        chosen = step;
                    }
                }
                if (best < Infinity) {
                    sum.addInPlace(chosen);
                    grounded++;
                }
                if (tracking)
                    previous = chosen.clone();
                heading.addInPlace(chosen);
                length += chosen.length();
                travelled.addInPlace(chosen);
                travel.push(travelled.clone());
            }
            if (!tracking && grounded > 0)
                reference.copyFrom(sum.scale(1 / grounded));
        };
        walk(false);
        walk(true);
        let straightness = length > 0 ? heading.length() / length : 0;
        if (travelled.lengthSquared() > 0)
            this.direction.copyFrom(travelled).normalize();
        let distance = Vector3.Dot(travelled, this.direction);
        if (!forced && (distance < Math.max(minimum, 1e-6) || straightness < MinimumStraightness))
            return null;
        // An in-place clip is meant to go straight; the deduced direction is an estimate.
        for (let axis of [Vector3.Right(), Vector3.Forward(false)]) {
            let dot = Vector3.Dot(this.direction, axis);
            if (Math.acos(Math.min(1, Math.abs(dot))) < SnapAngle)
                this.direction.copyFrom(axis.scale(Math.sign(dot)));
        }
        this.contactNodes.push(...contacts);
        return travel;
    }

    /** A clone of the group with the root's travel along {@link direction} taken out of its position keys. */
    private buildInPlace(): AnimationGroup {
        let group = this.group.clone(this.group.name, undefined, false);
        group.from = this.from;
        group.to = this.to;
        let root = this.rootNode, parent = root.parent as TransformNode;
        for (let targeted of group.targetedAnimations) {
            if (resolve(targeted.target) != root || targeted.animation.targetProperty != "position") continue;
            let source = targeted.animation;
            let animation = new Animation(source.name + " (in place)", "position", source.framePerSecond,
                Animation.ANIMATIONTYPE_VECTOR3, source.loopMode);
            let keys = source.getKeys().map(key => {
                // The travel at this frame, from character space into the root's parent's space.
                let toParent = parent && parent != this.character ? this.toCharacter(parent, key.frame).invert() : Matrix.Identity();
                let travel = Vector3.TransformNormal(this.direction.scale(this.distanceAt(key.frame)), toParent);
                return { ...key, value: (key.value as Vector3).subtract(travel) };
            });
            animation.setKeys(keys);
            targeted.animation = animation;
        }
        return group;
    }
}

/**
 * Moves a character's node by the root motion of the {@link RootMotionClip}s playing on it, once
 * per frame (after the animations step): each clip's in-place group's frame since the last step,
 * through its loops, forwards or backwards, at its speed ratio, as far as the pose went. Clips
 * playing together are weighted by their groups' weights, as Babylon blends the pose: shares of
 * the total once the weights add up to more than 1.
 *
 * @example
 * ```ts
 * const walk = new RootMotionClip(walkGroup, characterNode);
 * const controller = new RootMotionController(characterNode, [walk]);
 * walk.inPlace.start(true);
 * ```
 *
 * @category Core
 */
export class RootMotionController {
    /** Off: the clips play but the node isn't moved. */
    enabled = true;
    private clips: RootMotionClip[] = [];
    private last = new Map<RootMotionClip, number>();
    private observer: Observer<Scene>;
    private scene: Scene;

    constructor(readonly character: TransformNode, clips: RootMotionClip[] = []) {
        this.scene = character.getScene();
        this.observer = this.scene.onAfterAnimationsObservable.add(() => this.step());
        for (let clip of clips) this.add(clip);
    }

    add(clip: RootMotionClip) {
        if (!this.clips.includes(clip)) this.clips.push(clip);
    }

    remove(clip: RootMotionClip) {
        this.clips = this.clips.filter(c => c != clip);
        this.last.delete(clip);
    }

    /** Forgets where the clips were: the next frame moves nothing (after a jump in playback). */
    reset() {
        this.last.clear();
    }

    /** The motion this frame, in character space (exposed for tests and tools). */
    readonly lastMove = Vector3.Zero();

    private step() {
        let sum = Vector3.Zero(), total = 0;
        for (let clip of this.clips) {
            let group = clip.inPlace;
            if (!group.isPlaying || !group.animatables.length) {
                this.last.delete(clip);
                continue;
            }
            let frame = group.getCurrentFrame();
            let last = this.last.get(clip);
            this.last.set(clip, frame);
            if (last == undefined || clip.source == "none")
                continue;
            let distance = clip.distanceAt(frame) - clip.distanceAt(last);
            let speed = group.speedRatio;
            // Wrapped round a loop since the last frame.
            if (speed > 0 && frame < last - 1e-6) distance += clip.cycleDistance;
            else if (speed < 0 && frame > last + 1e-6) distance -= clip.cycleDistance;
            let weight = group.weight < 0 ? 1 : group.weight;
            sum.addInPlace(clip.direction.scale(distance * weight));
            total += weight;
        }
        this.lastMove.copyFrom(sum.scale(1 / Math.max(1, total)));
        if (!this.enabled || this.lastMove.lengthSquared() == 0)
            return;
        // Character space to the node's parent's space.
        let world = Vector3.TransformNormal(this.lastMove, this.character.getWorldMatrix());
        let parent = this.character.parent;
        let local = parent ? Vector3.TransformNormal(world, parent.getWorldMatrix().clone().invert()) : world;
        this.character.position.addInPlace(local);
    }

    dispose() {
        this.scene.onAfterAnimationsObservable.remove(this.observer);
        this.clips = [];
        this.last.clear();
    }
}

function resolve(target: any): TransformNode {
    if (target instanceof TransformNode) return target;
    if (target instanceof Bone) return target.getTransformNode() ?? null;
    return null;
}
