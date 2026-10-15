// Writes examples/assets/block.gltf: a 2 x 4 x 2 box whose base sits 1 unit
// above its own origin, in centimetres-ish nonsense units -- the kind of
// offset, oddly-scaled file a scan or download gives you. Self-contained
// (base64 buffer), so tests need no network. Run: node tests/fixtures/make-block-gltf.js
const fs = require("fs");
const path = require("path");

const [x0, y0, z0, x1, y1, z1] = [-1, 1, -1, 1, 5, 1];
const faces = [ // [normal, 4 corners]
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
];
const pos = [], nrm = [], idx = [];
faces.forEach(([n, corners], f) => {
    for (const c of corners) { pos.push(...c); nrm.push(...n); }
    const b = f * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
});
const posBuf = Buffer.from(new Float32Array(pos).buffer);
const nrmBuf = Buffer.from(new Float32Array(nrm).buffer);
const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
const buffer = Buffer.concat([posBuf, nrmBuf, idxBuf]);

const gltf = {
    asset: { version: "2.0", generator: "juel-garden tests/fixtures/make-block-gltf.js" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "block", mesh: 0 }],
    meshes: [{ name: "block", primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: "stone", pbrMetallicRoughness: { baseColorFactor: [0.55, 0.5, 0.45, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    buffers: [{ byteLength: buffer.length, uri: "data:application/octet-stream;base64," + buffer.toString("base64") }],
    bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
        { buffer: 0, byteOffset: posBuf.length, byteLength: nrmBuf.length, target: 34962 },
        { buffer: 0, byteOffset: posBuf.length + nrmBuf.length, byteLength: idxBuf.length, target: 34963 },
    ],
    accessors: [
        { bufferView: 0, componentType: 5126, count: pos.length / 3, type: "VEC3", min: [x0, y0, z0], max: [x1, y1, z1] },
        { bufferView: 1, componentType: 5126, count: nrm.length / 3, type: "VEC3" },
        { bufferView: 2, componentType: 5123, count: idx.length, type: "SCALAR" },
    ],
};
const out = path.resolve(__dirname, "../../examples/assets/block.gltf");
fs.writeFileSync(out, JSON.stringify(gltf, null, 1));
console.log("wrote", out);
