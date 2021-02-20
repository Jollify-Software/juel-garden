import { Vector4Convert } from "../Converters/Vector4Convert"

export function OptionFaceUVSetter(el: HTMLElement, attr: Attr[], options: object) {
    options['faceUV'] = Vector4Convert.array(
        attr.find(x => x.name == 'faceuv').value
    );
}