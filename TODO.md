# Examples audit log

Working through every file in `examples/` to confirm it loads without errors
and actually demonstrates what it claims to. Started 2026-08-25.

**Update 2026-08-25 (same day, second pass):** user flagged that camera
framing/zoom specifically still needed work. Went through every example's
`<garden-camera>` and worked out, from the actual content's attributes
(position/size/diameter/etc.), whether the camera as authored could
possibly show it. `ArcCameraStrategy`'s default (`radius=3`, target fixed
at the world origin `(0,0,0)`, non-configurable) turned out to be far too
tight for the content in several examples, and in a few cases the content
wasn't anywhere near the origin at all. See "Camera/zoom fixes" below for
the reasoning behind each one -- like the rest of this pass, this was
*not* visually verified (no browser access), so treat the numbers as
carefully-computed-from-first-principles rather than eyeballed.

**Caveat: this pass was code review only** -- the Claude Chrome extension
wasn't connected this session, so nothing below was actually driven in a
browser. Everything is verified by reading the example against the component
source it exercises (attribute names, types, control flow) and, for external
assets, by actually checking the URL responds. Bugs found this way and fixed
are marked FIXED; anything that still needs an eyeball in an actual browser
is called out explicitly.

How to reproduce: `npm run dev` (rebuilds `dist/juel-garden.js`), then
`npm run examples` and open the file under `http://localhost:8080/examples/...`.

## Bugs found and fixed this pass

- **`examples/Basic/wobble.html`** -- both external textures pointed at
  `www.synergy-development.fr`, which no longer resolves (`curl`:
  "Could not resolve host"). Swapped for textures already hosted on
  `playground.babylonjs.com`, which every other example already depends on
  staying up. FIXED.
- **`src/HtmlTexture.ts`** (used by `examples/Basic/html-texture.html`) --
  the element being rasterised was permanently moved into `document.body`
  (`document.body.prepend(el)`) and the captured snapshot `<canvas>` was left
  there too (`document.body.append(canvas)`), both without ever being
  removed. The `texture="html"` feature itself worked (the `DynamicTexture`
  is assigned to the material before capture, then just redrawn in place --
  the commented-out `mat.diffuseTexture = this.texture` line was dead code,
  not a bug), but every load left the source element and a stray canvas
  image visibly stuck at the top of the actual page, on top of the 3D scene.
  Now removed again once html2canvas is done with them. FIXED.
- **`src/Components/Canvas.ts`** (`<garden-canvas content="text">`, used by
  `examples/Basic/text.html` and `examples/Canvas/canvas-text.html`) --
  `p.y =+ 50` is `p.y = (+50)`, not `p.y += 50` -- a classic typo that
  silently discards any `point` attribute's y-offset before drawing the
  first line. Didn't visibly affect either current example (neither sets
  `point`, so the result was 50 either way), but is a real bug for anyone
  who does. FIXED.
- **`src/Components/Animation.ts` + `src/Converters/StaticConvert.ts`**
  (`<garden-animation type="skeleton">`, the whole point of
  `examples/Dynamic/MeshModel.html`) -- two compounding bugs meant this
  never worked: `StaticConvert.animationType` had no `"skeleton"` case at
  all (returned `undefined`), and separately `GardenAnimation.type` was
  typed/converted to a *number*, so even a correct case would never have
  matched `play()`'s `switch (this.type) { case "skeleton": ... }` (a
  string). `type` is now kept as a plain string end-to-end, with the
  Babylon numeric `ANIMATIONTYPE_*` conversion only applied where an actual
  `Animation` object is built (the non-skeleton branch). FIXED -- this is
  the highest-impact find, since the Dude model's walk-cycle animation is
  the entire content of that example.
- **`src/Components/Particle.ts`** (custom, non-`effect` particle systems --
  the fountain in `examples/Structures/basic-village.html`) -- three bugs:
  1. `this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE`
     referenced a bare global `BABYLON` that doesn't exist in this bundle
     (confirmed: no `window.BABYLON`/`globalThis.BABYLON` assignment
     anywhere in `dist/juel-garden.js`) -- this would throw
     `ReferenceError: BABYLON is not defined` the instant any custom
     particle system was built, i.e. every time the village fountain is
     clicked. Fixed to use the already-imported `ParticleSystem` class.
  2. `this.particleSystem.direction2 = this.direction1` -- copy-paste bug,
     both direction knobs were being set from the `direction1` attribute,
     collapsing the emission cone instead of randomizing between
     `direction1`/`direction2` as authored. Fixed to read `direction2`.
  3. `minAngularSpeed`/`maxAngularSpeed` were parsed as properties but never
     actually assigned onto the Babylon `ParticleSystem` -- wired up.
  All FIXED.
