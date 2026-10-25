import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { pickAt } from "../Utils/picking";

/**
 * "Where the pointer points": as the pointer moves over the scene, `at-pointer` puts
 * the mesh where the pointer meets the scene (a cursor in the world, a placement
 * ghost), and `face-pointer` turns it about its vertical axis to face that point (a
 * turret, a character watching the cursor). The mesh itself is never what the pointer
 * meets. `at-pointer` moves a physics body too (teleported there).
 *
 * Attributes: `at-pointer` (bare, or `"x y z"`: an offset from the point, e.g.
 * `"0 0.5 0"` to sit on it), `face-pointer`, `pointer-ignore` (a selector of elements
 * the pointer passes through). Each pointer move also sets `element.pointerHit`, the
 * {@link PickHit} (or null).
 *
 * @example
 * ```html
 * <garden-sphere diameter="0.3" at-pointer emissive-colour="#00ff00"></garden-sphere>
 * <garden-box face-pointer ray ray-show></garden-box>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourPointer(el: GardenElement, mesh: Mesh) {
    let scene = el.getScene();
    let at = el.hasAttribute("at-pointer") && el.getAttribute("at-pointer") != "false";
    let face = el.hasAttribute("face-pointer") && el.getAttribute("face-pointer") != "false";
    let offset = Vector3Convert.fromString(el.getAttribute("at-pointer")) ?? Vector3.Zero();
    let ignoreSelector = el.getAttribute("pointer-ignore")?.trim();

    el.observe(scene.onPointerObservable, info => {
        if (info.type != PointerEventTypes.POINTERMOVE || mesh.isDisposed())
            return;
        let ignore: any[] = [el];
        if (ignoreSelector)
            ignore.push(...Array.from(document.querySelectorAll(ignoreSelector)));
        let hit = pickAt(scene, scene.pointerX, scene.pointerY, { ignore });
        (<any>el).pointerHit = hit;
        if (!hit)
            return;
        if (face) {
            let here = mesh.getAbsolutePosition();
            let yaw = Math.atan2(hit.point.x - here.x, hit.point.z - here.z);
            if (mesh.rotationQuaternion)
                mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, yaw, 0);
            else
                mesh.rotation.y = yaw;
        }
        if (at) {
            let p = hit.point.add(offset);
            if ((<any>el).physicsAggregate)
                (<any>el).teleport(p);
            else
                mesh.setAbsolutePosition(p);
        }
    });
}
