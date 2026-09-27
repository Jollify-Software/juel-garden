# Juel Garden beyond the browser — plan

Written 2026-09-27. Nothing here is built yet.

**The idea:** the `<garden-*>` HTML is a **language**, not an
implementation. **Parterre is the compiler** for it: it reads a scene (or an
SVG floor plan), checks it against what each runtime supports, and hands it to
a backend. There is one tag vocabulary (`<garden-*>`) for every runtime.

| Backend | Output | Runtime | Effort |
|---|---|---|---|
| **web** (today) | `scene.html` page | Juel Garden (TS + Babylon.js) in the browser, WebXR | Exists. |
| **A: player** | `.garden` archive / double-click `Venue.exe` | The **existing** Juel Garden inside WebView2 | Days. Full parity for free. |
| **B: grotto** | Native C# `Venue.exe` | **Juel Garden Grotto**, a new runtime on **Stride** | Months. Grows element by element. |

Juel Garden (the web runtime) is unchanged. **Juel Garden Grotto** (short name
**grotto**) is a separate project. A grotto is the ornamental cave of a formal
garden, the place you step *into*, which is what a native, VR-capable build is
compared with a web page. The name keeps it visibly part of Juel Garden, since
it runs the same language.

```
   plan.svg ──► Parterre ──► scene.html ◄── hand-written / other producers
                   │          (<garden-*> tags + <meta name="garden-*">)
                   │                │
                   └── reads meta + support registry, picks backend
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   web: scene.html          A: .garden / Venue.exe     B: grotto
   (Juel Garden,            (WebView2 player +         (Juel Garden Grotto,
    browser, WebXR)          Juel Garden)               Stride, OpenXR)
```

---

## One vocabulary: `<garden-*>` for every runtime

Runtime-specific features **don't get their own prefix**. A feature that
starts as grotto-only is still `<garden-physics>` (or `<garden-box physics>`).
If Juel Garden implements it later, the same tag simply becomes portable, and
no scene has to be renamed.

### Support registry (the compiler's knowledge, not an author's job)

Because tags no longer reveal where they run, `Garden.Contract` records, per
element and per attribute, which runtimes implement it **today**:

```csharp
[GardenElement("garden-box",     Runtime.Web | Runtime.Grotto)]
[GardenElement("garden-boolean", Runtime.Web)]      // not ported to grotto yet
[GardenElement("garden-physics", Runtime.Grotto)]   // grotto-only, for now
```

Parterre needs this regardless of any markers: a perfectly portable scene
built for grotto still has to know whether grotto has ported
`garden-boolean` yet. `parterre check` prints it as a per-runtime support
table for the scene, and the conformance set (see Parity) comes from it.

**Browser safety net:** Juel Garden registers a stub for every element it
doesn't implement (generated from the registry), which logs
`<garden-physics> is only supported by: grotto`. Unknown tags then warn
instead of silently rendering nothing.

---

## Scene settings: `<meta name="garden-*">`

Scene-level settings are ordinary `<meta>` tags in `<head>`, all prefixed
`garden-`. They're **optional**: no meta means a portable scene, and every
existing file keeps working.

```html
<head>
  <meta name="garden-runtime" content="grotto">      <!-- intended runtime(s) -->
  <meta name="garden-contract" content="1">          <!-- language version (future) -->
</head>
```

| Meta | Values | Meaning |
|---|---|---|
| `garden-runtime` | Space-separated list of `web`, `grotto` | The runtimes this scene **must** work on. Parterre errors if any element/attribute used isn't supported by *all* of them. The **first** value is the preferred runtime (default target). Absent means portable: no guarantee claimed, and the target comes from the output name or `--target`. |
| `garden-contract` | Integer, default `1` | Language version. Only needed once a v2 breaks v1 scenes. |
| *future* | e.g. `garden-title`, `garden-author`, `garden-start` (start waypoint), `garden-units` | Add as needed. Parterre **warns** on an unknown `garden-*` meta (possibly a typo) but doesn't fail. |