- **`examples/Basic/basic.html`** -- no camera `position`, so the default
  arc camera (radius 3, target the origin) was far too close to see this
  example's group of shapes (centred a few units out at roughly
  x=0,y=-0.5,z=-4). This is the exact issue the README's own TODO list
  already named ("camera needs to be rotated to see the scene"). Fixed by
  giving the camera an explicit starting `position` instead -- `rotation`
  genuinely isn't implemented on `<garden-camera>` (confirmed:
  `GardenCamera.updated()` never reads it), so that half of the README note
  is still accurate and left as a real gap, just no longer blocking this
  example. FIXED + README updated to match.

## Camera/zoom fixes (second pass, same day)

The default arc camera (`ArcCameraStrategy`) is `radius=3`, target hardcoded
to the world origin. Two independent ways that breaks a given example:
1. Content is bigger/further from the origin than radius 3 can show at all
   (worst case: the camera starts *inside* the mesh).
2. Content technically fits but with zero margin -- at radius 3 and Babylon's
   default vertical FOV (0.8 rad), the visible half-height is `3 * tan(0.4) =
   1.27` units, so a plain radius-1.25 sphere (diameter 2.5 -- extremely
   common size in these examples) fills the frame edge-to-edge with no
   breathing room.

`radius` is a real attribute (`OptionsBuilder`'s `radius` -> `FloatSetter`,
applied via `Object.assign` onto whatever camera `CameraTypeStrategies.build`
returns) -- it works for `type="arc"` exactly like it already does for
`type="follow"` elsewhere in these examples, moving the camera back along its
existing default viewing angle without needing to hand-pick x/y/z. Used that
where content is still centred near the origin; used an explicit `position`
instead where the content itself sits well away from the origin (since the
arc camera's target can't be moved off the origin at all -- lining the
camera up on the *other* side of the origin from the content, so both the
origin and the content fall along the same viewing ray, was the only way to
get it framed).

- `examples/Basic/gizmo.html` -- `radius="4.5"` (was edge-to-edge on the sphere).
- `examples/Basic/hollow.html` -- `position="0 1 -13"` (cylinder sits at the
  origin, but the split sphere is 5 units out in -z and was entirely
  out of frame).
- `examples/Basic/html-texture.html` -- `radius="18"` (camera started almost
  inside the 20x10 ground plane).
- `examples/Basic/split.html` -- `radius="35"` (sphere's own radius, 11.25,
  is bigger than the old camera radius -- camera started inside the mesh).
- `examples/Basic/wobble.html` -- `position="0 3 -11"` (the wobble
  deformation in `DuplicateVertices.ts` drifts the sphere's true centre by a
  hardcoded ~1.5 units on every axis on top of its own radius -- needs
  headroom for the drift, not just the resting pose).
- `examples/Canvas/canvas-svg.html` -- `radius="4"` (same edge-to-edge issue
  as gizmo.html).
- `examples/Behaviours/line.html` -- `radius="6"` (the 4x4 track loop's
  diagonal, ~2.8, barely fit).
- `examples/Behaviours/orbit.html` -- `radius="38"`. Non-obvious: the
  orbiting sphere's `position="2 0 8"` is read as *world*-space by
  `BehaviourOrbit` (the outer sphere has no `parent` attribute, so nothing
  ever reparents the inner one before it starts orbiting) -- it sweeps a
  full circle of radius ~8.25 around the origin, and at its own radius
  (5.125) the swept envelope reaches out to ~13.4 units. The old radius-3
  camera started almost inside the *central* sphere (radius 2.625) with the
  orbiting one essentially never in frame.
- `examples/Boolean/subtract.html` -- `position="0 4 -20"`. All three shapes
  sit directly above the origin (x=z=0, y from 0.5 to 7) -- the fixed target
  (the origin) was right at the bottom edge of the group. Matched the
  camera's own height to the group's vertical centre (~4) so the ray toward
  the origin also happens to pass through the content, instead of just
  barely catching its lower edge.
- `examples/Dynamic/MeshModel.html` -- `position="0 3 -12"` (default radius 3
  is far too tight for a human-scale rigged model).
- `examples/Structures/basic-village.html` -- `radius="90"` (150-unit
  heightmap terrain + matching skybox; camera used to start essentially
  buried in the ground at the origin).
