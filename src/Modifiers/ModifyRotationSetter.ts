import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { ISetter } from "../ISetter";

/**
 * {@link ISetter} for the `rotation` attribute (degrees, e.g. `"0 90 0"`).
 * Adds the parent element's own rotation on top *unless* the parent has real
 * Babylon scene-graph composition already (the `parent` attribute), which
 * would otherwise double-count it.
 *
 * @category Modifiers
 */
export var ModifyRotationSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    let v = Vector3Convert.rotationString(attr.find(x => x.name == 'rotation').value);

    // A `parent`-tagged container also sets `mesh.parent` on its children (see
    // GardenMesh.modifyMesh), so Babylon already composes the parent's rotation
    // automatically every frame -- this attribute is already local to it. Adding the
    // parent's rotation on top here too would double it (and freeze a stale snapshot
    // of it, for a parent whose own rotation keeps changing after this one-time read).
    if (!el.parentElement.hasAttribute("parent")) {
        let getMethod = 'getRotation';
        if (getMethod in el.parentElement) {
            let v2 = el.parentElement[getMethod]() as Vector3
            if (v2) {
                v = v.add(v2);
            }
        }
    }

    options['rotation'] = v;
}