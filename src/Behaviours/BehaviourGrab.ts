import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
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
 * Fires **`garden-grab`** and **`garden-release`** on the element (they bubble).
 * `element.grabbing` is true while it's held.
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
    drag.onDragStartObservable.add(() => {
        (<any>el).grabbing = true;
        el.dispatchEvent(new CustomEvent("garden-grab", { bubbles: true }));
    });
    drag.onDragEndObservable.add(() => {
        (<any>el).grabbing = false;
        el.dispatchEvent(new CustomEvent("garden-release", { bubbles: true }));
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
