# Design: curved walls, room wall composition, sensible default materials

Status: **PR 1 + PR 2 + PR 4 committed in juel-garden (branch
`feature/curved-walls`); PR 3 committed in Parterre (branch
`feature/curved-walls`). All four PRs done; neither branch merged or pushed.**
Spans two repos — juel-garden (the component contract) and
[Parterre](../parterre) (the generator that emits it). Parterre's `TODO.md`
milestone 2 ("real walls") depends on this; the "decide the juel-garden side
first" note there is resolved by this document.

**Done so far**

- **PR 1** — `GardenRoom.COLORS` neutral palette + matte specular + opt-in
  `debug-colors`; `GardenGround` default grass colour. Files:
  `src/Components/Prefab/Room.ts`, `src/Components/Ground.ts`.
- **PR 2** — `<garden-wall>` (`src/Components/Prefab/Wall.ts`) with a standalone
  `points` mode and a `slot="north|east|south|west"` room mode; `<garden-room>`
  `type="rotunda"` and curved wall slots; shared geometry in
  `src/Utils/Mesh/createWall.ts` (`createWall` + `arcPoints`). Registered in
  `juel-garden.ts`. Examples: `examples/Structures/curved-wall.html`,
  `examples/Structures/rotunda.html`. Also fixed: `<garden-opening>` now re-runs
  `GardenRoom.fixMaterialIndices()` after its CSG cut (a cut doorway reveal was
  coming out wearing the floor material).
  Verified with a headless (Playwright/SwiftShader) render pass — both new
  scenes and `temple.html` / `museum.html` (regression) build clean, no page
  errors.

**Deviations from the original plan below**

- `<garden-wall>` geometry is single-sided (`FRONTSIDE`), **not** `DOUBLESIDE`:
  the extruded tube already has inner + outer + top + bottom faces, and
  `DOUBLESIDE`'s doubled coincident triangles z-fight badly once
  `<garden-opening>` / `<garden-structure>` run CSG on the wall. Materials keep
  `backFaceCulling = false` as a winding safety net.
- A room with **any** curved wall slot (and the rotunda) uses a **two-slot**
  material model — `[floor, wall]`, one wall colour / `<garden-material
  slot="wall">` — instead of the five-way per-face model. The four sides are
  swept as **one closed centreline loop** (like the rotunda), which has no end
  caps or corner seams to z-fight; four separately-capped walls butted together
  did. Per-face wall materials stay a plain-box feature. `fixMaterialIndices`
  splits floor vs. wall by height for this model; the five-way geometric
  classifier is unchanged for plain boxes.

---

## Goals

1. A **wall** can be straight or curved.
2. A **room** is composed of any mix of wall types: 4 straight (today),
   3 straight + 1 curved (an apse / bow), or all 4 curved (a rotunda).
3. Rooms and standalone walls both **fit inside a `<garden-structure>`** and
   sit on the same floor datum, at the same height, as existing rooms.
4. Room floors and walls get **sensible realistic default materials** instead
   of the current axis-debug colours (floor black, N green, E red, S blue,
   W yellow).

Naming: the live custom-element prefix is `garden-`. (`juel-*` is the sibling
UI library, not this one.)

---

## Element model

### `<garden-wall>` — new, `src/Components/Prefab/Wall.ts`

Extends `GardenMesh`. One geometry core (extrude a rectangular cross-section
along a `Path3D`), two ways of being used:

**Mode 1 — standalone** (a `<garden-structure>` sibling; an interior partition;
a colonnade; a garden/boundary wall):

