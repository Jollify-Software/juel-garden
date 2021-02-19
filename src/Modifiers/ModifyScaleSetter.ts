import { Vector3Convert } from "../Converters/Vector3";
import { ISetter } from "../ISetter";

export var ModifyScaleSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['scaling'] = Vector3Convert.fromString(attr.find(x => x.name == 'scale').value);
}