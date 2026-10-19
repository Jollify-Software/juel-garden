import { AbstractMesh, Mesh, Observer, Scene, Tools, Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { IBehaviourTarget } from "../IBehaviourTarget";
import { turnYaw } from "../Utils/turnYaw";

/**
 * The state of a `follow` behaviour, on its element as `element.follower`
 * (one per placed sprite in a `<garden-sprite>` group, as `element.followers`).
 *
 * @category Behaviours
 */
export class Follower {
    /** The element being followed. Set it to follow someone else. */
    leader: GardenElement = null;
    /** Horizontal speed moved last frame, units/second. */
    speed = 0;
    /** False to stop following (the mesh stays where it is). */
    enabled = true;
    /** @internal */ _target: IBehaviourTarget;
}

/** Followers by leader, for spacing them apart. */
const flocks = new Map<GardenElement, Set<Follower>>();

/**
 * Follows another element (`follow="#id"`): a dog at a child's heels, a line
 * of visitors behind a guide, animals trailing a caravan. Followers of the
 * same leader keep `follow-spacing` apart, so a group gathers round the
 * leader in a loose ring instead of piling up on one spot. A mesh turns to
 * face the way it is walking.
 *
 * Works against any {@link IBehaviourTarget} (a `GardenMesh`'s mesh, or each
 * sprite of a `<garden-sprite>` group). Add `terrain="#height-map"` to keep
 * it on the ground (see {@link BehaviourTerrain}), or `collisions` to slide
 * along meshes with `collisions`.
 *
 * Attributes:
 * - `follow` -- the leader (a selector; settable later through
 *   `element.follower.leader`).
 * - `follow-distance` -- how close to come, default `2`.
 * - `follow-offset` -- instead, a place relative to the leader, in the
 *   leader's own frame: `"-1.5 0 -1"` is behind and to its left.
 * - `follow-speed` -- top speed, units/second, default `3`.
 * - `follow-spacing` -- how far apart followers of the same leader keep,
 *   default `1.2`.
 * - `follow-turn` (degrees/second, default `360`), `follow-facing-offset`
 *   (degrees, as for `walk`).
 *
 * Pair with `follow-wait` on the leader (see {@link BehaviourWait}) for a
 * guide who waits for stragglers.
 *
 * @example
 * ```html
 * <garden-box id="guide" walk></garden-box>
 * <garden-sphere follow="#guide" follow-distance="2" terrain="#ground"></garden-sphere>
 * <garden-sphere follow="#guide" follow-offset="1.5 0 -1"></garden-sphere>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourFollow(el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
    let selector = el.getAttribute("follow");
    if (!selector)
        return;
    let isMesh = target instanceof AbstractMesh;

    // A GardenMesh re-applies its behaviours whenever an attribute changes: keep one follower.
    if (isMesh)
        (<any>el).follower?._dispose?.();

    let scene = el.getScene();
    let engine = scene.getEngine();
    let num = (name: string, fallback: number) => el.hasAttribute(name) ? Number(el.getAttribute(name)) : fallback;
    let distance = num("follow-distance", 2);
    let offset = Vector3Convert.fromString(el.getAttribute("follow-offset"));
    let maxSpeed = num("follow-speed", 3);
    let spacing = num("follow-spacing", 1.2);
    let turnRate = Tools.ToRadians(num("follow-turn", 360));
    let facingOffset = Tools.ToRadians(num("follow-facing-offset", 0));
    let collisions = isMesh && el.hasAttribute("collisions");

    let follower = new Follower();
    follower._target = target;
    if (isMesh) {
        (<any>el).follower = follower;
    } else {
        ((<any>el).followers ??= []).push(follower);
    }

    let flock: Set<Follower> = null;
    let join = (leader: GardenElement) => {
        flock?.delete(follower);
        flock = null;
        if (!leader) return;
        if (!flocks.has(leader)) flocks.set(leader, new Set());
        flock = flocks.get(leader);
        flock.add(follower);
    };
    let leaderEl: GardenElement = null;
    Object.defineProperty(follower, "leader", {
        get: () => leaderEl,
        set: (value: GardenElement) => { leaderEl = value; join(value); },
    });

    (async () => {
        await GardenElement.whenDocumentReady();
        let [found] = await GardenElement.resolveReady(selector);
        if (!found)
            console.warn(`follow="${selector}" did not match any element.`);
        else if (!follower.leader)
            follower.leader = found;
    })().catch(err => console.error("[follow] failed to resolve", selector, err));

    if (isMesh && collisions) {
        let { min, max } = (<AbstractMesh>target).getHierarchyBoundingVectors(true);
        let size = max.subtract(min);
        (<AbstractMesh>target).ellipsoid = new Vector3(Math.max(size.x, size.z) / 2, size.y / 2, Math.max(size.x, size.z) / 2);
    }

    let velocity = Vector3.Zero();
    let resting = false;
    let heading = target.rotation.y - facingOffset;
    let last = target.position.clone();

    let observer: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        if (!dt) return;
        let pos = target.position;
        let leaderNode = follower.leader?.getNode();
        let wanted = Vector3.Zero();

        if (leaderNode && follower.enabled && !(<any>el).waiting) {
            let leaderPos = leaderNode.getAbsolutePosition();
            let goal: Vector3;
            if (offset) {
                let yaw = (<any>leaderNode).drivingHeading ?? leaderNode.rotation.y;
                let sin = Math.sin(yaw), cos = Math.cos(yaw);
                goal = new Vector3(leaderPos.x + offset.x * cos + offset.z * sin, pos.y, leaderPos.z - offset.x * sin + offset.z * cos);
            } else {
                let away = new Vector3(pos.x - leaderPos.x, 0, pos.z - leaderPos.z);
                let d = away.length();
                goal = d > 1e-3 ? new Vector3(leaderPos.x, pos.y, leaderPos.z).addInPlace(away.scaleInPlace(distance / d)) : pos.clone();
            }
            let toGoal = new Vector3(goal.x - pos.x, 0, goal.z - pos.z);
            let gap = toGoal.length();

            // Keep apart from the rest of the flock.
            let apart = Vector3.Zero(), crowded = false;
            for (let other of flock ?? []) {
                if (other == follower) continue;
                let o = other._target.position;
                let dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz);
                if (d < spacing) {
                    if (d < 1e-3) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }
                    let push = (spacing - d) / spacing * maxSpeed;
                    apart.x += dx / d * push;
                    apart.z += dz / d * push;
                    crowded ||= d < spacing * 0.5;
                }
            }

            // Arrived: stand still until the leader moves off or someone bumps in.
            // Without it, arriving and keeping apart balance at an endless shuffle.
            let slack = offset ? 0 : 0.75;
            if (resting && (gap > slack + 0.6 || crowded))
                resting = false;
            else if (!resting && gap <= slack + 0.15)
                resting = true;

            if (!resting) {
                // Arrive: full speed when far, easing in over the last couple of metres.
                if (gap > 0.15)
                    wanted = toGoal.scaleInPlace(Math.min(maxSpeed, gap * 1.5) / gap);
                wanted.addInPlace(apart);
                let length = wanted.length();
                if (length > maxSpeed) wanted.scaleInPlace(maxSpeed / length);
            }
        }

        let k = Math.min(1, dt * 6);
        velocity.x += (wanted.x - velocity.x) * k;
        velocity.z += (wanted.z - velocity.z) * k;
        if (wanted.lengthSquared() == 0 && velocity.lengthSquared() < 1e-4)
            velocity.setAll(0);

        if (collisions)
            (<Mesh>target).moveWithCollisions(new Vector3(velocity.x * dt, 0, velocity.z * dt));
        else {
            pos.x += velocity.x * dt;
            pos.z += velocity.z * dt;
        }

        if (isMesh && velocity.lengthSquared() > 0.04 && !(<any>el).waiting) {
            heading = turnYaw(heading, Math.atan2(velocity.x, velocity.z), turnRate * dt);
            target.rotation.y = heading + facingOffset;
            (<any>target).drivingHeading = heading;
        }

        follower.speed = Math.hypot(pos.x - last.x, pos.z - last.z) / dt;
        last.copyFrom(pos);
    });

    (<any>follower)._dispose = () => {
        scene.onBeforeRenderObservable.remove(observer);
        flock?.delete(follower);
    };
}