| Attribute   | Default                  | Meaning |
|-------------|--------------------------|---------|
| `points`    | —                        | Centreline polyline, `x y z, x y z, …`, parsed by `Vector3Convert.array` (also accepts `Shape.xxx()` expansions). Authored on the floor plane. |
| `height`    | `GardenRoom.WallHeight` (6) | Wall height, so a bare wall matches a bare room. |
| `thickness` | `GardenRoom.WallThickness` (0.2) | |
| `curve`     | `0`                      | Sagitta: bend a 2-point wall into an arc, `+` bulging one side / `−` the other. Ignored when `points` has > 2 entries. |
| `smooth`    | off                      | Run `points` through `Curve3.CreateCatmullRomSpline` (same as `BehaviourTrack`'s `track-smooth`). Hand-author convenience only — Parterre flattens curves itself. |
| `closed`    | off                      | Close the polyline into a loop. |
| `colour` / `<garden-material>` / `collisions` | — | Inherited `GardenMesh` behaviour, already works via `setMesh`. |

**Mode 2 — a room wall slot** (`slot="north|east|south|west"`, child of
`<garden-room>`): the room supplies the edge endpoints, so `points` is not
needed. The wall carries only shape modifiers:

- `curve` — sagitta across that edge (`+` outward from room centre, `−` inward).
- `radius` + `segments` — precise arc instead of a sagitta.
- `points` (optional) — a fully custom edge, expressed in the room's local space.

A straight wall is the 2-point degenerate case, so a default room wall,
`curve="0"`, and a slotted arc all run through the same builder and produce
consistent meshes.

**Build** (`updated()`, synchronous like `GardenRoom` so `<garden-structure>`
can read the mesh straight away):

1. Resolve the centreline: `points` (mode 1) or edge endpoints + `curve`/`radius`
   (mode 2); optional spline smoothing; sample any arc to a polyline.
2. `Path3D` from the polyline.
3. Rectangular profile in the local xOy plane: `thickness` wide, `height` tall,
   rising from `y = 0`.
4. `MeshBuilder.ExtrudeShape("wall", { shape, path, cap: Mesh.CAP_ALL }, scene)`
   (single-sided — see the deviations note above).
5. `setMesh(...)`, then the `<garden-material>` slot path.

**Register** — add `import "./src/Components/Prefab/Wall.ts";` to the root
`juel-garden.ts`. (Forgetting this has bitten new components before; explicit
step, confirmed by a browser check.)

### `<garden-room>` — wall slots + `type`

Keeps `width` / `depth` / `height` / `thickness` and full back-compat (a room
with no children builds 4 straight walls + a slab floor exactly as today).

New:

- **`type`** — `"rect"` (default) or `"rotunda"`.
  - `type="rect"` — box footprint, plus the N/E/S/W wall slots below.
  - `type="rotunda"` — circular footprint: a disc/cylinder-slab floor plus one
    swept open-top cylindrical wall. Reuses `width` (or a `diameter` alias) and
    `height`. One wall mesh; inside/outside materials via slots (below).
  - reserved for later: `type="apse"`, `type="freeform"` (an explicit closed
    `<garden-wall>` loop with an earcut floor). Not built now — the `type`
    switch just reserves the space.
- **Wall slots** `north` / `east` / `south` / `west`, mirroring the existing
  `<garden-material slot="…">` idiom. A `<garden-wall slot="north">` child
  replaces that side's geometry; an empty side falls back to the default
  straight box.

```html
<garden-room width="10" depth="8" height="6">
  <garden-wall slot="north" curve="2"></garden-wall>          <!-- bowed out -->
  <garden-material slot="floor" colour="#9c968c"></garden-material>
</garden-room>

<garden-room type="rotunda" width="12" height="7"></garden-room>
```

Build order (as built): a plain box room takes the unchanged five-box path. A
room with any wall slot (or `type="rotunda"`) instead concatenates the four
side centrelines — each side's slotted `<garden-wall>` arc, or a straight
segment — into **one closed loop**, sweeps it as a single `createWall`, and
merges `[floor, wall]`. See the deviations note at the top for why one closed
sweep beats four butted walls.

**Floor**: when any slot wall is curved (or `type="rotunda"`), the floor is the
wall-loop polygon (`PolygonMeshBuilder` + earcut, as `Stairs.ts` does) so it
follows the curved edge. Plain box rooms keep the `width`×`depth` slab; the
rotunda uses a cylinder slab.

**Material-index classification**: unchanged five-way geometric classifier for
plain boxes. The two-slot model (curved-slot room / rotunda) splits floor vs.
wall by submesh height instead. `<garden-structure>` and now `<garden-opening>`
both re-run `fixMaterialIndices` after each CSG cut.

### `<garden-structure>` — doorway joins

Three automatic paths in `connect()`, tried in order, then the original box test:

1. **`tryFloorOpening`** — a whitelisted vertical connector (`<garden-stairs>`)
   reaching a room's floor slab. (pre-existing)
2. **`tryWallCrossing`** (PR 4) — exactly one of the pair is a `<garden-wall>`;
   its world-space centreline is walked and, where a segment crosses another
   child's (x,z) box boundary, an `opening-*` box is CSG-cut through both.
3. **`tryCurvedRoomJoin`** (PR 4 follow-on) — at least one of the pair is a
   `GardenRoom` carrying a `wallLoop` (a curved-slot room or a rotunda; a plain
   box room has none). That room's outline is walked in world space; each loop
   segment that runs within a thin shell of the other room's outline (its own
   `wallLoop` if it has one, else its box) for at least `~openingWidth*0.4` gets
   one doorway cut at the shared span's midpoint. So a curved-outline room
   auto-joins a neighbour even though its bounding box bulges past its wall.
