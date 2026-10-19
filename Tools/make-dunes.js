// Writes examples/assets/dunes.png: a 256x256 greyscale height map of soft
// desert dunes for the Characters examples (no network needed, unlike the
// Babylon CDN height maps). node Tools/make-dunes.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const N = 256;
const raw = Buffer.alloc(N * (N + 1));
for (let y = 0; y < N; y++) {
    raw[y * (N + 1)] = 0; // filter: none
    for (let x = 0; x < N; x++) {
        const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2;
        let h = 0.5
            + 0.22 * Math.sin(u * 2 + Math.sin(v * 1.5) * 1.2)
            + 0.12 * Math.sin(v * 3 + u * 0.7)
            + 0.06 * Math.sin(u * 7 + v * 5);
        // A flat-ish valley along the middle, where the examples walk.
        const centre = Math.abs(x - N / 2) / (N / 2);
        h = h * (0.35 + 0.65 * Math.min(1, centre * 1.6));
        raw[y * (N + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(h * 255)));
    }
}
const crc = buf => {
    let c, table = [];
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 0; // 8-bit greyscale
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname, "..", "examples", "assets", "dunes.png"), png);
