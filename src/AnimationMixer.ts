import { Animation } from "@babylonjs/core/Animations/animation";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/** Options for {@link AnimationMixer.play}. */
export interface PlayOptions {
    /** Cross-fade time from the current animation, seconds. Default 0.25; 0 cuts. */
    blend?: number;
    /** Loop (the default) or play once. A one-shot returns to the motion animation (or the last looping one) when it ends. */
    loop?: boolean;
    /** Playback speed, 1 = as authored. */
    speed?: number;
}

/** Options for {@link AnimationMixer.setWeights}. */
export interface WeightOptions {
    /** Time to fade from the weights now to the new ones, seconds. Default 0.25; 0 jumps. */
    blend?: number;
    /**
     * The animation the others keep in step with: each runs at the speed that makes it
     * start and end its cycle with this one (a walk and a strafe of different lengths).
     */
    sync?: string;
}

/**
 * Plays a model's named animation groups (a GLB's `Idle`, `Walk`, `Wave`)
 * with cross-fades, and optionally picks idle/walk/run from how fast the
 * model is moving. Owned by {@link GardenMeshModel}; see its `play()` and
 * `anim-*` attributes.
 *
 * Fades by animation-group weights: during a blend both groups run, the new
 * one's weight rising to 1 as the old one's falls to 0.
 *
 * @category Core
 */
export class AnimationMixer {
    /** The playing (or fading-in) animation's name. */
    current: string = null;

    private groups = new Map<string, AnimationGroup>();
    /** Weights on their way somewhere; `keep` leaves a group playing at 0 (a weighted mix), else it stops there. */
    private fades: { group: AnimationGroup, from: number, to: number, t: number, length: number, keep?: boolean }[] = [];
    private observer: Observer<Scene>;
    private oneShot = false;
    /** The one-shot whose end is being announced. */
    private ending: AnimationGroup = null;
    private lastLoop: { name: string, speed: number } = null;

    /** Set by the motion driver: what to return to after a one-shot. */
    motion: (() => { name: string, speed: number }) = null;

    constructor(private scene: Scene, groups: AnimationGroup[], private owner: HTMLElement) {
        for (let group of groups) {
            group.stop();
            group.weight = 0;
            this.groups.set(group.name.toLowerCase(), group);
        }
        this.observer = scene.onBeforeRenderObservable.add(() => this.step());
    }

    /** The animation names, as the file has them. */
    get names(): string[] {
        return [...this.groups.values()].map(g => g.name);
    }

    /** The group called `name` (any case), or null. */
    group(name: string): AnimationGroup {
        return name ? this.groups.get(name.toLowerCase()) ?? null : null;
    }

    /** Adds an animation (a clip cut from another, or retargeted from another file), stopped. A group already there by that name is replaced. */
    add(group: AnimationGroup) {
        let old = this.groups.get(group.name.toLowerCase());
        if (old && old != group)
            this.remove(old);
        group.stop();
        group.weight = 0;
        this.groups.set(group.name.toLowerCase(), group);
    }

    /** Takes an animation out (stopping it), by group or name. */
    remove(group: AnimationGroup | string) {
        let found = typeof group == "string" ? this.group(group) : group;
        if (!found || this.groups.get(found.name.toLowerCase()) != found)
            return;
        found.stop();
        this.groups.delete(found.name.toLowerCase());
        this.fades = this.fades.filter(f => f.group != found);
        if (this.current?.toLowerCase() == found.name.toLowerCase())
            this.current = null;
    }

    /**
     * Plays several animations at once, each at its own weight: a walk blended half and half
     * with a strafe, or idle, walk and run all running with sliders between them. Fades from
     * the weights now to these over `blend` seconds; an animation named here keeps running at
     * weight 0 (so it stays in step), any other one playing fades out and stops. Weights
     * needn't add up to 1: Babylon shares the pose out in proportion.
     */
    setWeights(weights: Record<string, number>, options: WeightOptions = {}) {
        let blend = Math.max(0, options.blend ?? 0.25);
        let named = new Map<AnimationGroup, number>();
        for (let name in weights) {
            let group = this.group(name);
            if (group)
                named.set(group, Math.max(0, Number(weights[name]) || 0));
            else
                console.warn(`No animation "${name}"; this model has: ${this.names.join(", ")}`);
        }
        if (!named.size)
            return;
        let master = this.group(options.sync);
        let heaviest = [...named.entries()].sort((a, b) => b[1] - a[1])[0][0];
        this.current = (master ?? heaviest).name;
        this.oneShot = false;
        this.lastLoop = { name: this.current, speed: 1 };

        this.fades = this.fades.filter(f => !named.has(f.group));
        for (let [group, weight] of named) {
            if (!group.isPlaying) {
                group.onAnimationGroupEndObservable.clear();
                group.start(true, group.speedRatio || 1);
                group.weight = blend > 0 ? 0 : weight;
            }
            if (blend > 0)
                this.fades.push({ group, from: group.weight, to: weight, t: 0, length: blend, keep: true });
            else
                group.weight = weight;
        }
        for (let other of this.groups.values()) {
            if (named.has(other) || !other.isPlaying) continue;
            this.fades = this.fades.filter(f => f.group != other);
            if (blend > 0) this.fades.push({ group: other, from: other.weight, to: 0, t: 0, length: blend });
            else { other.weight = 0; other.stop(); }
        }

        // In step: every animation's frame follows the master's progress through its cycle.
        let root = master && named.has(master) ? master.animatables[0] ?? null : null;
        for (let group of named.keys())
            group.syncAllAnimationsWith(group == master ? null : root);
    }

