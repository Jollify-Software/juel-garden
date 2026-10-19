// Writes the small generated sounds the examples and tests use (no downloads needed):
// examples/assets/tone.wav (0.5 s, 440 Hz) and thunder.wav (2.5 s brown-noise rumble).
// node Tools/make-sounds.js
const fs = require("fs"), path = require("path");
const RATE = 8000;
function wav(file, samples) {
    const n = samples.length, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24);
    b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
    samples.forEach((s, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * 32767))), 44 + i * 2));
    fs.writeFileSync(path.join(__dirname, "..", "examples", "assets", file), b);
}
const tone = [];
for (let i = 0, n = RATE * 0.5; i < n; i++) tone.push(Math.sin(2 * Math.PI * 440 * i / RATE) * 0.25 * Math.min(1, (n - i) / 400));
wav("tone.wav", tone);

// Thunder: brown noise (integrated white noise), a sharp crack, then a long uneven rumble.
let seed = 7, brown = 0;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const thunder = [];
for (let i = 0, n = RATE * 2.5; i < n; i++) {
    const t = i / RATE;
    brown = (brown + (random() * 2 - 1) * 0.08) * 0.995;
    const envelope = Math.min(1, t / 0.03) * Math.exp(-t * 1.3) * (0.75 + 0.25 * Math.sin(t * 9 + Math.sin(t * 3) * 2));
    const crack = t < 0.15 ? (random() * 2 - 1) * (1 - t / 0.15) * 0.5 : 0;
    thunder.push((brown * 3 + crack) * envelope);
}
wav("thunder.wav", thunder);
