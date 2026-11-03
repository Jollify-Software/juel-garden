// Measures what is in the global bundle (dist/juel-garden.js) and what each element costs, with
// esbuild's metafile, so a smaller entry (a viewer bundle, per-element entries) can be planned
// from numbers rather than guesses.
//
//   node Tools/bundle-report.mjs [out-dir]
//
// Writes report.md and the full bundle's metafile.json to out-dir (default: a "bundle-report"
// folder in the system temp directory; it never writes into the repo). Builds in memory with the
// same options as `npm run build` (minified IIFE from juel-garden.global.ts).
//
// The report has: the 20 biggest inputs of the bundle; the bundle grouped by source (Babylon
// core, loaders, Havok, html2canvas, Lit, juel-garden's own code, ...); and, for every element
// module under src/Components, the size of a bundle importing only that module, and the inputs
// no other element module pulls in. Input sizes are esbuild's bytesInOutput (exact, minified);
// the gzipped figures per input or group are estimates (that input's or group's minified
// output gzipped alone, so they slightly overstate: gzip does better on the whole file); the
// gzipped bundle total is exact.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(process.argv[2] ?? join(tmpdir(), "bundle-report"));
mkdirSync(outDir, { recursive: true });

const options = {
    bundle: true, minify: true, format: "iife", platform: "browser", target: "es2020",
    write: false, metafile: true, logLevel: "silent", absWorkingDir: root, outfile: "out.js",
};