    /** The weight each playing animation has now, by name. */
    get weights(): Record<string, number> {
        let out: Record<string, number> = {};
        for (let group of this.groups.values())
            if (group.isPlaying) out[group.name] = group.weight;
        return out;
    }

    /** Cross-fades to `name`. Returns false (with a warning) if there is no such animation. */
    play(name: string, options: PlayOptions = {}): boolean {
        let group = this.group(name);
        if (!group) {
            console.warn(`No animation "${name}"; this model has: ${this.names.join(", ")}`);
            return false;
        }
        let loop = options.loop ?? true;
        let speed = options.speed ?? 1;
        let blend = Math.max(0, options.blend ?? 0.25);

        this.oneShot = !loop;
        if (loop)
            this.lastLoop = { name: group.name, speed };

        let same = this.current?.toLowerCase() == group.name.toLowerCase();
        this.current = group.name;
        group.speedRatio = speed;
        // Out of a weighted mix (setWeights): it runs at its own pace again.
        group.syncAllAnimationsWith(null);
        let mixed = this.fades.some(f => f.keep) || [...this.groups.values()].some(g => g != group && g.isPlaying);
        if (same && loop && group.isPlaying && !mixed)
            return true;

        // A looping group still fading out carries on from where it is; a one-shot starts over.
        let wasPlaying = group.isPlaying && loop;
        // Restarted from its own end (a listener of garden-animation-end playing it again):
        // Babylon clears what starts inside its end notification, so start it before the next
        // frame's animations, at the weight it has (no blend through the rest pose).
        let again = this.ending == group;
        group.onAnimationGroupEndObservable.clear();
        let start = () => {
            if (!wasPlaying)
                group.start(loop, speed);
            if (!loop)
                group.onAnimationGroupEndObservable.addOnce(() => this.ended(group));
        };
        if (again)
            this.scene.onBeforeAnimationsObservable.addOnce(() => { if (this.current == group.name) start(); });
        else
            start();
        if (blend == 0) {
            this.fades = [];
            for (let other of this.groups.values())
                if (other != group) { other.weight = 0; other.stop(); }
            group.weight = 1;
        } else {
            // Fade every other playing group out from where it is now, this one in.
            this.fades = this.fades.filter(f => f.group != group);
            for (let other of this.groups.values()) {
                if (other == group || !other.isPlaying) continue;
                this.fades = this.fades.filter(f => f.group != other);
                this.fades.push({ group: other, from: other.weight, to: 0, t: 0, length: blend });
            }
            let from = wasPlaying || again ? group.weight : 0;
            this.fades.push({ group, from, to: 1, t: 0, length: blend });
            group.weight = from;
        }
        return true;
    }

    /** Stops everything (fading out over `blend` seconds). */
    stop(blend = 0.25) {
        this.current = null;
        this.oneShot = false;
        this.lastLoop = null;
        this.fades = [];
        for (let group of this.groups.values()) {
            if (!group.isPlaying) continue;
            if (blend > 0) this.fades.push({ group, from: group.weight, to: 0, t: 0, length: blend });
            else { group.weight = 0; group.stop(); }
        }
    }

    /** Sets the playing animation's speed without restarting it. */
    setSpeed(speed: number) {
        let group = this.group(this.current);
        if (group) group.speedRatio = speed;
        if (this.lastLoop && this.lastLoop.name == this.current) this.lastLoop.speed = speed;
    }

    /** True while a one-shot (loop: false) is playing: the motion driver leaves it alone. */
    get busy(): boolean {
        return this.oneShot;
    }

