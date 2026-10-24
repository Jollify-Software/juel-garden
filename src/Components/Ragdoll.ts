import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsConstraintType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Ragdoll, RagdollBoneProperties } from "@babylonjs/core/Physics/v2/ragdoll";
import { customElement } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMeshModel } from "./MeshModel";
import { GardenPhysics } from "./Physics";

/**
 * One group of bones in a `<garden-ragdoll>`: each bone named in `bones`
 * gets a physics box of this size, jointed to the nearest bone above it.
 *
 * Attributes (Babylon's `RagdollBoneProperties`): `bones` (bone names,
 * separated by spaces), `size` (the box's edge, or `width`/`height`/`depth`
 * for each side), `box-offset` (how far along the bone the box's centre is),
 * `bone-offset-axis` (the bone's own axis that runs along it, default
 * `"0 1 0"`), `joint` (`ball` or `hinge`, default hinge), `rotation-axis`
 * (a hinge's axis, `"x y z"` in the bone's space), `min`/`max` (how far the
 * joint turns, radians), `mass`, `restitution`.
 *
 * @category Components
 */
@customElement("garden-ragdoll-bone")
export class GardenRagdollBone extends GardenElement {
    /** It only describes bones; its `<garden-ragdoll>` reads it. */
    updated() {
    }

    /** The properties for each bone it names. */
    properties(): RagdollBoneProperties & { bones: string[], mass?: number, restitution?: number } {
        let num = (name: string) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
        let vec = (name: string) => Vector3Convert.fromString(this.getAttribute(name));
        let joint = this.getAttribute("joint")?.toLowerCase();
        let props: any = {
            bones: (this.getAttribute("bones") ?? "").trim().split(/\s+/).filter(b => b),
            size: num("size"), width: num("width"), height: num("height"), depth: num("depth"),
            boxOffset: num("box-offset"), boneOffsetAxis: vec("bone-offset-axis"),
            rotationAxis: vec("rotation-axis"), min: num("min"), max: num("max"),
            mass: num("mass"), restitution: num("restitution"),
            joint: joint == "ball" ? PhysicsConstraintType.BALL_AND_SOCKET
                : joint == "hinge" ? PhysicsConstraintType.HINGE : undefined,
        };
        for (let key in props)
            if (props[key] === undefined) delete props[key];
        return props;
    }
}

/**
 * A ragdoll for a rigged `<garden-mesh-model>` (needs `<garden-physics>`): the
 * character animates as usual, carrying physics boxes on its bones (so it can
 * be hit), until it goes limp and falls under physics -- knocked down,
 * thrown by an explosion, tripped. Babylon's
 * [Ragdoll](https://doc.babylonjs.com/features/featuresDeepDive/physics/ragdolls),
 * declared: put it inside the model, with a `<garden-ragdoll-bone>` for each
 * group of bones. The skeleton's top bone must be one of them (a Mixamo rig's
 * hips; on a rig with a `root` bone at the feet, a small box for that).
 *
 * Attributes:
 * - `root` -- the name of the node the rig's meshes are placed under in the
 *   file (default: the skinned mesh's parent).
 * - `limp` -- goes limp at once; set it later (or call {@link limp}) to make
 *   it fall then. A ragdoll doesn't get up again.
 *
 * `element.ragdoll` is the Babylon `Ragdoll`; {@link impulse} pushes one of
 * its boxes. Fires `garden-ragdoll` (bubbling) when it goes limp.
 *
 * @example
 * ```html
 * <garden-mesh-model id="guy" src="guy.glb" play="Idle">
 *   <garden-ragdoll>
 *     <garden-ragdoll-bone bones="Hips" size="0.25"></garden-ragdoll-bone>
 *     <garden-ragdoll-bone bones="LeftUpLeg RightUpLeg" width="0.08" height="0.2" depth="0.1" box-offset="0.2" min="-1" max="1"></garden-ragdoll-bone>
 *     <garden-ragdoll-bone bones="Head" size="0.3" box-offset="0.15" rotation-axis="0 0 1" min="-1" max="1"></garden-ragdoll-bone>
 *   </garden-ragdoll>
 * </garden-mesh-model>
 * <button onclick="guy.querySelector('garden-ragdoll').limp()">Fall</button>
 * ```
 *
 * @category Components
 */
@customElement("garden-ragdoll")
export class GardenRagdoll extends GardenElement {
    /** The Babylon ragdoll, once the model has loaded. */
    ragdoll: Ragdoll;