- `examples/Structures/stairs.html` -- `radius="80"` (three staircases plus a
  box span roughly z=-30 to z=25; old camera showed empty space around the
  origin, nowhere near any of them).

Left alone (already had an explicit, apparently deliberately-tuned
`position`/`radius`/follow-camera setup): `text.html`, `canvas-text.html`,
`camera-collision.html`, `rollercoaster.html`, `waypoints.html`,
`webxr.html`, `action-manager.html`, `button-animation.html`,
`info-panel.html`, `buggy.html`, `car.html`, `museum.html`, `temple.html`.

Every `<garden-camera>` across all 25 examples now has an explicit
`position`, `radius`, or `type="follow"`/`"free"` with its own tuned
position -- none are relying on the bare `radius=3`-at-the-origin default
anymore. Still genuinely unverified visually -- see "Still to do" below.

## Known gap, not fixed (too large to do blind without a browser)

- **`examples/Dynamic/action-manager.html`** -- large parts of what it
  declares aren't implemented at all:
  - `<garden-action type="interpolate">` is a no-op (`case "interpolate": break;`,
    no `InterpolateValueAction` ever built) -- used repeatedly in this example
    for hover scale/emissive tweens.
  - `type="combine"`, `type="state"`, `type="nothing"` aren't handled by
    `GardenAction`'s `switch` at all -- silently produce no action.
  - `trigger="pick"`, `trigger="leftPick"`, `trigger="nothing"` aren't
    handled by `GardenAction.getTrigger()` (only `enter`/`exit`/`frame`/
    `pointerOut`/`pointerOver` are).
  - `<garden-condition>`, used throughout for the light-colour-dependent
    camera-flip behaviour, isn't a registered custom element anywhere in
    `src/` -- it just renders as an inert unknown element.
  - Net effect: the rotating donut and the two hover actions
    (colour-highlight, scale-pulse) work; picking a mesh to wireframe it,
    the light-swap-on-click, and the condition-gated camera flip do not.
  - This needs real feature work (an `InterpolateValueAction` case, a
    `CombineAction` case, pick/leftPick triggers, a `state` attribute read
    on `<garden-light>`/`<garden-condition>` as an actual element), not a
    one-line fix -- flagging rather than guessing at an implementation with
    no way to see whether it actually behaves as intended.

## Per-example status

Legend: OK = read the source, matches its component implementation, no
external asset problems found. FIXED = had a bug, now fixed (see above).
NEEDS BROWSER = code reads fine but depends on something (timing, layout,
WebXR hardware) that only an actual render can confirm.

### Basic
- [x] basic.html -- FIXED (camera position)
- [x] gizmo.html -- FIXED (camera radius, was edge-to-edge)
- [x] hollow.html -- FIXED (camera position, split sphere was out of frame).
      `hollow`/`split` are read via `hasAttribute`, not truthiness, so the
      bare boolean-style attributes work correctly.
