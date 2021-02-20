import { Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { ISetter } from "../ISetter";

export var ModifyRotationSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    let v = Vector3Convert.rotationString(attr.find(x => x.name == 'rotation').value);

    let getMethod = 'getRotation';
        if (getMethod in el.parentElement) {
            let v2 = el.parentElement[getMethod]() as Vector3
            if (v2) {
                v = v.add(v2);
            }
        }

    options['rotation'] = v;
}