    /** True once it has gone limp. */
    isLimp = false;

    /** `limp` set later makes it fall; anything else builds it again. */
    protected get handlesChanges() {
        return true;
    }

    protected dispose() {
        this.ragdoll?.dispose();
        this.ragdoll = null;
        super.dispose();
    }

    async updated(changed?: Map<PropertyKey, unknown>) {
        if (this.ragdoll) {
            if (changed?.size == 1 && changed.has("limp")) {
                if (this.hasAttribute("limp")) this.limp();
                return;
            }
            this.ragdoll.dispose();
            this.ragdoll = null;
            this.isLimp = false;
        }
        this.beginBuild();
        try {
            await GardenElement.whenDocumentReady();
            let model = this.closest("garden-mesh-model") as GardenMeshModel;
            let physicsEl = GardenPhysics.forElement(this);
            if (!model || !physicsEl) {
                console.warn("<garden-ragdoll> goes inside a <garden-mesh-model>, in a scene with <garden-physics>.");
                return;
            }
            await physicsEl.ready;
            await model.loaded;
            let skeleton = model.skeleton;
            if (!skeleton) {
                console.warn("<garden-ragdoll>: the model has no skeleton.");
                return;
            }
            let root = this.findRoot(model);
            let config = (Array.from(this.querySelectorAll("garden-ragdoll-bone")) as GardenRagdollBone[])
                .map(el => el.properties()).filter(p => p.bones.length);
            // Babylon's ragdoll hangs everything from the skeleton's top bone, and silently does
            // nothing (the boxes fall, the model doesn't) when that bone has no box.
            let top = skeleton.getChildren();
            if (top.length != 1 || !config.some(p => p.bones.includes(top[0].name))) {
                console.warn(top.length == 1
                    ? `<garden-ragdoll>: the skeleton's top bone "${top[0].name}" needs a <garden-ragdoll-bone> (a small one, if it's a root bone at the feet).`
                    : "<garden-ragdoll>: the skeleton has more than one top bone; Babylon's ragdoll needs exactly one.");
                return;
            }
            // Boxes go where the bones are now, so the model's nodes and bones must be up to
            // date with where the element put it (its holder may have moved since they last were).
            model.mesh?.computeWorldMatrix(true);
            for (let node of model.mesh?.getDescendants(false) ?? [])
                (<any>node).computeWorldMatrix?.(true);
            skeleton.computeAbsoluteMatrices(true);
            this.ragdoll = new Ragdoll(skeleton, root, config as any);
            if (this.hasAttribute("limp"))
                this.limp();
        } finally {
            this.endBuild();
        }
    }

    private findRoot(model: GardenMeshModel): Mesh | TransformNode {
        let scene = this.getScene();
        let name = this.getAttribute("root");
        if (name) {
            let node = scene.getTransformNodeByName(name) ?? scene.getMeshByName(name);
            if (node) return node as TransformNode;
            console.warn(`<garden-ragdoll>: no node named "${name}"; using the skinned mesh's parent.`);
        }
        let skinned = scene.meshes.find(m => m.skeleton == model.skeleton);
        return (skinned?.parent as TransformNode) ?? (skinned as Mesh) ?? model.mesh;
    }

    /** Goes limp: physics takes over the bones from the animation. */
    limp() {
        if (!this.ragdoll || this.isLimp) return;
        let model = this.closest("garden-mesh-model") as GardenMeshModel;
        for (let group of model?.animationGroups ?? [])
            group.stop();
        this.getScene()?.stopAnimation(model?.skeleton);
        this.ragdoll.ragdoll();
        this.isLimp = true;
        this.dispatchEvent(new CustomEvent("garden-ragdoll", { bubbles: true }));
    }

    /**
     * Pushes the ragdoll: `impulse` (mass x change in velocity) on the box of `bone` (a bone
     * name, or the index of the box in order, default 0: the first group's first bone).
     */
    impulse(impulse: Vector3 | string, bone: string | number = 0) {
        if (!this.ragdoll) return;
        let v = typeof impulse == "string" ? Vector3Convert.fromString(impulse) : impulse;
        let index = typeof bone == "number" ? bone : (<any>this.ragdoll)._boneNames?.indexOf(bone) ?? -1;
        let body = this.ragdoll.getAggregate(index)?.body;
        body?.applyImpulse(v, body.transformNode.getAbsolutePosition());
    }
}