4. Falls through to the box-vs-box test (two plain box rooms, stairs).

`GardenRoom.wallLoop` (new, public) is the open local-space centreline ring,
set by `buildWithWallSlots` / `buildRotunda`, `undefined` for box rooms.

Still needs a hand-placed `<garden-opening between="#a #b">`:

- two **rotundas**, or a rotunda meeting another room only at a tangent that's
  shorter than the min-run threshold;
- a `curvature` stairway or a dome roof (rotated/curved, no loop to walk).

Parterre also emits `<garden-opening>` from `data-fixture="opening"` rects (a
later milestone) for anything the automatic paths miss.

---

## Geometry notes / gotchas

- **`ExtrudeShape` frame flip / twist** on near-vertical or sharply reversing
  paths. Floor-plan walls live in the horizontal plane and curve gently, so
  this is safe; pass a stable first normal (`Vector3.Up()`) if artefacts show.
- **Keep `<garden-wall>` single-material initially.** A two-face
  (inside/outside) wall would hit the same `MergeMeshes` + `MultiMaterial` +
  CSG submesh/materialIndex scramble that `GardenRoom.fixMaterialIndices`
  exists to work around.
- **Nested custom-element update ordering** — use
  `GardenElement.whenDocumentReady` before reading any `<garden-material>` /
  `<garden-wall>` slot child (the race already documented for
  `garden-material`).
- **`file://`** — examples must be served over HTTP (`npm run examples`);
  Chromium blocks juel-garden / Babylon asset + worker loads under `file:`.
- **`<garden-opening>` on a curved wall** needs a generous `depth`. The cutter
  is an axis-aligned box; a rotunda/apse wall curves away from the doorway
  plane, so a thin cutter only punches through at the very centre. `rotunda.html`
  uses `depth="2"` on a 16-wide drum.
- **`<garden-roof>` `clip`** (default on) trims the dome/flat roof's flat base
  caps to a curved room's real footprint (`GardenRoom.wallLoop`, via a new
  `outline` param on `createDomeRoof` / `createBaseCap`) so a square cap doesn't
  hang past a round wall. `clip="false"` keeps the rectangular cap. Only the
  single-curved-room case is clipped under a `<garden-structure>` (a multi-room
  union would need real polygon-union); box-room structures are untouched, so
  temple/museum roofs are byte-for-byte unchanged.

---

## Default materials

**juel-garden `GardenRoom.COLORS`** → neutral architectural palette (all four
walls the same colour; the four slots stay separate so a wall can still take
its own texture):

| Surface | Was    | New (proposed) |
|---------|--------|----------------|
| floor   | black  | `#9c968c` warm stone-grey (or `#b39268` timber) |
| N/E/S/W | green/red/blue/yellow | `#e0dcd3` off-white plaster |

Also set `specularColor ≈ #0a0a0a` on these defaults so surfaces read matte
(the dome inside-shell already learned this in `Roof.ts`). Optional
`debug-colors` attribute on `<garden-room>` to restore the axis colours for
development.

**`GardenGround`** — give it a built-in default `diffuseColor` (muted grass
`#6b8f4e`) when no `colour` / material is set, instead of relying on the caller.

**This is a visible change to every existing scene** that used the debug
colours (temple.html, structure examples, …). Audit `examples/` for rooms
without explicit colours and re-verify in the browser.

---

## Parterre changes (`../parterre`)

### Curved-wall geometry

1. **`Parterre/Geometry/SvgPath.cs`** (new) — parse a `<path>` `d` string into
   subpaths and flatten to polylines. Support `M/m L/l H/h V/v Z/z`, `C/c S/s
   Q/q T/t` (béziers, De Casteljau), `A/a` (elliptical arc → centre
   parametrisation → sample). Hand-rolled (~150 lines) to keep the repo
   AngleSharp-only. Flattening by fixed segments per command (≈16) or
   chord-error tolerance, exposed as `--curve-segments`.
2. **`WallFixture.Render`** — when `fixture.PathData` is set: parse → map each
   point with `context.ToScene` → emit `<garden-wall id=… points="x y z, …"
   height=… collisions>`, one element per subpath. Keep the `<rect>`/`<line>`
   branch (optionally route it through `<garden-wall>` as a 2-point polyline
   for consistency).
3. **`transform`** support stays a separate milestone-2 item.

