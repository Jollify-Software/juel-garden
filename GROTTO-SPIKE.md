# Juel Garden Grotto — B0 spike: `basic.html` natively

Phase B0 of `NATIVE-PLAN.md`, in detail. Written 2026-09-27. **Status: done 2026-09-27.** See [Results](#results).
Code: `C:\Jollify\juel-garden-grotto\`.

**Goal:** `juel-garden/examples/Basic/basic.html`, **unmodified**, opens in
a native Stride window and looks like the Babylon version: same objects,
sizes, positions, colours and framing, and an orbit camera that feels the
same. Lighting only has to be *close*, because the two engines shade
differently.

**Not in scope:** Parterre integration, `Garden.Contract`, the support
registry, packaging/single-file exe, any element beyond the seven below.
The HTML reader is throwaway; it's rewritten properly in B2.

---

## Does Parterre compile it?

**Not in B0.** The runtime *loads* HTML rather than being generated from it,
so the spike needs no compiler:

```
JuelGarden.Grotto.Player.exe C:\Jollify\juel-garden\examples\Basic\basic.html
```

Parterre joins later, and even then it validates and packages; it never
generates C#:

| Phase | Parterre command | What it does |
|---|---|---|
| B2 | `parterre check basic.html` | validate against the support registry |
| B3 | `parterre run basic.html --target grotto` | check, then launch the Player on the file |
| B5 | `parterre build basic.html --target grotto -o Basic.exe` | check, pre-compile assets, `dotnet publish` the Player with the scene embedded |

---

## What `basic.html` needs

```html
<style id="garden-styles">
  garden-box { colour: #4CC3D9; } garden-sphere { colour: #EF2D5E; } garden-cylinder { colour: #FFC65D; }
</style>
<garden-scene>
  <garden-camera position="0 1 4"></garden-camera>
  <garden-light></garden-light>
  <garden-element parent position="0 -1.5 0">
    <garden-box      position="-1 0.5 -3"  rotation="0 45 0"></garden-box>
    <garden-sphere   position="0 1.25 -5"  diameter="2.50"></garden-sphere>
    <garden-cylinder position="1 0.75 -3"  diameter="1" height="1.5"></garden-cylinder>
    <garden-ground   position="0 0 -4"     width="4" height="4" colour="#7BC8A4"></garden-ground>
  </garden-element>
</garden-scene>
```

| Element | Web behaviour (from `juel-garden/src`) | Stride mapping |
|---|---|---|
| `garden-scene` | Babylon scene, default clear colour `(0.2, 0.2, 0.3)` | Root scene; set the clear colour to match |
| `garden-camera` | `ArcRotateCamera` (default `type="arc"`), target `(0,0,0)`; `position` via `setPosition()` re-derives alpha/beta/radius; FOV 0.8 rad | Camera entity + a custom **ArcRotate** script (drag = orbit, wheel = zoom), vertical FOV 0.8 rad |
| `garden-light` | `HemisphericLight`, direction `(0,1,0)`, intensity 1 | Ambient light + a soft directional light from above (approximation) |
| `garden-element` | `TransformNode` with position/rotation/scale; children parented | Empty entity with a transform; children parented |
| `garden-box` | `CreateBox`, default size 1 (`width`/`height`/`depth`) | Cube primitive |
| `garden-sphere` | `CreateSphere`, `diameter` | Sphere primitive, radius = diameter/2 |
| `garden-cylinder` | `CreateCylinder`, `diameter`, `height`, centred | Cylinder primitive |
| `garden-ground` | `CreateGround`: `width` (x) × `height` (z), flat on y = 0 | Plane primitive, normal +Y, size (width, height) |
| `colour` | `StandardMaterial` diffuse; a `garden-styles` rule **overrides** the attribute (applied with `setAttribute` after parsing) | Material with a diffuse colour |

### ⚠ Found while planning: rotation units in Juel Garden
`GardenElement.ts:34` parses `rotation` with `Vector3Convert.fromString`, which
gives **radians**. But the doc comment (`GardenElement.ts:13`) says
**degrees**, and a degrees converter (`Vector3Convert.rotationString`)
exists and is used elsewhere. So in the browser today, `rotation="0 45 0"`
turns the box by **45 radians (≈ 58.3°)**, not 45°.

The spike should match **what the browser actually does** (radians), so the
comparison is fair. Then, before B1 fixes the contract, decide: fix Juel
Garden to use degrees (matching its docs; every existing scene using
`rotation` changes), or document radians. This is exactly the kind of
difference writing the contract exists to catch.

---

## Stack (checked against NuGet, 2026-09-27)

| Choice | Version | Why |
|---|---|---|
| Stride | **4.3.0.2507** (stable, `net10.0`) | Latest stable engine. 4.4 is still beta. |
| Stride Community Toolkit | **1.0.0-preview.62** (+ `.Windows`, which pulls `Stride.Core.Assets.CompilerApp` 4.3.0.2507) | The toolkit build that pairs with Stride 4.3. (`1.0.2` on NuGet targets Stride 4.2 / `net8`, and `.63+` need Stride 4.4 betas.) |
| .NET | **10** (SDK 10.0.400 installed) | Required by Stride 4.3. |
| HTML | AngleSharp 1.3.0 | Same as Parterre. |

**Fallbacks** if the toolkit fights back: (1) plain Stride 4.3 plus
`Stride.Core.Assets.CompilerApp`, writing the ~100 lines the toolkit saves;
(2) Stride 4.2.1 + toolkit preview.60 on `net8.0`.

**Knock-on:** Parterre is `net8.0`. When `Garden.Contract` is built (B2) it
must be usable from both, so either multi-target it (`net8.0;net10.0`) or move
Parterre to `net10.0`. Decide in B2, not now.

---

## Project layout

```
C:\Jollify\juel-garden-grotto\          (new repo, git init)
  JuelGarden.Grotto.sln
  JuelGarden.Grotto.Player\             exe, net10.0 (Windows)
    Program.cs                          args: <scene.html> [--screenshot out.png] [--size 1280x720]
    SceneReader.cs                      THROWAWAY: AngleSharp → simple node tree
    GardenStyles.cs                     THROWAWAY: element-selector rules with custom props (colour:)
    SceneBuilder.cs                     node tree → Stride entities (one method per element)
    Coords.cs                           the ONE place Babylon (LH) ↔ Stride (RH) conversion lives
    ArcRotateCamera.cs                  SyncScript: alpha/beta/radius orbit around a target
    Screenshot.cs                       render N frames, save the back buffer, exit
  README.md
```

No `Runtime` / `Build` / `Tests` split yet: that's B2/B3 once the approach is
proven. `SceneBuilder` + `Coords` + `ArcRotateCamera` are the pieces that
survive into the runtime library, named plain `JuelGarden.Grotto` (split
out from the Player 2026-09-27).

---

## Coordinates (the fiddly bit)

Babylon is **left-handed**, Stride **right-handed**, both Y-up.

- **Position:** `(x, y, z)` → `(x, y, −z)`.
- **Rotation:** mirroring Z flips the sense of rotation about X and Y, and keeps
  it about Z: `(rx, ry, rz)` → `(−rx, −ry, rz)`. Babylon applies Euler angles as
  yaw(Y)·pitch(X)·roll(Z), so build the Stride quaternion explicitly with
  `Quaternion.RotationYawPitchRoll` rather than trusting a property's axis
  order.
- **Camera:** web `position="0 1 4"` looking at the origin becomes a Stride
  camera at `(0, 1, −4)` looking at the origin. The objects then sit at
  +Z beyond it, as the web version shows them beyond the origin.
- **Test:** the box's `rotation="0 45 0"` must face the same way as in the
  browser screenshot (see the rotation-units note above).

All of it lives in `Coords.cs`, so if the mapping turns out wrong, it's fixed
in one file.

---

## Steps

| # | Step | Est. | Done when |
|---|---|---|---|
| 1 | **Hello box.** Create the repo and Player project with Stride 4.3 + toolkit preview.62; open a window with one cube, camera and light. First restore downloads a lot. | 30–45 min | A window shows a lit cube. **Gate:** if still failing after ~1 h, switch to fallback (1). |
| 2 | **Scene reader (throwaway).** Walk `<garden-scene>` descendants into a small node tree: tag, attributes, children. Parse `"x y z"` vectors, numbers, and `#hex`/named colours. `GardenStyles` reads `<style id="garden-styles">` element-selector rules; attribute beats rule. | 30 min | A console dump of `basic.html` shows every node with its resolved colour. |
| 3 | **Scene builder.** One method per element (table above), children parented under `garden-element`, all positions and rotations through `Coords`. Clear colour `(0.2, 0.2, 0.3)`. | 45 min | The objects appear in roughly the right places. |
| 4 | **Arc camera.** A `SyncScript` holding alpha/beta/radius around the target (origin). Initialise from the camera `position` the way Babylon's `setPosition()` does. Left-drag orbits, wheel zooms, beta is clamped. FOV 0.8 rad. | 30 min | Framing on launch matches the browser, and orbit/zoom feel similar. |
| 5 | **Screenshot mode.** `--screenshot out.png` renders ~10 frames at `--size` (default 1280×720), saves the back buffer, and exits. Makes comparison repeatable and CI-ready. | 20 min | `grotto.png` is written without anyone touching the window. |
| 6 | **Reference and compare.** Screenshot `basic.html` in Chrome at 1280×720 (headless `--screenshot` or the Chrome extension); put both side by side; fix positions/sizes/colours/framing until they agree. | 20–40 min | Differences are down to lighting/shading only, and those are listed. |
| 7 | **Write up.** Record the Stride/toolkit decision, the confirmed coordinate mapping, the rotation-units finding and any lighting gaps back into `NATIVE-PLAN.md`; add a short README. | 15 min | The plan reflects what was learned. |

**Total: about 3–4 hours** including the comparison. Step 1 carries most of
the risk, because Stride's asset compiler runs at build time and first-time
setup can be fussy. That's why it has an explicit gate.

---

## Acceptance

- [ ] `JuelGarden.Grotto.Player.exe …\basic.html` opens a window with the
      box, sphere, cylinder and green ground, in the right colours.
- [ ] Side-by-side screenshots (`web.png`, `grotto.png`) agree on layout,
      scale, colours, framing and the box's orientation.
- [ ] Drag orbits and wheel zooms around the origin, like the browser.
- [ ] `basic.html` is not edited.
- [ ] Lighting differences and anything else not matched are **listed**, not
      hidden.
- [ ] Findings (Stride version, coordinate mapping, rotation units) are written
      back into `NATIVE-PLAN.md`.

## Risks

| Risk | Mitigation |
|---|---|
| Toolkit preview / asset compiler won't build | Gate at step 1; fallbacks (1) and (2). |
| Lighting looks different (Babylon hemispheric + StandardMaterial specular vs Stride PBR) | Out of scope to match exactly; tune ambient/directional, list what differs. B1 decides what the contract promises about lighting. |
| Rotation-units ambiguity | Match the browser's current behaviour (radians) for the spike, and flag it for B1. |
| Iris Xe GPU / D3D11 | Expected fine; if not, try Stride's Vulkan or OpenGL backend. |

---

## Results

**Done 2026-09-27, in one session.** The code is in
`C:\Jollify\juel-garden-grotto\` (not committed yet); the README there has
the screenshots.

- **Step 1 gate passed first time:** Stride 4.3.0.2507 + toolkit
  1.0.0-preview.62 on .NET 10 builds and renders on the Iris Xe (D3D11).
- **Match:** with `--rotation-units radians`, layout, sizes, colours,
  framing, mirroring and the box's orientation are identical to headless
  Chrome at 1280×720. Flat faces are within about 1–4/255, about 98% of
  pixels are within 8 levels, and silhouettes differ only at anti-aliased
  edges.
- **Orbit/zoom:** verified by an automated drag + wheel (screenshot
  `docs/basic-grotto-orbit.png`). The drag direction/speed hasn't been
  compared against the browser by hand.
- **Remaining visible difference:** the sphere's highlight is softer and
  pinker than Babylon's white Blinn-Phong hotspot.

### What changed from this plan
- **Lighting:** "ambient + directional, approximate" wasn't good enough.
  Stride lights in **linear** space and Babylon in **gamma**, so the
  hemispheric curve `(0.5 + 0.5·N·up)^2.2` is fitted with ambient + a light
  from above + a **negative** light from below (Stride accepts negative
  intensity), compensating for the diffuse energy the specular lobe takes.
  `PreferredColorSpace = Gamma` has no effect in code-only Stride, because the
  effects are compiled for linear.
- **Materials:** the toolkit's `CreateMaterial` produces a metallic look (black
  sides). Replaced with a custom Lambert + Blinn-Phong microfacet material
  (`Materials.cs`).
- **Primitives:** Stride's own procedural models (`CubeProceduralModel`, …)
  instead of the toolkit's `Create3DPrimitive`, whose size rules are
  heuristic.
- **Style precedence** is the reverse of what this plan assumed: rules override
  attributes.
- **Rotation units:** the cause is narrower than noted above. The first build
  reads **degrees** (`ModifyRotationSetter`), and `update()` re-applies
  **radians**. `basic.html`'s box is styled, so it gets `update()` and ends up
  in radians. Grotto defaults to degrees; `--rotation-units radians`
  reproduces the browser.
- Added `--settle-frames` (for driving input before a screenshot).
