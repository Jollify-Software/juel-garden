import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { worldPosition } from "../Utils/worldPosition";

/**
 * Something carried in a hand that stays upright: a staff, a crook, a lamp, a flag. It follows
 * the `hand` bone each frame but keeps standing straight, turned the way `owner` faces;
 * parented to the hand it would tip with every bend of the wrist (and a hand posed in a
 * T-pose when it's attached leaves it lying sideways).
 *
 * `grip` is how far below the prop's own origin the hand holds it: build a staff from its foot
 * (origin at the bottom) and grip it `0.52 * height` up, say. `lift` raises it from the hand
 * (for a gesture: lift it and bring it down hard for a stamp). `offset` moves it in the owner's
 * frame (x right, y up, z ahead).
 *
 * @example
 * ```ts
 * const staff = MeshBuilder.CreateCylinder("staff", { height: 1.9, diameter: 0.04 }, scene);
 * staff.bakeTransformIntoVertices(Matrix.Translation(0, 0.95, 0));
 * new HeldProp(scene, staff, boneNode(model.skeleton, "hand_r"), model.mesh, { grip: 1.0 });
 * ```
 *
 * @category Characters
 */
export class HeldProp {
    grip: number;
    lift = 0;
    offset: Vector3;
    private observer: Observer<Scene>;

    constructor(private scene: Scene, readonly prop: TransformNode, private hand: TransformNode, private owner: TransformNode,
        options: { grip?: number, offset?: Vector3 } = {}) {
        this.grip = options.grip ?? 0;
        this.offset = options.offset ?? Vector3.Zero();
        prop.parent = null;
        prop.rotationQuaternion = null;
        this.observer = scene.onBeforeRenderObservable.add(() => this.place());
    }

    /** Puts it in the hand now (it's also done every frame). */
    place() {
        let at = worldPosition(this.hand);
        let m = this.owner.getWorldMatrix().m;
        let yaw = Math.atan2(m[8], m[10]);
        let o = this.offset;
        this.prop.position.set(
            at.x + o.x * Math.cos(yaw) + o.z * Math.sin(yaw),
            at.y - this.grip + this.lift + o.y,
            at.z - o.x * Math.sin(yaw) + o.z * Math.cos(yaw));
        this.prop.rotation.set(0, yaw, 0);
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
    }
}
