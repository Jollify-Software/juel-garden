// Writes the small generated sounds the examples and tests use (no downloads needed):
// examples/assets/tone.wav (0.5 s, 440 Hz), thunder.wav (2.5 s brown-noise rumble) and
// call.wav (a guide's two-note "over here" whistle).
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

// A call: two whistled notes, falling, with a little vibrato.
const call = [];
for (const [start, length, from, to] of [[0, 0.32, 1180, 1240], [0.42, 0.5, 1240, 930]]) {
    while (call.length < Math.round(start * RATE)) call.push(0);
    let phase = 0;
    for (let i = 0, n = Math.round(length * RATE); i < n; i++) {
        const t = i / RATE, k = i / n;
        const f = from + (to - from) * k + Math.sin(t * 2 * Math.PI * 6) * 12;
        phase += 2 * Math.PI * f / RATE;
        const envelope = Math.min(1, t / 0.03) * Math.min(1, (length - t) / 0.08);
        call.push((Math.sin(phase) + 0.2 * Math.sin(2 * phase)) * 0.3 * envelope);
    }
}
wav("call.wav", call);
