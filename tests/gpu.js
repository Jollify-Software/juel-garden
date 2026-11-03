// The Chrome switches every browser test launches with. By default the real GPU through
// Direct3D 11 (this PC). With JUEL_GARDEN_GPU=swiftshader (what `node tests/run-all.js
// --gpu=swiftshader` sets) Chrome draws WebGL in software instead, for a machine with no GPU
// such as a CI runner: slower, and a few GPU-heavy tests may not pass there.
const SWIFTSHADER = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
const D3D11 = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-webgl"];

const GPU_ARGS = process.env.JUEL_GARDEN_GPU == "swiftshader" ? SWIFTSHADER : D3D11;

module.exports = { GPU_ARGS };
