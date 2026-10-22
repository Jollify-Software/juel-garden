import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { worldPosition } from "../Utils/worldPosition";

/**
 * Keeps a rider's bone on a carrier's bone: a child on someone's shoulders (the child's
 * `pelvis` on the carrier's `neck_01`), a bag on a back, a rider on a horse. Each frame, after
 * the animations have posed both, it moves `node` (the rider, or a node it hangs from) by
 * however far `seat` is from `anchor` plus `offset`, so the seat lands exactly there however
 * either of them moves. Both bones are measured this frame ({@link worldPosition}).
 *
 * `offset` is in the carrier's own frame (x to its right, y up, z ahead), taken from `facing`'s
 * turn about the vertical (default `anchor`'s); `{ x: 0, y: 0.1, z: -0.15 }` sits a little
 * above and behind a neck. The rider's turn is up to you (face it the carrier's way).
 *
 * @example
 * ```ts
 * const seat = new BoneSeat(scene, riderRoot, boneNode(rider.skeleton, "pelvis"), boneNode(carrier.skeleton, "neck_01"),
 *     { offset: new Vector3(0, 0.1, -0.15), facing: carrier.mesh });
 * // ...later
 * seat.dispose();
 * ```
 *
 * @category Characters
 */
export class BoneSeat {
    offset: Vector3;
    private observer: Observer<Scene>;

    constructor(private scene: Scene, private node: TransformNode, private seat: TransformNode, private anchor: TransformNode,
        options: { offset?: Vector3, facing?: TransformNode } = {}) {
        this.offset = options.offset ?? Vector3.Zero();
        let facing = options.facing ?? anchor;
        this.observer = scene.onBeforeRenderObservable.add(() => {
            let m = facing.getWorldMatrix().m;
            let yaw = Math.atan2(m[8], m[10]);
            let o = this.offset;
            // The carrier's right is (cos, -sin), ahead (sin, cos).
            let want = worldPosition(anchor).add(new Vector3(
                o.x * Math.cos(yaw) + o.z * Math.sin(yaw), o.y, -o.x * Math.sin(yaw) + o.z * Math.cos(yaw)));
            let error = want.subtract(worldPosition(seat));
            // Into the node's parent's space, so a turned or scaled parent doesn't matter.
            let parent = node.parent as TransformNode;
            if (parent) {
                let inverse = parent.getWorldMatrix().clone().invert();
                error = Vector3.TransformNormal(error, inverse);
            }
            node.position.addInPlace(error);
        });
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
    }
}
