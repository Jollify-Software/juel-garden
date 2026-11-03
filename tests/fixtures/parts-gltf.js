// A tiny glTF made in memory for tests, as a data: URL: two named parts, "plate" (a square
// with one morph target, "lift", that raises its far edge by 1) and "stem" (a square beside it).
// No file and no network. Used by tests/mesh-emitter.js and tests/glow.js.
function partsGltfUrl() {
    const square = (x0, y0) => [x0, y0, 0, x0 + 1, y0, 0, x0 + 1, y0 + 1, 0, x0, y0 + 1, 0];
    const plate = square(0, 0), stem = square(2, 0);
    const lift = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1]; // the top two corners move 1 in z
    const normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    const indices = [0, 2, 1, 0, 3, 2];
    const chunks = [];
    const views = [], accessors = [];
    let offset = 0;
    const add = (array, Type, type, count, target, minmax) => {
        const buf = Buffer.from(new Type(array).buffer);
        chunks.push(buf);
        views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
        offset += buf.length;
        accessors.push(Object.assign({ bufferView: views.length - 1, componentType: Type == Float32Array ? 5126 : 5123, count, type }, minmax || {}));
        return accessors.length - 1;
    };
    const bounds = p => ({ min: [0, 1, 2].map(i => Math.min(...p.filter((_, j) => j % 3 == i))), max: [0, 1, 2].map(i => Math.max(...p.filter((_, j) => j % 3 == i))) });
    const plateP = add(plate, Float32Array, "VEC3", 4, 34962, bounds(plate));
    const stemP = add(stem, Float32Array, "VEC3", 4, 34962, bounds(stem));
    const liftP = add(lift, Float32Array, "VEC3", 4, 34962, bounds(lift));
    const n = add(normals, Float32Array, "VEC3", 4, 34962);
    const uv = add(uvs, Float32Array, "VEC2", 4, 34962);
    const idx = add(indices, Uint16Array, "SCALAR", 6, 34963);
    const buffer = Buffer.concat(chunks);
    const gltf = {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0, 1] }],
        nodes: [{ name: "plate", mesh: 0 }, { name: "stem", mesh: 1 }],
        meshes: [
            { name: "plate", weights: [0], extras: { targetNames: ["lift"] },
              primitives: [{ attributes: { POSITION: plateP, NORMAL: n, TEXCOORD_0: uv }, indices: idx, targets: [{ POSITION: liftP }] }] },
            { name: "stem", primitives: [{ attributes: { POSITION: stemP, NORMAL: n, TEXCOORD_0: uv }, indices: idx }] },
        ],
        buffers: [{ byteLength: buffer.length, uri: "data:application/octet-stream;base64," + buffer.toString("base64") }],
        bufferViews: views,
        accessors,
    };
    return "data:model/gltf+json;base64," + Buffer.from(JSON.stringify(gltf)).toString("base64");
}

module.exports = { partsGltfUrl };