/** Which group an input path belongs to. */
function group(path) {
    const rules = [
        [/node_modules\/@babylonjs\/core\//, "Babylon core"],
        [/node_modules\/@babylonjs\/loaders\//, "Babylon loaders"],
        [/node_modules\/@babylonjs\/gui\//, "Babylon GUI"],
        [/node_modules\/@babylonjs\/havok\//, "Havok glue"],
        [/node_modules\/@babylonjs\/ktx2decoder\//, "KTX2 decoder"],
        [/node_modules\/html2canvas\//, "html2canvas"],
        [/node_modules\/rasterizehtml\//, "rasterizehtml"],
        [/node_modules\/(lit|lit-html|lit-element|@lit)\//, "Lit"],
        [/node_modules\//, "other packages"],
    ];
    for (const [re, name] of rules) if (re.test(path)) return name;
    return "juel-garden's own code";
}

const kb = n => (n / 1024).toFixed(1);
const gz = s => gzipSync(s, { level: 9 }).length;

/**
 * Each input's slice of a build's minified output, by scanning esbuild's per-input comments in an
 * unminified-whitespace build would be costlier; instead minify each input's own source alone and
 * gzip it: an estimate, close enough to rank and group.
 */
async function minifiedSource(path) {
    try {
        const r = await build({ ...options, entryPoints: [path], bundle: false, format: "esm",
            metafile: false, outfile: undefined, outdir: "x" });
        return r.outputFiles[0].contents;
    } catch { return new Uint8Array(); }
}

// 1. The full bundle.
const full = await build({ ...options, entryPoints: ["juel-garden.global.ts"] });
const fullJs = full.outputFiles[0].contents;
writeFileSync(join(outDir, "metafile.json"), JSON.stringify(full.metafile));
const fullInputs = Object.values(full.metafile.outputs)[0].inputs;

const rows = [];
for (const [path, { bytesInOutput }] of Object.entries(fullInputs)) {
    if (bytesInOutput > 0) rows.push({ path, bytes: bytesInOutput, group: group(path) });
}
rows.sort((a, b) => b.bytes - a.bytes);

// Gzip estimates per group: the minified sources of the group's inputs, concatenated.
const groups = new Map();
for (const row of rows) {
    const g = groups.get(row.group) ?? { bytes: 0, count: 0, parts: [] };
    g.bytes += row.bytes; g.count++;
    g.parts.push(await minifiedSource(row.path));
    groups.set(row.group, g);
}
for (const row of rows.slice(0, 20)) row.gzip = gz(await minifiedSource(row.path));

let md = `# juel-garden bundle report\n\n`;
md += `Built ${new Date().toISOString()} with the options of \`npm run build\`.\n\n`;
md += `**dist/juel-garden.js: ${kb(fullJs.length)} KB raw, ${kb(gz(fullJs))} KB gzipped** `;
md += `(${rows.length} inputs with output).\n\n`;

md += `## By group\n\n| Group | Inputs | Raw KB | Gzip KB (est.) | Share |\n|---|---:|---:|---:|---:|\n`;
for (const [name, g] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes)) {
    const joined = Buffer.concat(g.parts.map(p => Buffer.from(p)));
    md += `| ${name} | ${g.count} | ${kb(g.bytes)} | ${kb(gz(joined))} | ${(100 * g.bytes / fullJs.length).toFixed(1)}% |\n`;
}

md += `\n## The 20 biggest inputs\n\n| Input | Group | Raw KB | Gzip KB (est.) |\n|---|---|---:|---:|\n`;
for (const row of rows.slice(0, 20)) {
    md += `| \`${row.path}\` | ${row.group} | ${kb(row.bytes)} | ${kb(row.gzip)} |\n`;
}

// 2. Each element module alone.
function walk(dir) {
    return readdirSync(dir).flatMap(f => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
    });
}
const modules = walk(join(root, "src", "Components")).map(p => relative(root, p).replaceAll("\\", "/"));
const closures = new Map();
for (const mod of modules) {
    const r = await build({ ...options, entryPoints: [mod] });
    const out = Object.values(r.metafile.outputs)[0];
    closures.set(mod, { size: r.outputFiles[0].contents.length, gzip: gz(r.outputFiles[0].contents),
        inputs: Object.entries(out.inputs).filter(([, v]) => v.bytesInOutput > 0) });
}
const seenBy = new Map();
for (const [mod, c] of closures) for (const [path] of c.inputs) {
    seenBy.set(path, (seenBy.get(path) ?? new Set()).add(mod));
}

md += `\n## Each element module alone\n\nA bundle whose entry imports only that module (it still `;
md += `brings GardenElement, Lit and the Babylon it imports). "Only here" is what no other element `;
md += `module pulls in: the cost a page saves by not importing it.\n\n`;
md += `| Module | Alone raw KB | Alone gzip KB | Only here KB | Biggest only-here inputs |\n|---|---:|---:|---:|---|\n`;
const sorted = [...closures].sort((a, b) => b[1].size - a[1].size);
for (const [mod, c] of sorted) {
    const own = c.inputs.filter(([p]) => seenBy.get(p).size === 1 && p !== mod)
        .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);
    const ownBytes = own.reduce((s, [, v]) => s + v.bytesInOutput, 0);
    const top = own.slice(0, 3).map(([p, v]) => `\`${p.replace(/^node_modules\//, "")}\` ${kb(v.bytesInOutput)}`).join(", ");
    md += `| \`${mod}\` | ${kb(c.size)} | ${kb(c.gzip)} | ${kb(ownBytes)} | ${top} |\n`;
}

// 3. Sets of modules: the library entry without the global Babylon, and what a model viewer needs.
const sets = {
    "juel-garden.ts (library entry, no window.BABYLON)": ["./juel-garden.ts"],
    "viewer set (SideEffects, Scene, Camera, Light, MeshModel, ModelViewer)": ["./src/SideEffects.ts",
        "./src/Components/Scene.ts", "./src/Components/Camera.ts", "./src/Components/Light.ts",
        "./src/Components/MeshModel.ts", "./src/Components/ModelViewer.ts"],
};
md += `\n## Sets of modules\n\n| Entry | Raw KB | Gzip KB | html2canvas in? |\n|---|---:|---:|---|\n`;
for (const [name, files] of Object.entries(sets)) {
    const r = await build({ ...options, stdin: { contents: files.map(f => `import "${f}";`).join("\n"),
        resolveDir: root, loader: "ts" } });
    const js = r.outputFiles[0].contents;
    const inputs = Object.keys(Object.values(r.metafile.outputs)[0].inputs);
    md += `| ${name} | ${kb(js.length)} | ${kb(gz(js))} | ${inputs.some(p => p.includes("html2canvas")) ? "yes" : "no"} |\n`;
}
// Who imports the big optional packages, so a smaller entry knows which edge to cut.
const importers = pkg => Object.entries(full.metafile.inputs)
    .filter(([p, v]) => !p.includes("node_modules") && v.imports.some(i => i.path.includes(pkg)))
    .map(([p]) => `\`${p}\``);
md += `\n## Who imports the optional packages\n\n`;
for (const pkg of ["node_modules/html2canvas", "node_modules/rasterizehtml", "@babylonjs/havok",
    "node_modules/@babylonjs/loaders", "@babylonjs/core/index.js"]) {
    md += `- \`${pkg}\`: ${importers(pkg).join(", ") || "(only other packages)"}\n`;
}

writeFileSync(join(outDir, "report.md"), md);
console.log(md);
console.log(`Wrote ${join(outDir, "report.md")}`);
