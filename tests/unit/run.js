// Runs the pure-maths unit tests (tests/unit/*.test.ts) on node:test, with no browser.
// Each test file is bundled by esbuild (already a devDependency) into a temporary .mjs,
// because Node can't import the library's extensionless TypeScript imports itself.
//
//   node tests/unit/run.js            all unit tests
//   node tests/unit/run.js noise      only files whose name contains "noise"
//
// Exit code is node --test's: 0 when every test passes.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("esbuild");

const HERE = __dirname;
const filter = process.argv[2] || "";
const files = fs.readdirSync(HERE).filter(f => f.endsWith(".test.ts") && f.includes(filter)).sort();
if (files.length == 0) {
    console.log(`No unit tests match "${filter}".`);
    process.exit(1);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), "juel-garden-unit-"));
try {
    const built = files.map(f => {
        const outfile = path.join(out, f.replace(/\.ts$/, ".mjs"));
        esbuild.buildSync({ entryPoints: [path.join(HERE, f)], bundle: true, format: "esm", platform: "node",
            target: "node20", outfile, logLevel: "warning", external: ["node:*"] });
        return outfile;
    });
    const r = spawnSync(process.execPath, ["--test", ...built], { stdio: "inherit" });
    process.exitCode = r.status ?? 1;
} finally {
    fs.rmSync(out, { recursive: true, force: true });
}
