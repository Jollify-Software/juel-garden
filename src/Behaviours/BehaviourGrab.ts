import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsMotionType, PhysicsPrestepType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { SixDofDragBehavior } from "@babylonjs/core/Behaviors/Meshes/sixDofDragBehavior";
import { MultiPointerScaleBehavior } from "@babylonjs/core/Behaviors/Meshes/multiPointerScaleBehavior";
import { BoundingBoxGizmo } from "@babylonjs/core/Gizmos/boundingBoxGizmo";
import { UtilityLayerRenderer } from "@babylonjs/core/Rendering/utilityLayerRenderer";
import { GardenElement } from "../GardenElement";

/**
 * "Pick it up and look at it": a mesh (or a model) you can grab and move in all
 * six directions -- drag it about and, with a VR controller or a hand, turn it
 * over -- with Babylon's `SixDofDragBehavior`. An exhibit you take off its
 * stand, a piece you place.
 *
 * Attributes: `grab` (on; `grab="scale"` also lets two pointers or two hands
 * pinch it bigger or smaller, `MultiPointerScaleBehavior`), `grab-box` (draw
 * a bounding box round it with handles that turn and scale it, Babylon's
 * `BoundingBoxGizmo`; `#rrggbb` its colour, default `#0984e3`).
 *
 * **Physics bodies:** a dynamic body (`physics`) is carried while held -- it pushes
 * what it meets but doesn't fall -- and let go it flies on at the speed it was moving:
 * grab and throw, with a mouse, a finger or a VR controller. `grab-throw` scales that
 * speed (default 1; `0` drops it dead).
 *
 * Fires **`garden-grab`** and **`garden-release`** on the element (they bubble;
 * `garden-release`'s `detail.velocity` is the throw's). `element.grabbing` is true
 * while it's held.
 *
 * @example
 * ```html
 * <garden-mesh-model src="vase.glb" height="0.4" grab="scale" grab-box></garden-mesh-model>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourGrab(el: GardenElement, mesh: Mesh) {
    let mode = el.getAttribute("grab")?.trim().toLowerCase();
    let drag = new SixDofDragBehavior();
    mesh.addBehavior(drag);
    let scene = mesh.getScene();
    // Where it was over the last few frames (with the time each took), for the throw.
    let trail: { at: Vector3, dt: number }[] = [];
    let carried: any = null;
    let follow = () => {
        trail.push({ at: mesh.getAbsolutePosition().clone(), dt: scene.getEngine().getDeltaTime() / 1000 });
        if (trail.length > 6) trail.shift();
    };
    drag.onDragStartObservable.add(() => {
        (<any>el).grabbing = true;
        trail = [];
        scene.onBeforeRenderObservable.add(follow);
        // A dynamic body is carried: moved by the drag (animated), pushing others.
        let body = (<any>el).physicsAggregate?.body;
        if (body && body.getMotionType() == PhysicsMotionType.DYNAMIC) {
            carried = body;
            body.setMotionType(PhysicsMotionType.ANIMATED);
            // Steered to where the drag puts it (by velocity, so it shoves what it meets).
            body.setPrestepType(PhysicsPrestepType.ACTION);
        }
        el.dispatchEvent(new CustomEvent("garden-grab", { bubbles: true }));
    });
    drag.onDragEndObservable.add(() => {
        (<any>el).grabbing = false;
        scene.onBeforeRenderObservable.removeCallback(follow);
        let velocity = Vector3.Zero();
        let time = trail.slice(1).reduce((t, s) => t + s.dt, 0);
        if (trail.length > 1 && time > 0)
            velocity = trail[trail.length - 1].at.subtract(trail[0].at).scale(1 / time);
        let k = el.hasAttribute("grab-throw") ? Number(el.getAttribute("grab-throw")) || 0 : 1;
        velocity.scaleInPlace(k);
        let body = carried;
        carried = null;
        if (body && !body.isDisposed) {
            body.disablePreStep = true;
            body.setMotionType(PhysicsMotionType.DYNAMIC);
            body.setLinearVelocity(velocity);
            body.setAngularVelocity(Vector3.Zero());
        }
        el.dispatchEvent(new CustomEvent("garden-release", { bubbles: true, detail: { velocity } }));
    });
    if (mode == "scale")
        mesh.addBehavior(new MultiPointerScaleBehavior());

    if (el.hasAttribute("grab-box")) {
        let colour = el.getAttribute("grab-box");
        let layer = new UtilityLayerRenderer(mesh.getScene());
        layer.utilityLayerScene.autoClearDepthAndStencil = false;
        let gizmo = new BoundingBoxGizmo(colour?.startsWith("#") ? Color3.FromHexString(colour) : Color3.FromHexString("#0984e3"), layer);
        gizmo.attachedMesh = mesh;
        (<any>el).grabBox = gizmo;
        mesh.onDisposeObservable.addOnce(() => {
            gizmo.dispose();
            layer.dispose();
        });
    }
}
