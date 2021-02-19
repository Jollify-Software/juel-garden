import { Vector3Convert } from "../Converters/Vector3";

export function ModifyVector3Setter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = Vector3Convert.fromString(attr.find(x => x.name == name).value);
    }
}