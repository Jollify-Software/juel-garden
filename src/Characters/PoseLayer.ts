import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/** A bone of a skinned model: its linked node (glTF), or the bone itself. */
export function boneNode(skeleton: Skeleton, name: string): TransformNode {
    let bone = skeleton?.bones.find(b => b.name == name);
    return bone ? bone.getTransformNode() ?? <TransformNode><unknown>bone : null;
}

type Turn = { node: TransformNode, by: Vector3 | (() => Vector3) };

/**
 * Changes to a skinned model's bones laid over whatever animation is playing: turn a bone
 * further, scale it, or ease it back to the rig's rest pose. A wave over an idle, a child's
 * proportions from an adult's body, legs spread to sit astride something. Applied every frame
 * after the animations (which key every bone, so nothing builds up from frame to frame), in
 * the order added.
 *
 * `weight` (0 to 1) eases towards `target` at `fade` per second, so a layer fades in and out
 * smoothly: set `target` to 0 or 1. Bones the rig hasn't got are skipped.
 *
 * @example
 * ```ts
 * // A child from an adult rig: a larger head, shorter legs.
 * const child = new PoseLayer(scene, model.skeleton).scale("Head", 1.22).scale("thigh_l", 0.86).scale("thigh_r", 0.86);
 * // Raise the right arm sideways, fading in.
 * const arm = new PoseLayer(scene, model.skeleton, { weight: 0, target: 1 }).turn("upperarm_r", new Vector3(0, 0, -1.9));
 * ```
 *
 * @category Characters
 */
export class PoseLayer {
    weight: number;
    target: number;
    /** How fast `weight` eases to `target` (per second). */
    fade: number;
    private turns: Turn[] = [];
    private scales: { node: TransformNode, by: number }[] = [];
    private rests: { node: TransformNode, rest: Quaternion }[] = [];
    private observer: Observer<Scene>;

    constructor(private scene: Scene, private skeleton: Skeleton, options: { weight?: number, target?: number, fade?: number } = {}) {
        this.weight = options.weight ?? 1;
        this.target = options.target ?? this.weight;
        this.fade = options.fade ?? 6;
        this.observer = scene.onBeforeRenderObservable.add(() => this.apply());
    }

    /**
     * Turns `bone` further by `by` (radians about its own x, y and z; or a function giving
     * that each frame, for something that moves), scaled by the weight.
     */
    turn(bone: string, by: Vector3 | (() => Vector3)): this {
        let node = boneNode(this.skeleton, bone);
        if (node) this.turns.push({ node, by });
        return this;
    }

    /** Scales `bone` (and so everything hanging from it) by `by` at full weight. */
    scale(bone: string, by: number): this {
        let node = boneNode(this.skeleton, bone);
        if (node) this.scales.push({ node, by });
        return this;
    }

    /** Eases the bones whose names match back to the rig's rest pose (an open hand from a fist). */
    rest(bones: string | RegExp): this {
        for (let b of this.skeleton?.bones ?? []) {
            if (typeof bones == "string" ? b.name != bones : !bones.test(b.name)) continue;
            let rest = new Quaternion();
            b.getRestPose().decompose(undefined, rest);
            this.rests.push({ node: b.getTransformNode() ?? <TransformNode><unknown>b, rest });
        }
        return this;
    }

    private apply() {
        let dt = Math.min(this.scene.getEngine().getDeltaTime(), 50) / 1000;
        this.weight += (this.target - this.weight) * Math.min(1, dt * this.fade);
        if (Math.abs(this.target - this.weight) < 1e-3) this.weight = this.target;
        let w = this.weight;
        if (w < 1e-3) return;
        for (let t of this.turns) {
            let v = typeof t.by == "function" ? t.by() : t.by;
            let q = t.node.rotationQuaternion;
            if (q) q.multiplyInPlace(Quaternion.RotationYawPitchRoll(v.y * w, v.x * w, v.z * w));
            else t.node.rotation.addInPlace(v.scale(w));
        }
        for (let s of this.scales)
            s.node.scaling.setAll(1 + (s.by - 1) * w);
        for (let r of this.rests) {
            let q = r.node.rotationQuaternion;
            if (q) Quaternion.SlerpToRef(q, r.rest, w, q);
        }
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.observer = null;
    }
}