### Room wall composition

`RoomFixture` grows a branch that inspects the fixture group's children:

- plain `<rect>` → `<garden-room>` (unchanged).
- `<g data-fixture="room">` with child geometry tagged
  `data-edge="north|east|south|west"` → `<garden-room>` + `<garden-wall
  slot=…>` children (child `<path>` → curved, `<line>`/omitted → straight).
- room drawn as a single `<circle>` / `<ellipse>` → `<garden-room
  type="rotunda" width=…>`.
- one closed `<path>` mixing lines and arcs → warn for now (`type="freeform"`
  later).

One fixture still maps to one element; the dispatch table is untouched.

### Materials

- `RoomFixture` already emits no colours → inherits the new component
  defaults; nothing to change once juel-garden ships them.
- `WallFixture` — stop hardcoding `#b7b7b7`; emit `colour` only when the SVG
  element carries a real `fill`.
- `GenerationOptions` — change `GroundColour` from `#7BC8A4` to something
  realistic (`#6b8f4e` grass, or `#9e9a92` paving for interior venues); add
  optional `FloorColour` / `WallColour`.
- An explicit SVG `fill` is author intent and always wins; absent, inherit the
  component default.

### Docs / samples

- README schema table: `wall` now supports `<path>`; document `data-edge` on
  room children and the `<circle>` → rotunda mapping.
- `TODO.md`: tick milestone-2 boxes as they land.
- New `samples/curved-wall-plan.svg` (an apsidal gallery); the
  Ickworth / Kedleston curved colonnades in `samples/reference/` are the real
  targets.
- Start `Parterre.Tests` with a path-flattening fixture.

---

## Sequencing

| PR | Repo | Scope |
|----|------|-------|
| 1 | juel-garden | **DONE (uncommitted).** Sensible room + ground default materials. `GardenRoom.COLORS`, matte specular, `GardenGround` default, opt-in `debug-colors`. `museum.html` / `temple.html` set materials explicitly so are visually unaffected. |
| 2 | juel-garden | **DONE (uncommitted).** `<garden-wall>` (both modes) + `<garden-room>` wall slots + `type="rotunda"` + two-slot `fixMaterialIndices` + curved-wall-follows floor. Registered in `juel-garden.ts`. `examples/Structures/curved-wall.html` + `rotunda.html`, camera-tuned, verified headless (Playwright). `<garden-opening>` fixMaterialIndices fix. `tsc` / `parcel` / `typedoc` all pass. |
| 3 | parterre | **DONE (uncommitted).** `Geometry/PathFlattener.cs` (M/L/H/V/Z, C/S/Q/T, A) + `WallFixture` `<path>` → `<garden-wall>` + `RoomFixture` `<circle>`→rotunda and `data-edge`→slot walls (with plan-north↔garden-south flip) + `GroundColour`/`WallFixture` material cleanup + `--curve-segments` + `samples/curved-wall-plan.svg` + README/TODO + new `Parterre.Tests` (19 tests, MSTest). juel-garden `buildWithWallSlots` insets the loop by `thickness/2` so a curved room's outer face matches a box room's for structure joins; `<garden-opening>` fix from PR 2 carried in. Verified: generated scene renders (Playwright) — 2 rooms auto-join, rotunda + apse + standalone curved wall all correct. |
| 4 | juel-garden | **DONE (committed).** `GardenStructure.tryWallCrossing` (a `<garden-wall>` piercing a room) **and** `tryCurvedRoomJoin` (a curved-outline room — curved-slot or rotunda, identified by its new `GardenRoom.wallLoop` — abutting another room). Both walk a real centreline instead of trusting the bulged bounding box, and CSG-cut an `opening-*` box through both meshes. Fall through to the box-vs-box test otherwise. `curved-wall.html` demos both (a curved entrance wall + a plain annex, each auto-joined to the apsidal gallery). No regression: temple/museum room vertex counts byte-for-byte unchanged (box rooms never enter either path). |

---

## Risks

- `ExtrudeShape` twist on non-planar / reversing paths — mitigated by keeping
  walls horizontal + a stable first normal.
- Forgetting the `juel-garden.ts` import line — explicit checklist step, caught
  by the browser check.
- Curved-wall ↔ room doorways need manual `<garden-opening>` until PR 4.
- Default-colour change ripples through existing examples — audit + browser
  pass required in PR 1.
- `fixMaterialIndices` geometric classifier breaks for strong curves — hence
  the name-tag approach in PR 2; keep the geometric path only for plain boxes.
