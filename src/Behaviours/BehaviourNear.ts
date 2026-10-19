import { Node } from "@babylonjs/core/node";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GardenElement } from "../GardenElement";
import { resolveElements } from "../Utils/resolveElements";

/**
 * "You're near / you've gone": fires **`garden-near`** on this element when
 * one of the `near` targets comes within `near-distance`, and
 * **`garden-far`** when it goes back out past `near-distance ×
 * near-hysteresis` (so it doesn't flicker at the edge). Both bubble, with
 * `detail: { target, distance }` (`target` is the element, or the Babylon
 * camera for `near="camera"`). A cheap distance check each frame -- no
 * physics needed.
 *
 * Uses: an exhibit that talks when you walk up (with
 * `<garden-sound play-on="garden-near" stop-on="garden-far">`), a guide who
 * notices you've dropped behind, a trigger zone without a physics body.
 *
 * Works on any mesh element, and on a plain `<garden-element>` (a point in
 * space). `element.nearby` is the set of targets inside right now.
 *
 * Attributes: `near` (a selector -- `"#a, #b"` for several -- or `camera`
 * for the active camera, e.g. a first-person visitor), `near-distance`
 * (default `3`), `near-hysteresis` (default `1.2`).
 *
 * @example
 * ```html
 * <garden-box id="exhibit" near="#player" near-distance="4">
 *   <garden-sound url="talk.mp3" play-on="garden-near" stop-on="garden-far"></garden-sound>
 * </garden-box>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourNear(el: GardenElement, node: TransformNode) {
    let selector = el.getAttribute("near")?.trim();
    if (!selector)
        return;
    let scene = el.getScene();
    let previous: Observer<Scene> = (<any>el)._nearObserver;
    if (previous)
        scene.onBeforeRenderObservable.remove(previous);

    let num = (name: string, fallback: number) => el.hasAttribute(name) ? Number(el.getAttribute(name)) : fallback;
    let distance = num("near-distance", 3);
    let hysteresis = Math.max(1, num("near-hysteresis", 1.2));

    let nearby: Set<GardenElement | Node> = (<any>el).nearby ?? new Set();
    (<any>el).nearby = nearby;

    let targets: GardenElement[] = [];
    let resolve = () => {
        targets = selector == "camera" ? [] : resolveElements<GardenElement>(selector).filter(t => t != el);
    };
    GardenElement.whenDocumentReady().then(resolve);

    let frame = 0;
    (<any>el)._nearObserver = scene.onBeforeRenderObservable.add(() => {
        // Pick up targets added to the page later, about once a second.
        if (++frame % 60 == 0)
            resolve();
        if (!node || node.isDisposed())
            return;
        let here = node.getAbsolutePosition();
        let candidates: [GardenElement | Node, { x: number, y: number, z: number }][] =
            selector == "camera"
                ? (scene.activeCamera ? [[scene.activeCamera, scene.activeCamera.globalPosition]] : [])
                : targets.map(t => [t, t.getNode()?.getAbsolutePosition()] as [GardenElement, any]).filter(([, p]) => p);

        for (let [target, p] of candidates) {
            let d = Math.hypot(p.x - here.x, p.y - here.y, p.z - here.z);
            if (!nearby.has(target) && d <= distance) {
                nearby.add(target);
                el.dispatchEvent(new CustomEvent("garden-near", { bubbles: true, detail: { target, distance: d } }));
            } else if (nearby.has(target) && d > distance * hysteresis) {
                nearby.delete(target);
                el.dispatchEvent(new CustomEvent("garden-far", { bubbles: true, detail: { target, distance: d } }));
            }
        }
    });
}
