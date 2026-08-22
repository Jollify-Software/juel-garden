import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { Utility } from "../Utility";

/**
 * {@link ISetter} factory for a `Vector3`-valued attribute (`position`,
 * `scale`). Adds the parent element's own value on top *unless* an
 * `absolute` attribute is present or the parent has real Babylon scene-graph
 * composition already (the `parent` attribute), either of which would
 * otherwise double-count it.
 *
 * @category Modifiers
 */
export function ModifyVector3Setter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let v = Vector3Convert.fromString(attr.find(x => x.name == name).value);

        // A `parent`-tagged container also sets `mesh.parent` on its children (see
        // GardenMesh.modifyMesh), giving them a real Babylon scene-graph relationship --
        // Babylon then composes the parent's transform automatically every frame, so
        // this attribute is already local to it. Adding the parent's *current* absolute
        // position/scale on top here as well would double it, and -- for a parent whose
        // own position changes after this one-time read (e.g. a `drive`/`suspension`
        // mesh) -- freeze that stale snapshot into what Babylon then treats as the
        // child's local offset, drifting further from correct every time the parent moves.
        if (!attr.some(x => x.name == "absolute") && !el.parentElement.hasAttribute("parent")) {
        let getMethod = `get${Utility.capitalize(name)}`;
        if (getMethod in el.parentElement) {
            let v2 = el.parentElement[getMethod]() as Vector3
            if (v2) {
                v = v2.add(v);
            }
        }
    }

    if (options[property ?? name] && (<Vector3>options[property ?? name]) != Vector3.Zero()) {
        v = v.add(options[property ?? name]);
    }
        options[property ?? name] = v;
    }
}