import { Vector3Convert } from "../Converters/Vector3";
import { ISetter } from "../ISetter";

export var ModifyRotationSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['rotation'] = Vector3Convert.rotationString(attr.find(x => x.name == 'rotation').value);
}