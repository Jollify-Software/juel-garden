import { Vector3Convert } from "../Converters/Vector3";
import { ISetter } from "../ISetter";

export var ModifyPositionSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['position'] = Vector3Convert.fromString(attr.find(x => x.name == 'position').value);
}