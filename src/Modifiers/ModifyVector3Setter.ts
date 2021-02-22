import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { Utility } from "../Utility";

export function ModifyVector3Setter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let v = Vector3Convert.fromString(attr.find(x => x.name == name).value);

        if (!attr.some(x => x.name == "absolute")) {
        let getMethod = `get${Utility.capitalize(name)}`;
        if (getMethod in el.parentElement) {
            let v2 = el.parentElement[getMethod]() as Vector3
            if (v2) {
                v = v2.add(v);
            }
        }
    }

        options[property ?? name] = v;
    }
}