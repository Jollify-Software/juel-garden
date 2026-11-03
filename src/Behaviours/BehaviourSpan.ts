import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GardenElement } from "../GardenElement";
import { resolveElements } from "../Utils/resolveElements";

/**
 * Spans the mesh between two elements, every frame: it sits halfway between
 * them with its own up (+y) axis along the line from the first to the second
 * -- a pendulum's rod, a rope or chain drawn between a post and what hangs
 * from it, a tether, a laser between two towers. Made for the bodies of a
 * `<garden-joint>`, which move under physics, but any two elements will do. A
 * cylinder (whose length is its `height`) is the usual shape.
 *
 * Attributes: `span` (the two elements, `"#a #b"`), `span-stretch` (also
 * scales the mesh along y so it reaches from one to the other, for a mesh one
 * unit tall: a rope that gets longer as it pays out).
 *
 * The mesh isn't a physics body itself (a `physics` mesh's place is the
 * engine's): put the body on what it spans.
 *
 * @example
 * ```html
 * <garden-sphere id="bob" physics position="0 1 -2"></garden-sphere>
 * <garden-box id="pivot" physics="static" position="0 1 0"></garden-box>
 * <garden-joint type="distance" between="#bob #pivot"></garden-joint>
 * <garden-cylinder span="#bob #pivot" height="2" diameter="0.1"></garden-cylinder>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourSpan(el: GardenElement, mesh: Mesh) {
    let selector = el.getAttribute("span")?.trim();
    if (!selector)
        return;
    let scene = el.getScene();
    let stretch = el.hasAttribute("span-stretch") && el.getAttribute("span-stretch") != "false";
    let ends: GardenElement[] = [];
    let resolve = () => {
        ends = resolveElements<GardenElement>(selector).filter(e => e != el).slice(0, 2);
    };
    GardenElement.whenDocumentReady().then(resolve);

    const up = new Vector3(0, 1, 0);
    let direction = new Vector3();
    let turn = new Quaternion();
    let frame = 0;
    let place = () => {
        if (ends.length < 2 || mesh.isDisposed())
            return;
        // Their world matrices now: physics has moved them since the last frame computed them.
        let [a, b] = ends.map(end => {
            let node = end.getNode();
            return node && !node.isDisposed() ? node.computeWorldMatrix(true).getTranslation() : null;
        });
        if (!a || !b)
            return;
        b.subtractToRef(a, direction);
        let length = direction.length();
        if (length < 1e-6)
            return;
        direction.scaleInPlace(1 / length);
        Quaternion.FromUnitVectorsToRef(up, direction, turn);
        mesh.rotationQuaternion = (mesh.rotationQuaternion ?? new Quaternion()).copyFrom(turn);
        mesh.setAbsolutePosition(a.add(b).scaleInPlace(0.5));
        if (stretch)
            mesh.scaling.y = length;
    };
    let afterPhysics = false;
    el.observe(scene.onBeforeRenderObservable, () => {
        // Pick up ends added to the page later, about once a second.
        if (ends.length < 2 && ++frame % 60 == 0)
            resolve();
        // Physics steps after this: once there is physics, again when it has moved the ends,
        // so the frame drawn has them.
        if (!afterPhysics && (<any>scene).onAfterPhysicsObservable) {
            afterPhysics = true;
            el.observe((<any>scene).onAfterPhysicsObservable, place);
        }
        place();
    });
}