- [x] html-texture.html -- FIXED (HtmlTexture.ts DOM leak; camera radius)
- [x] split.html -- FIXED (camera radius, was starting inside the mesh)
- [x] text.html -- OK (benefits from the Canvas.ts typo fix, though not
      visibly for this example's own default point; camera already tuned)
- [x] wobble.html -- FIXED (dead texture URLs; camera position for the
      wobble drift)

### Behaviours
- [x] camera-collision.html -- OK (camera already tuned)
- [x] line.html -- FIXED (camera radius)
- [x] orbit.html -- FIXED (camera radius, was inside the central sphere)
- [x] rollercoaster.html -- OK (BehaviourTrack is thoroughly commented with
      its own bug history; camera already tuned; nothing new found)

### Boolean
- [x] subtract.html -- FIXED (camera position, content sat above the
      fixed origin target)

### Camera
- [x] waypoints.html -- OK
- [x] webxr.html -- OK as a mouse/keyboard fallback; the actual VR/AR path
      needs a browser+HMD (or WebXR emulator) to verify, NEEDS BROWSER for
      that part specifically

### Canvas
- [x] canvas-svg.html -- FIXED (camera radius, was edge-to-edge)
- [x] canvas-text.html -- OK (camera already tuned)

### Dynamic
- [x] MeshModel.html -- FIXED (skeleton animation type bug; camera position)
- [x] action-manager.html -- see "Known gap" above; NOT fixed (camera
      already tuned)

### Gui
- [x] button-animation.html -- OK (camera already tuned)
- [x] info-panel.html -- OK (camera already tuned)

### Structures
- [x] basic-village.html -- FIXED (Particle.ts bugs affect the fountain
      here; camera radius, was buried in the ground)
- [x] buggy.html -- OK (BehaviourDrive/Suspension/Terrain/Flee all read
      cleanly; matches the fix history already in memory; follow camera
      already tuned)
- [x] car.html -- OK (follow camera already tuned)
- [x] museum.html -- OK (BehaviourWander reads cleanly; camera already tuned)
- [x] stairs.html -- FIXED (camera radius, layout was spread far past the
      old default view)
- [x] temple.html -- OK (camera already tuned)

## Still to do

- Nothing above was actually rendered -- once the Chrome extension is
  connected, a real visual pass is the priority now, specifically: every
  camera fix in the "Camera/zoom fixes" section above (all computed from
  the geometry on paper, none eyeballed -- some, like orbit.html and
  basic-village.html, involved enough estimation that the actual framing
  could still be off and worth a second tuning pass once visible),
  MeshModel.html's skeleton animation now actually playing,
  basic-village.html's fountain no longer throwing, wobble.html's new
  textures looking reasonable, and whether light-DOM text content like
  `<garden-text>`/`<garden-canvas>`'s own children ever becomes visible
  outside the 3D canvas (no CSS in the codebase hides it, but no example
  currently seems to suffer visibly for it either; worth a specific look).
- `examples/Dynamic/action-manager.html` needs real feature work (see
  above) before it demonstrates everything it declares.
- `src/Components/Prefab/Structure.ts:207` has a pre-existing `tsc` type
  error (an object literal passed as `AxisOverlap` is missing its `gap`
  field) -- harmless at runtime (`cutFloor` never reads `.gap`), left alone
  since Structure.ts is core to the already-verified temple/museum
  examples and not worth touching blind.

## 2026-08-25, real browser pass (Playwright/Chromium, headless)

Everything above was code-review-only guesswork. This pass actually
rendered all 26 examples (25 + a new `material.html`) via a headless
Chromium, read console/pageerror/requestfailed output, and screenshotted
each -- both before and after every fix below, plus a final full sweep
confirming all 26 load with zero console errors/warnings (aside from the
expected `makeXRCompatible`/`immersive-vr not supported` warnings on
`webxr.html`/`museum.html`/`temple.html`, unavoidable without real VR
hardware). Real bugs found and fixed, beyond what static review caught:

- **`src/Components/Prefab/House.ts` + `SemiHouse.ts`** -- both built their
  child `<garden-box>`/`<garden-cylinder>` via Lit's `render()`, but
  `GardenElement`/`GardenMesh`'s own `update()` override never calls
  `super.update()`, so Lit's render-into-renderRoot step silently never
  runs for *any* component in this library -- invisible everywhere else,
  since every other component builds children by hand (`document.createElement`),
  but fatal here: `this.firstElementChild` was always null, throwing
  immediately. This was the crash breaking `basic-village.html` entirely.
  Rewrote both to build their children imperatively instead of touching the
  wider (much riskier, blast-radius-unknown) `update()` chain.
- **`src/HtmlTexture.ts`** -- two bugs: (1) read `element.firstElementChild`
  on a bare `setTimeout(0)`, racing the parser actually attaching that
  child (crashed `html-texture.html` outright); (2) `ctx.drawImage(img, 0,
  0)` painted the html2canvas capture at its native pixel size in the
  corner of the (512x512) `DynamicTexture` instead of filling it, leaving
  the rest black -- the ground showed a tiny sliver of text on an otherwise
  black plane. Both fixed.
- **`src/Components/Action.ts`** -- same racy `setTimeout(0)` pattern
  resolving `parameter`/`target` selectors before the document had
  necessarily finished parsing; crashed `action-manager.html` (`#donut`
  declared after the `<garden-action>` that references it). Fixed with
  `whenDocumentReady()`, matching the pattern already used elsewhere.
- **`src/Components/DuplicateVertices.ts`** (`wobble.html`'s jelly effect)
  -- the reference sphere driving the deformation was hardcoded to
  diameter 25 regardless of the real mesh's size, blowing a diameter-2.5
  sphere out to ~10x too big and wildly mis-shapen. Fixed to read the real
  mesh's own size -- but naively via `boundingSphere.radius`, which turned
  out to be the radius of the sphere *circumscribing the bounding box*
  (overshoots an actual sphere's true radius by `sqrt(3)`), not the
  mesh's real radius -- second fix, using the bounding box's own
  half-extent instead, got it to the correct size.
- **`src/Components/Sky.ts`** -- the skybox was a normal finite-size cube,
  missing Babylon's standard `infiniteDistance = true`. Any camera further
  from the origin than half the box's `size` (easy on a large scene) ends
  up outside it entirely, seeing a bizarre close-up sliver of its exterior
  wall. This was silently corrupting `basic-village.html`'s entire view
  (camera radius 90 vs. a 150-unit/half-size-75 skybox) and would have hit
  `waypoints.html` too. Fixed.
- **`src/Components/Waypoint.ts`** -- nothing ever pointed the `type="free"`
  camera at anything; it kept whatever rotation `FreeCamera`'s constructor
  gave it (facing Babylon's default +Z) after being teleported to a
  waypoint, so `waypoints.html` showed nothing but sky. Added a
  `setTarget(Vector3.Zero())` call on every position change -- an
  imperfect default (this tour's stops aren't literally at the origin) but
  a large improvement over facing an arbitrary fixed direction, and
  documented as such; a real per-waypoint "look at" is a bigger feature
  than this pass's scope.
- **`src/Modifiers/Modifier.ts`** -- `bump-texture`/`reflection-texture`
  had `-uscale`/`-vscale`/`-level`/`-coordinates` companions wired up (and
  `GardenMesh`'s own JSDoc claims all texture attributes have them), but
  the plain `texture`/`diffuse-texture` never did. Added
  `texture-uscale`/`texture-vscale`, and used them in `car.html` to tile
  its floor texture -- untiled, a single image stretched across a 30-unit
  ground read as a blurry smear up close.
- **`src/Components/Action.ts`** (again) -- implemented `type="interpolate"`
  (was a no-op case, silently swallowing 4 uses in `action-manager.html`)
  plus `trigger="pick"`/`"leftPick"`. Verified via direct `ActionManager`
  trigger simulation (headless Chromium can't hover) that the box's scale
  now actually tweens 1→1.1 on the registered pointerover interpolate
  action. Wired `action-manager.html`'s CSS `action:` rule to actually
  reference the two interpolate actions it declares (`pointerOver2
  pointerOut2`) -- they existed in the markup already but nothing had ever
  attached them to a mesh, interpolate support or not.
- Camera re-tuning beyond the previous (unverified) pass, now confirmed by
  actual screenshots: `wobble.html` (`position="-5.2 -5.2 -5.2"` -- the
  wobble drift's *true* centre, once the size bug above was fixed, sits at
  roughly `(1.5,1.5,1.5)`, not the origin the arc camera's target is stuck
  at; camera opposite it on the same ray, same trick as `subtract.html`),
  `stairs.html` (`position="45 30 -12"` -- radius alone couldn't frame
  three staircases spread on *both* sides of the origin along Z; needed an
  off-axis 3/4 view instead of looking straight down one axis),
  `subtract.html` (`position="0 4 -30"`, pulled back further -- the boolean
  demo copies are offset ±10 in X *and* Z, wider than the previous guess
  accounted for), `basic-village.html` (`position="0 60 -100"` -- radius
  alone put the camera eye-level with a nearby terrain rise; note in the
  file also records that a wider/steeper establishing-shot angle was tried
  and rejected, since the arc camera's view matrix degenerates -- renders
  nothing at all -- once the look direction gets close to parallel with
  the up vector).
- **New example**: `examples/Basic/material.html` -- `<garden-material>`/
  `<garden-texture>` (the declarative child-element material system) had
  no minimal dedicated demo, only buried inside the much larger
  temple/museum structure examples. Shows colour-only, single-texture, and
  texture+bump+tiling (`u-scale`/`v-scale`) cases on plain shapes.

**Deliberately still not done**, same reasoning as the prior pass:
`action-manager.html`'s `type="combine"`/`"state"`, `<garden-condition>`,
and picking-a-mesh-to-wireframe. Traced *why* picking-to-wireframe doesn't
work (confirmed, not just suspected, this pass): that action is declared
top-level on `<garden-scene>`, not on a mesh, so `GardenAction` correctly
stores it in `sceneEl.actions` -- but nothing anywhere reads that map in
response to an actual scene-wide pick event; `BehaviourAction`'s `action="..."`
attribute is the only consumer, and it always resolves to one specific
mesh at build time, not "whatever the user just picked". Making that work
needs a real scene-level pick dispatcher, which combine/state/condition
also depend on -- still genuine feature work, not a quick fix, now with a
confirmed root cause instead of a guess.
