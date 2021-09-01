import { Utility } from "../Utility";

export function FloatSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = Utility.getFloat(attr.find(x => x.name == name).value);
    }
}