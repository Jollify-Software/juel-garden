import { Utility } from "../Utility";

/** {@link ISetter} factory for a numeric attribute (literal or `(Math...)` expression, see {@link Utility.getFloat}). @category Options */
export function FloatSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = Utility.getFloat(attr.find(x => x.name == name).value);
    }
}