import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { GardenElement } from "../GardenElement";
import { turnYaw } from "../Utils/turnYaw";

/** How a {@link Huddle} shelters its members. */
export interface HuddleOptions {
    /** Who they shelter behind (a node, a point, or a function giving one each frame). */
    centre: TransformNode | Vector3 | (() => Vector3);
    /** What they shelter from (likewise). */
    danger: TransformNode | Vector3 | (() => Vector3);
    /** How fast they run there (units/second). Default 3.6. */
    speed?: number;
    /** How far behind the centre the first row is, and the gap to the second. Default 1.6 and 0.7. */
    radius?: number;
    row?: number;
    /** Radians between neighbours in the fan. Default 0.42. */
    spread?: number;
    /** Once settled, how far the danger can move their place before they move again. Default 1.2. */
    settle?: number;
    /** Each time one of them starts moving or settles (to crouch them, say). */
    onChange?: (member: GardenElement, index: number, settled: boolean) => void;
}

/**
 * A group sheltering behind someone from a danger: a family behind a ranger from a bear,
 * visitors behind a guide. They stop what they were doing (their `waiting` is set, which pauses
 * `follow`, `track` and `wander`), run to a fan of places on the far side of `centre` from
 * `danger` (two rows), and turn to watch it; `onChange` says when each settles. If the danger
 * goes round them they move round too. `end()` lets them go back to what they were doing.
 *
 * @example
 * ```ts
 * const huddle = new Huddle(scene, [...document.querySelectorAll<GardenElement>(".visitor")], { centre: guide.mesh, danger: bear.mesh,
 *     onChange: (visitor, i, settled) => visitor.toggleAttribute("crouching", settled) });
 * // ...when it's gone
 * huddle.end();
 * ```
 *
 * @category Characters
 */
export class Huddle {
    private observer: Observer<Scene>;
    private settled: boolean[];

    constructor(private scene: Scene, readonly members: GardenElement[], options: HuddleOptions) {
        let o = { speed: 3.6, radius: 1.6, row: 0.7, spread: 0.42, settle: 1.2, ...options };
        let at = (p: HuddleOptions["centre"]) => p instanceof Vector3 ? () => p : typeof p == "function" ? p : () => p.getAbsolutePosition();
        let centre = at(o.centre), danger = at(o.danger);
        this.settled = members.map(() => false);
        for (let m of members) (<any>m).waiting = true;
        this.observer = scene.onBeforeRenderObservable.add(() => {
            let dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
            let c = centre(), d = danger();
            let away = Math.atan2(c.x - d.x, c.z - d.z);
            members.forEach((m, i) => {
                let mesh = m.getNode();
                if (!mesh) return;
                let a = away + (i - (members.length - 1) / 2) * o.spread;
                let r = o.radius + (i % 2) * o.row;
                let spot = { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r };
                let p = mesh.position;
                let gap = Math.hypot(spot.x - p.x, spot.z - p.z);
                let settled = this.settled[i] ? gap < o.settle : gap < 0.25;
                let yaw: number;
                if (settled) yaw = Math.atan2(d.x - p.x, d.z - p.z);
                else {
                    let step = Math.min(gap, o.speed * dt);
                    p.x += (spot.x - p.x) / gap * step;
                    p.z += (spot.z - p.z) / gap * step;
                    yaw = Math.atan2(spot.x - p.x, spot.z - p.z);
                }
                mesh.rotation.y = turnYaw(mesh.rotation.y, yaw, 5 * Math.PI * dt);
                (<any>mesh).drivingHeading = mesh.rotation.y;
                if (settled != this.settled[i]) {
                    this.settled[i] = settled;
                    o.onChange?.(m, i, settled);
                }
            });
        });
    }

    /** Whether each member has reached its place. */
    get arrived(): boolean[] {
        return [...this.settled];
    }

    /** Lets them go back to what they were doing. */
    end() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
        for (let m of this.members) (<any>m).waiting = false;
    }
}
