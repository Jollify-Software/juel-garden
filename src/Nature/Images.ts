/**
 * A picture drawn from a function, as a PNG data URL, for terrain made in code:
 * `<garden-height-map url="...">` from a height function, or a mix map for
 * {@link "Nature/SplatMaterial"!splatMaterial} from where each ground should be.
 *
 * `fn(x, z)` is called for every pixel with world coordinates across `width` × `depth` centred
 * on the origin, laid out as Babylon reads a heightmap (row 0 is the far, +z edge), and returns
 * red, green and blue from 0 to 1 (one number for grey).
 *
 * @example
 * ```ts
 * // A heightmap from -4 to 8 m.
 * const url = imageFromFunction(321, 320, 320, (x, z) => (height(x, z) + 4) / 12);
 * ```
 *
 * @category Nature
 */
export function imageFromFunction(size: number, width: number, depth: number,
    fn: (x: number, z: number) => number | [number, number, number]): string {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");
    let img = ctx.createImageData(size, size);
    let byte = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
    for (let j = 0; j < size; j++)
        for (let i = 0; i < size; i++) {
            let x = -width / 2 + (i / (size - 1)) * width;
            let z = depth / 2 - (j / (size - 1)) * depth;
            let v = fn(x, z);
            let [r, g, b] = typeof v == "number" ? [v, v, v] : v;
            let k = (j * size + i) * 4;
            img.data[k] = byte(r);
            img.data[k + 1] = byte(g);
            img.data[k + 2] = byte(b);
            img.data[k + 3] = 255;
        }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
}
