// resolveElements' two conventions, on a stand-in root (no DOM needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveElements } from "../../src/Utils/resolveElements";

// A root that records what it was asked and answers from a table of selector -> elements.
function root(table: Record<string, string[]>) {
    const asked: string[] = [];
    return {
        asked,
        querySelectorAll: (s: string) => { asked.push("all " + s); return table[s] ?? []; },
        querySelector: (s: string) => { asked.push("one " + s); return (table[s] ?? [])[0] ?? null; },
    } as any;
}

test("an empty or blank selector names nothing", () => {
    const r = root({});
    assert.deepEqual(resolveElements("   ", r), []);
    assert.deepEqual(r.asked, []);
});

test("a single token is one selector, all matches", () => {
    const r = root({ ".waypoint": ["a", "b"] });
    assert.deepEqual(resolveElements(" .waypoint ", r), ["a", "b"]);
});

test("a comma list is handed over whole, so descendant selectors inside it work", () => {
    const r = root({ ".room .wp, #x": ["a", "x"] });
    assert.deepEqual(resolveElements(".room .wp, #x", r), ["a", "x"]);
    assert.deepEqual(r.asked, ["all .room .wp, #x"]);
});

test("a space list is references, in the order written, missing ones dropped", () => {
    const r = root({ "#wp2": ["two"], "#wp1": ["one"] });
    assert.deepEqual(resolveElements("#wp2  #missing #wp1", r), ["two", "one"]);
});
