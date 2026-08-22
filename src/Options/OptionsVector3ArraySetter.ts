import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { Utility } from "../Utility";

/** {@link ISetter} factory for a comma-separated list of `Vector3`s (e.g. `points`, `shape`), see {@link Vector3Convert.array}. @category Options */
export function OptionsVector3ArraySetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let v = Vector3Convert.array(attr.find(x => x.name == name).value);
        options[property ?? name] = v;
    }
}