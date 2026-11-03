// Runs the whole test suite, one test at a time, with a time limit on each and a summary at
// the end: first the unit tests (tests/unit, node:test, no browser), then every browser test
// in tests/*.js. One at a time because each browser test starts its own Chrome, and several
// at once run this PC out of memory.
//
//   node tests/run-all.js                    everything (build first: npm run build)
//   node tests/run-all.js walk waypoint      only tests whose name contains one of these words
//   node tests/run-all.js --unit             only the unit tests (no build, no browser)
//   node tests/run-all.js --browser          only the browser tests
//   node tests/run-all.js --list             say what would run, run nothing
//   node tests/run-all.js --timeout=180      seconds each test may take (default 120)
//   node tests/run-all.js --gpu=swiftshader  software WebGL, for a machine with no GPU (tests/gpu.js)
//
// CHROME_PATH picks the Chrome to use, as for each test on its own (tests/harness.js).
// Exit code 0 only when every test that ran passed. `test:lean` isn't run here: it needs its
// own build (npm run test:lean).
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HERE = __dirname;
// Files in tests/ that are helpers, not tests.
const NOT_TESTS = new Set(["harness.js", "gpu.js", "run-all.js"]);
// Tests that need longer than the default limit, in seconds: examples opens every example page (about 90 s).
const SLOW = { examples: 300 };

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => (args.find(a => a.startsWith(name + "=")) || "").slice(name.length + 1) || fallback;
const words = args.filter(a => !a.startsWith("--"));
const seconds = Number(option("--timeout", "120"));
const gpu = option("--gpu", "");
if (gpu && gpu != "swiftshader") {
    console.error(`Unknown --gpu=${gpu}: the only choice is --gpu=swiftshader.`);
    process.exit(2);
}

const matches = name => words.length == 0 || words.some(w => name.includes(w));
const tests = [];
if (!flag("--browser") && (words.length == 0 || words.includes("unit")))
    tests.push({ name: "unit", file: path.join(HERE, "unit", "run.js") });
if (!flag("--unit"))
    for (const f of fs.readdirSync(HERE).filter(f => f.endsWith(".js") && !NOT_TESTS.has(f)).sort())
        if (matches(f.replace(/\.js$/, "")))
            tests.push({ name: f.replace(/\.js$/, ""), file: path.join(HERE, f) });

if (flag("--list")) {
    for (const t of tests) console.log(t.name);
    console.log(`${tests.length} tests`);
    process.exit(0);
}

// A test's limit: --timeout, or its SLOW entry if that is longer.
const limitFor = test => Math.max(seconds, SLOW[test.name] || 0);

// Runs one test file in its own Node, killing it (and the Chrome it started) after the limit.
function runOne(test) {
    return new Promise(resolve => {
        const started = Date.now();
        const env = { ...process.env, ...(gpu ? { JUEL_GARDEN_GPU: gpu } : {}) };
        const child = spawn(process.execPath, [test.file], { cwd: path.resolve(HERE, ".."), env, stdio: "inherit",
            detached: process.platform != "win32" });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            if (process.platform == "win32")
                spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
            else
                try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
        }, limitFor(test) * 1000);
        child.on("exit", code => {
            clearTimeout(timer);
            resolve({ ...test, ok: code === 0 && !timedOut, timedOut, code, secs: (Date.now() - started) / 1000 });
        });
    });
}

(async () => {
    const results = [];
    for (const t of tests) {
        console.log(`\n=== ${t.name}`);
        results.push(await runOne(t));
    }
    console.log("\n=== Summary");
    for (const r of results)
        console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(24)} ${r.secs.toFixed(1)}s${r.timedOut ? `  (stopped after ${limitFor(r)}s)` : r.ok ? "" : `  (exit ${r.code})`}`);
    const failed = results.filter(r => !r.ok);
    console.log(`${results.length - failed.length} of ${results.length} passed${failed.length ? `; failed: ${failed.map(r => r.name).join(", ")}` : ""}`);
    process.exitCode = failed.length ? 1 : 0;
})();