`<meta>` rather than a DOCTYPE: it's plain HTML, you can have as many as you
like, each can hold several values, and browsers ignore it. (DOCTYPE public
identifiers were considered and dropped: only one per file, one value, and
easy to get subtly wrong.)

### How Parterre chooses the target
1. `--target web|archive|player|grotto`, if given.
2. Otherwise from the output name: `.html` → web, `.garden` → archive,
   `.exe` → the **first** `garden-runtime` value if it's `grotto`, else
   player.
3. Otherwise the first `garden-runtime` value, else web.
4. Then validate: every element and attribute must be supported by the target
   **and** by every runtime listed in `garden-runtime`. Unsupported features
   are errors, listed by name and line.

---

## Parterre as the compiler

The Parterre **library** stays AngleSharp-only (SVG → scene HTML, as today).
The new pieces sit beside it:

```
parterre/
  Parterre            (exists) SVG plan → scene HTML. AngleSharp only.
  Garden.Contract     (new)    Typed scene model (GardenBox, GardenRoom, …), the
                               support registry, garden-* meta parsing, attribute +
                               permissive CSS parsing, validation. AngleSharp only.
                               Shared with Juel Garden Grotto.
  Parterre.Cli        (exists) The single front door; dispatches to backends:
                                 web     → write the page (today's path)
                                 archive → pack via Jollify.Packaging (Track A)
                                 player  → bake player exe + archive (Track A)
                                 grotto  → JuelGarden.Grotto.Build (Track B)
  Parterre.Tests      (exists) + contract golden files from juel-garden/examples
```

`Parterre.Cli` references `JuelGarden.Grotto.Build` by relative path (the
`jellyfish-cli` pattern). The Build project only *orchestrates* (asset
compile + `dotnet publish` of the player), so **Stride never becomes a
dependency of Parterre** itself.

### CLI shape
```
parterre plan.svg -o museum.html                     # today: SVG → Juel Garden page
parterre plan.svg -o Museum.exe                      # SVG → page → player (WebView)
parterre plan.svg --target grotto -o Museum.exe      # SVG → scene → native grotto exe

parterre build scene.html -o Venue.exe               # meta decides: grotto first → grotto, else player
parterre build scene.html --target grotto -o Venue.exe
parterre pack  scene.html -o venue.garden            # archive only (Track A)
parterre check scene.html                            # meta, validation, per-runtime support table
parterre run   scene.html                            # build to a temp dir and launch (dev loop)
```
The current `parterre <plan.svg>` form keeps working unchanged. The new verbs
are additive. `--runtime "web grotto"` makes Parterre write the
`garden-runtime` meta into generated pages.

---

## Track A — desktop player for the existing runtime (do first)

The cheap route to a double-clickable scene. It shares its plumbing with the
Jetty viewer (`jetty/VIEWER-PLAN.md`).