    private ended(group: AnimationGroup) {
        if (this.current != group.name)
            return;
        this.oneShot = false;
        this.ending = group;
        try {
            this.owner.dispatchEvent(new CustomEvent("garden-animation-end", { bubbles: true, detail: { name: group.name } }));
        } finally {
            this.ending = null;
        }
        // A listener may have started something, even the same one-shot again: leave it playing.
        if (this.oneShot || this.current != group.name)
            return;
        let next = this.motion?.() ?? this.lastLoop;
        if (next)
            this.play(next.name, { speed: next.speed, blend: 0.2 });
        else
            this.current = null;
    }

    private step() {
        if (!this.fades.length)
            return;
        let dt = Math.min(this.scene.getEngine().getDeltaTime(), 50) / 1000;
        for (let fade of this.fades) {
            fade.t = Math.min(fade.length, fade.t + dt);
            let k = fade.length > 0 ? fade.t / fade.length : 1;
            fade.group.weight = fade.from + (fade.to - fade.from) * k;
            if (k >= 1 && fade.to == 0 && !fade.keep)
                fade.group.stop();
        }
        this.fades = this.fades.filter(f => f.t < f.length);
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
    }
}

/**
 * An animation group playing frames `from` to `to` of a skeleton's own bone animations: how a
 * `.babylon` file keeps its moves (one long take, with named ranges), made into something
 * {@link AnimationMixer} can blend. The bones' animations are shared, not copied.
 *
 * @category Core
 */
export function skeletonClip(name: string, skeleton: Skeleton, from: number, to: number): AnimationGroup {
    let group = new AnimationGroup(name, skeleton.getScene());
    for (let bone of skeleton.bones) {
        let animation = bone.animations[0];
        if (!animation) continue;
        // A .babylon rig keys whole matrices: without this, Babylon steps from key to key
        // instead of interpolating (a global switch, but only matrix animations use it).
        if (animation.dataType == Animation.ANIMATIONTYPE_MATRIX)
            Animation.AllowMatricesInterpolation = true;
        group.addTargetedAnimation(animation, bone);
    }
    // Sets the group's range; the keys are only added to if they don't reach from/to.
    return group.normalize(from, to);
}

/** A clip per named range of each skeleton (`.babylon` files'), for a model with no animation groups of its own. */
export function skeletonRangeClips(skeletons: Skeleton[]): AnimationGroup[] {
    let groups: AnimationGroup[] = [];
    for (let skeleton of skeletons)
        for (let range of skeleton.getAnimationRanges())
            if (range) groups.push(skeletonClip(range.name, skeleton, range.from, range.to));
    return groups;
}

/**
 * The motion driver behind `anim-idle`/`anim-walk`/`anim-run`: measures how
 * fast `node` moves (or asks `speedOf`, e.g. a walker's own speed) and plays
 * idle, walk or run, speeding walk and run up or down to match. Smoothed so
 * one jerky frame doesn't flip animations.
 *
 * @category Core
 */
export function driveByMotion(mixer: AnimationMixer, scene: Scene, node: TransformNode, options: {
    idle?: string, walk?: string, run?: string,
    walkSpeed: number, runSpeed: number,
    speedOf?: () => number,
}): Observer<Scene> {
    let last = node.getAbsolutePosition().clone();
    let smoothed = 0;
    let choose = (): { name: string, speed: number } => {
        let v = smoothed;
        if (v < 0.15 || (!options.walk && !options.run))
            return options.idle ? { name: options.idle, speed: 1 } : null;
        let runFrom = (options.walkSpeed + options.runSpeed) / 2;
        let clamp = (k: number) => Math.max(0.5, Math.min(2, k));
        if (options.run && (v >= runFrom || !options.walk))
            return { name: options.run, speed: clamp(v / options.runSpeed) };
        return { name: options.walk, speed: clamp(v / options.walkSpeed) };
    };
    mixer.motion = choose;
    return scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
        if (!dt) return;
        let p = node.getAbsolutePosition();
        let measured = options.speedOf?.() ?? Math.hypot(p.x - last.x, p.z - last.z) / dt;
        last.copyFrom(p);
        smoothed += (measured - smoothed) * Math.min(1, dt * 8);
        if (mixer.busy)
            return;
        let want = choose();
        if (!want)
            return;
        if (want.name.toLowerCase() != mixer.current?.toLowerCase())
            mixer.play(want.name, { speed: want.speed, blend: 0.3 });
        else
            mixer.setSpeed(want.speed);
    });
}
