// Encodes an image (PNG or JPEG) to a KTX2 GPU texture (Basis Universal: UASTC or ETC1S), the
// format <garden-texture src="x.ktx2"> and glTF models' KHR_texture_basisu load through
// Babylon's KTX2 decoder (see src/Decoders.ts). It stays compressed on the GPU, so a 1024 px
// colour map takes 1 MB of GPU memory instead of 5.3 (with mips), uploads in a moment, and is
// usually smaller on disk than a JPEG too (ETC1S) -- what a tablet needs.
//
//   node Tools/ktx2-encode.mjs in.png out.ktx2 [--uastc] [--normal] [--linear] [--no-mips] [--quality N]
//
// --uastc: the high-quality mode (normal maps, maps with fine detail; larger files); without it
// ETC1S, small files, fine for colour maps. --normal: a normal map (two-channel encoding, UASTC
// implied). --linear: data (roughness, occlusion), not sRGB colour. --quality: ETC1S 1-255
// (default 128) or UASTC 0-4 (default 2).
//
// The pixels are read with Python's Pillow (the encoder runs in Node, without an image
// decoder), and encoded by babylonpress-ktx2-encoder's Basis Universal WASM build.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeToKTX2 } from "babylonpress-ktx2-encoder";

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith("--")));
const files = args.filter(a => !a.startsWith("--"));
const quality = Number(args[args.indexOf("--quality") + 1]) || 0;
if (files.length < 2) {
    console.error("usage: node Tools/ktx2-encode.mjs in.png out.ktx2 [--uastc] [--normal] [--linear] [--no-mips] [--quality N]");
    process.exit(2);
}
const [input, output] = files;
const normal = flags.has("--normal");
const uastc = flags.has("--uastc") || normal;

// The pixels, RGBA8, from Pillow: width and height on the first line, then the raw bytes.
const PY = `import sys\nfrom PIL import Image\nim = Image.open(sys.argv[1]).convert('RGBA')\nsys.stdout.buffer.write(('%d %d\\n' % im.size).encode())\nsys.stdout.buffer.write(im.tobytes())\n`;
const raw = execFileSync("python", ["-c", PY, resolve(input)], { maxBuffer: 1 << 30 });
const nl = raw.indexOf(10);
const [width, height] = raw.subarray(0, nl).toString().split(" ").map(Number);
const pixels = new Uint8Array(raw.buffer, raw.byteOffset + nl + 1, width * height * 4);

const ktx2 = await encodeToKTX2(pixels, {
    imageDecoder: async () => ({ width, height, data: pixels }),
    isUASTC: uastc,
    isNormalMap: normal,
    isPerceptual: !flags.has("--linear") && !normal,
    generateMipmap: !flags.has("--no-mips"),
    // Zstandard over UASTC (ETC1S has its own compression and can't take it).
    needSupercompression: uastc,
    ...(uastc ? { uastcLDRQualityLevel: quality || 2 } : { qualityLevel: quality || 128, compressionLevel: 2 }),
});
writeFileSync(output, ktx2);
const inBytes = readFileSync(input).length;
console.log(`${output}: ${width}x${height} ${uastc ? "UASTC" : "ETC1S"}${normal ? " normal map" : ""}, ${(ktx2.length / 1024).toFixed(0)} KB (from ${(inBytes / 1024).toFixed(0)} KB)`);
