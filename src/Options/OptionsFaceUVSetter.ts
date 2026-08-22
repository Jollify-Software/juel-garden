import { Vector4Convert } from "../Converters/Vector4Convert"

/**
 * {@link ISetter} for the `faceuv` attribute -- per-face UV rectangles for a
 * box (e.g. wrapping one texture image across 6 faces), a comma-separated
 * list of `"u0 v0 u1 v1"` groups (see {@link Vector4Convert.array}).
 *
 * @category Options
 */
export function OptionFaceUVSetter(el: HTMLElement, attr: Attr[], options: object) {
    options['faceUV'] = Vector4Convert.array(
        attr.find(x => x.name == 'faceuv').value
    );
}