import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { resolveElements } from "../Utils/resolveElements";

/**
 * "Touching": fires **`garden-overlap`** on this element when its mesh starts to
 * overlap one of the `overlap` targets (or contain the `overlap-point`), and
 * **`garden-overlap-end`** when they part. Both bubble, with `detail: { target }` (the
 * other element, or the point as a `Vector3`). Checked each frame by bounding boxes,
 * no physics needed: a balloon popping on a spike, a pickup collected, a goal crossed.
 * `element.overlapping` is the set of targets touching it now.
 *
 * Attributes: `overlap` (a selector -- `"#a, #b"` for several), `overlap-precise`
 * (compare the meshes' own turned boxes; otherwise boxes lined up with the world
 * axes, cheaper but loose round anything turned), `overlap-point` (`"x y z"`, world
 * space: a point inside the mesh's box; works without `overlap` too).
 *
 * With a `<garden-action trigger="garden-overlap">` inside, the change is markup too.
 *
 * @example
 * ```html
 * <garden-sphere id="balloon" overlap="#spikes" overlap-precise emissive-colour="#ffffff">
 *   <garden-action trigger="garden-overlap" type="set" property="material.emissiveColor" value="#ff0000"></garden-action>
 *   <garden-action trigger="garden-overlap-end" type="set" property="material.emissiveColor" value="#ffffff"></garden-action>
 * </garden-sphere>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourOverlap(el: GardenElement, mesh: Mesh) {
    let scene = el.getScene();
    let selector = el.getAttribute("overlap")?.trim();
    let precise = el.hasAttribute("overlap-precise") && el.getAttribute("overlap-precise") != "false";
    let point = Vector3Convert.fromString(el.getAttribute("overlap-point"));

    let overlapping: Set<any> = new Set();
    (<any>el).overlapping = overlapping;

    let targets: GardenElement[] = [];
    let resolve = () => {
        targets = selector ? resolveElements<GardenElement>(selector).filter(t => t != el) : [];
    };
    GardenElement.whenDocumentReady().then(resolve);

    let fire = (name: string, target: any) =>
        el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { target } }));
    let check = (target: any, now: boolean) => {
        if (now && !overlapping.has(target)) {
            overlapping.add(target);
            fire("garden-overlap", target);
        } else if (!now && overlapping.has(target)) {
            overlapping.delete(target);
            fire("garden-overlap-end", target);
        }
    };

    let frame = 0;
    el.observe(scene.onBeforeRenderObservable, () => {
        // Pick up targets added to the page later, about once a second.
        if (++frame % 60 == 0)
            resolve();
        if (mesh.isDisposed())
            return;
        mesh.computeWorldMatrix(true);
        for (let target of targets) {
            let other = (<any>target).mesh;
            if (!other || other.isDisposed?.()) {
                check(target, false);
                continue;
            }
            other.computeWorldMatrix(true);
            check(target, mesh.intersectsMesh(other, precise, true));
        }
        if (point)
            check(point, mesh.intersectsPoint(point));
    });
}
