import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { Utility } from "../Utility";

export function OptionsVector3ArraySetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let v = Vector3Convert.array(attr.find(x => x.name == name).value);
        console.log(v);
        options[property ?? name] = v;
    }
}