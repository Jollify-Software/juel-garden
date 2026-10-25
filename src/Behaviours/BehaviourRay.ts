import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { PickHit, pickAlong } from "../Utils/picking";

/**
 * "What's in front of me": a ray from the mesh's centre along one of its own
 * directions, checked every frame for the first thing it meets -- an aim guide, what a
 * shot would hit, a guard's line of sight. `element.rayHit` is what it meets now (a
 * {@link PickHit}: `element`, `point`, `normal`, `distance`...), or null. Fires
 * **`garden-ray-hit`** when it starts meeting a different element (`detail`: the hit),
 * and **`garden-ray-miss`** when it stops meeting one (`detail: { element }`, the one it
 * lost). Both bubble. The mesh itself (with its parts) is never hit.
 *
 * Attributes: `ray` (the direction in the mesh's own frame, `"x y z"`; bare, straight
 * ahead, `0 0 1`; it turns with the mesh), `ray-length` (default 100), `ray-show`
 * (draw the ray as a line; `#rrggbb` its colour, default white), `ray-ignore` (a
 * selector of elements it passes through).
 *
 * @example
 * ```html
 * <garden-box id="turret" ray ray-length="50" ray-show="#ff0000" face-pointer></garden-box>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourRay(el: GardenElement, mesh: Mesh) {
    let scene = el.getScene();
    let attr = el.getAttribute("ray")?.trim();
    let local = (attr ? Vector3Convert.fromString(attr) : null) ?? new Vector3(0, 0, 1);
    if (local.lengthSquared() == 0) local = new Vector3(0, 0, 1);
    let length = el.hasAttribute("ray-length") ? Number(el.getAttribute("ray-length")) : 100;
    let ignoreSelector = el.getAttribute("ray-ignore")?.trim();

    let ray = new Ray(Vector3.Zero(), local.normalizeToNew(), length);
    if (el.hasAttribute("ray-show") && el.getAttribute("ray-show") != "false") {
        let colour = el.getAttribute("ray-show");
        let helper = new RayHelper(ray);
        helper.show(scene, colour?.startsWith("#") ? Color3.FromHexString(colour) : new Color3(1, 1, 1));
        el.whenDisposed(() => helper.dispose());
    }

    (<any>el).rayHit = null;
    let current: HTMLElement = null;
    el.observe(scene.onBeforeRenderObservable, () => {
        if (mesh.isDisposed())
            return;
        let world = mesh.computeWorldMatrix(true);
        ray.origin.copyFrom(mesh.getAbsolutePosition());
        Vector3.TransformNormalToRef(local, world, ray.direction);
        ray.direction.normalize();
        let ignore: any[] = [el];
        if (ignoreSelector)
            ignore.push(...Array.from(document.querySelectorAll(ignoreSelector)));
        let hit: PickHit = pickAlong(scene, ray.origin, ray.direction, length, { ignore });
        (<any>el).rayHit = hit;
        let now = hit?.element ?? null;
        if (now != current) {
            let lost = current;
            current = now;
            if (lost)
                el.dispatchEvent(new CustomEvent("garden-ray-miss", { bubbles: true, detail: { element: lost } }));
            if (now)
                el.dispatchEvent(new CustomEvent("garden-ray-hit", { bubbles: true, detail: hit }));
        }
    });
}