1. **`.garden` archive.** Same container rules as `jetty/ARCHIVE.md`: zip,
   first entry `mimetype` = `application/vnd.jollify.garden+zip`, a
   `manifest.json` (copying the scene's `garden-*` metas), the scene HTML, the
   bundled `juel-garden.js` runtime, and `assets/` (textures,
   `.glb`/`.babylon` models, sounds).
   → Before building `Jetty.Archive`, **generalise it into one container
   library** (working name `Jollify.Packaging`) with typed manifests for
   `jetty` and `garden`. Nothing is built yet, so this is free now.
2. **`parterre pack`:** collects references with AngleSharp (as
   `slipway pack` will), bundles the runtime, and writes the manifest.
3. **Player:** the MAUI Windows viewer opens `.garden` as well as `.jetty`,
   through the same `IDeckHost` (WebView2 virtual-host mapping). It becomes a
   generic "Jollify player".
4. **`--target player`:** a prebuilt player exe with the archive embedded.
   One file to hand a venue, with no install and no file association.
5. **Limits:** WebXR inside WebView2 isn't expected to work, so this track is
   desktop-screen only. VR stays in the browser (Quest), and native VR is
   Track B. The player runs the web runtime, so it accepts exactly what `web`
   supports.

**Exit test:** every `examples/**` scene packs, opens by double-click, and
behaves the same as in Chrome. Parterre sample plan → `Museum.exe`.

---

## Track B — Juel Garden Grotto: `<garden-*>` HTML → Stride → native .exe

### Principles
- **Load the scene, don't generate C# from it.** The runtime reads the scene
  through `Garden.Contract` into the typed model and builds Stride entities.
  Each `<garden-x>` maps to one C# component class, which gives "C#
  components instead of TS" without a codegen and Roslyn step.
- **Compile assets, not code.** The build step is a compiler where it
  matters: Stride's asset pipeline pre-processes models and textures, then
  `dotnet publish` produces a single-file exe with the scene embedded.
- **Code-only Stride** via the Stride Community Toolkit, so there is no Game
  Studio project to maintain and the loader creates everything at runtime.
- **Declarative only (v1).** Inline JS (`onclick="…"`) can't run natively.
  It's a registry entry like any other: `onclick` is supported by `web` only,
  so grotto builds warn and skip it. Behaviours use `<garden-action>`,
  `<garden-animation>`, and `<garden-button target>`. A JS engine (Jint) is a
  possible later add-on.
- **Non-standard CSS.** Garden styles use invented properties (`colour:`), so
  `Garden.Contract` needs a small permissive CSS parser (the TS side uses
  `cssjson`), not AngleSharp.Css, which drops unknown properties.

### Projects (new repo, sibling folder `juel-garden-grotto/`)
```
JuelGarden.Grotto           Stride runtime (library): one component per element, SceneBuilder → entities.
                            References ../parterre/Garden.Contract.
JuelGarden.Grotto.Player    The exe shell: loads an embedded or adjacent scene, input, window.
JuelGarden.Grotto.Build     No Stride reference: compiles assets, runs `dotnet publish` on
                            the player with the scene embedded. Called by Parterre.Cli.
JuelGarden.Grotto.Tests     MSTest: loader/component tests over the conformance set.
```

### Element difficulty in Stride

| Tier | Elements | Notes |
|---|---|---|
| **Easy** | `scene` `camera` `light` `box` `sphere` `cylinder` `torus` `plane` `ground` `material` `texture` `sky` `sound` `clone` `replicate` | Stride primitives, PBR materials, skybox, audio. |
| **Port the geometry** | `polygon` `lathe` `line` `wall` `opening` `room` `structure` `stairs` `roof` `house` `semi-house` `column` `height-map` | The TS mesh code is plain maths, so port it to C# vertex/index buffers. This tier makes Parterre output run natively and is the main target. |
| **Medium** | `mesh-model` (`.glb` via the asset pipeline; `.babylon` → convert or drop) `animation` `action` `waypoint` `text` `sprite` `particle` | Stride animation, UI and particles cover most of it. |
| **Hard / later** | `boolean` (needs a C# CSG library) · `info` / `button` / `HtmlTexture` (no HTML renderer, so rebuild on Stride UI) · `gizmo` (editor-ish) · `webxr` → **OpenXR** (Stride supports it) · `canvas` | Marked `Runtime.Web` only in the registry until done. |

### Phases
- **B0 Spike: `basic.html` runs natively (≈ one working session).** Detailed
  step plan: **`GROTTO-SPIKE.md`**. **✅ Done 2026-09-27**: `basic.html` matches
  the browser (see the Results section there and `juel-garden-grotto/README.md`).
  Stack: Stride 4.3 + toolkit preview.62 on .NET 10. Exit
  test: `juel-garden/examples/Basic/basic.html`, **unmodified**, loads in a
  code-only Stride app and matches the Babylon render. That needs:
  - the elements `scene`, `camera` (arc, `position`), `light` (default
    hemispheric → Stride ambient + directional), `element parent` (group
    transform), `box`, `sphere` (`diameter`), `cylinder` (`diameter`,
    `height`), and `ground` (`width`, `height`, `colour`);
  - the `colour:` rules in `<style id="garden-styles">` (any selector; a rule
    overrides the attribute, as in the browser);
  - **handedness:** Babylon is left-handed, Stride right-handed, so negate Z
    on positions and flip the sign of X/Y rotations. Getting this right on
    the box's `rotation="0 45 0"` is the test;
  - an arc-rotate camera (orbit on drag, zoom on wheel), so it *feels* like
    the web version.

  It's verified by running it and comparing a screenshot with the same page in
  Chrome. The parser is a throwaway inside `juel-garden-grotto/` (it moves to
  `Garden.Contract` in B2). Also confirm here which .NET version current Stride
  targets (it may lag .NET 10; `Garden.Contract` should then target the lower
  one too), check Linux/macOS runtime status, and confirm headless builds work
  for CI.
- **B1 Contract spec:** must first settle what B0 found: `rotation` units
  (Juel Garden mixes degrees and radians by code path), whether `garden-styles`
  rules keep overriding attributes, and how hemispheric lighting is promised
  (Grotto matches it closely but not exactly on specular highlights).
  Then: `juel-garden/CONTRACT.md`. The element list,
  attributes, types, units, defaults and coordinate system (Babylon is
  left-handed Y-up; Stride is right-handed Y-up, so the contract fixes one and
  runtimes convert), the `garden-*` meta tags, and the per-runtime support
  columns. This is the real deliverable: the language every runtime
  implements.
- **B2 `Garden.Contract` + `parterre check`:** model, registry, meta parsing
  and validator, tested against `examples/**`. Generate Juel Garden's
  "unsupported element" stubs from the registry.
- **B3 → B6 are tracked per example** in `juel-garden-grotto/EXAMPLES.md`
  (waves 0–7 over all 30 `examples/**`, with a double-click launcher for each).
- **B3 Runtime MVP:** Easy tier. `examples/Basic/*` renders natively via
  `parterre run --target grotto`.
- **B4 Structures:** geometry tier. **Flagship demo:**
  `parterre plan.svg --target grotto -o Museum.exe` gives a native
  walk-through.
- **B5 Build/bake:** a self-contained single-file exe with models and textures
  pre-compiled.
- **B6 Interaction + VR:** actions, animations, waypoints, text/UI; OpenXR
  headset mode; the first grotto-only features (e.g. physics), still as
  `<garden-*>` tags.

### Parity
A **conformance set**: `examples/**` plus Parterre samples, each noted as
supported, partial or unsupported per runtime (generated from the registry by
`parterre check`). It's checked by looking at the two side by side at first,
and by screenshot diffing later. The lasting cost of Track B is keeping two
runtimes in step, and the registry is how that stays visible.

---

## Decisions taken
- The HTML is the language. **Parterre is the compiler**: it reads the scene,
  checks it against the support registry, and dispatches to a backend. The
  Parterre library itself stays AngleSharp-only.
- **One vocabulary:** `<garden-*>` tags for every runtime, with no
  runtime-specific prefixes. Features move between runtimes without renames.
- **Support registry** in `Garden.Contract` records which runtimes implement
  each element and attribute. It drives validation, `parterre check`, the
  conformance set, and Juel Garden's unsupported-element stubs.
- **Scene settings are `<meta name="garden-*">`**, all optional:
  `garden-runtime` (required runtimes, first = preferred) now,
  `garden-contract` and others as needed. No DOCTYPE.
- Native runtime: **Juel Garden Grotto** (`grotto`), on Stride (not
  MonoGame). It loads the HTML into typed C# components. No C# codegen;
  assets are compiled.
- `Garden.Contract` lives in the parterre repo and is shared with Grotto.
- Track A (WebView player, `.garden` archive) first. It shares its container
  library and player with Jetty.
