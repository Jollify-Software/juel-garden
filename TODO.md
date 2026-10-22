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

## `<garden-link>` next steps (added 2026-10-15, after `d020bec`)

- **Headset test.** `#id` jumps teleport in XR (`Navigation.applyPose`
  skips the flight for `WebXRCamera`) and `<garden-webxr>` re-enters VR on
  `sessiongranted` -- neither has been tried on a device. Check on the
  tablet/phone-in-viewer and, if one turns up, a Quest (Quest Browser is the
  only browser with WebXR navigation): controller-select on a portal, sign
  and info-card button; teleport lands at real head height; next page
  re-enters VR.
- **Parterre output.** Let a floor plan carry links (e.g. `data-href` on a
  shop, or a `data-fixture="link"`) and emit `<garden-link>` -- makes a
  mall map clickable with no hand edits. Tracked in `parterre/TODO.md`
  Milestone 4.
- **Grotto.** The native runtime has no `<garden-link>` yet: portal mesh,
  `#id` camera jumps, and page links that load another scene from the same
  `.garden` package.
- **Jollify Player.** Decide whether the player listens for
  `garden-navigate` to route links between entries of one package (and to
  open external sites in the system browser) rather than letting WebView2
  navigate.
- **Nice-to-haves.** Portal "peek" (A-Frame's `peekMode`: a live/equirect
  preview of the destination instead of a flat `image`); keyboard focus /
  Enter on links for accessibility; `look-at` for deep-link arrivals
  (currently default offset, current heading); extend `tests/link.js` to
  click an in-shop "Back to the concourse" portal.
- The sign text drawn by `<garden-canvas>` is lit diffuse, so it reads dim in
  the example -- consider an `emissive`/unlit option there.

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

## Characters, guides and weather (added 2026-10-19, built 2026-10-19)

Plan: `DESIGN-characters-and-guides.md`. Built on branch `characters`, one
commit per PR, each with an example in `examples/Characters/` and a test.

- [x] Babylon 7.29 -> 8.56.2, esbuild instead of Parcel (it segfaulted).
- [x] **PR 1 `walk`** (`npm run test:walk`), follow camera `free-look`.
- [x] **PR 2 `follow`, `follow-wait`** (`test:follow`); `follow-wait="camera"`.
- [x] **PR 3 named animations** (`test:named-animations`).
- [x] **PR 4 `near`** (`test:near`).
- [x] **PR 5 carried lights** (`test:lights`).
- [x] **PR 6 weather** (`test:weather`).
- [x] **PR 7 `<garden-marker>`** (`test:marker`).
- [x] **PR 8 spatial audio** (`test:sound`): done with the Babylon 8 move,
  since the legacy `Sound` broke there.
- [x] **PR 9 packaging**: `@babylonjs/core` per-module imports, `lib/` ES
  build + types, `prepare`; `npm run test:lean`.
- [x] Final examples: `guide.html`, `museum-guide.html`.
- [x] Open questions answered (in the design).

Left over:
- [ ] `<garden-marker>` in a WebXR headset (a floating arrow in front of the
  viewer); it is a DOM overlay, so it isn't drawn in VR.
- [ ] `follow` with Havok's character controller (followers use `terrain` or
  `collisions` only); `walk`'s controller could be shared.
- [x] Most elements still build once: `GardenElement.update()` skips Lit's
  own `update()`, so later property changes don't re-run `updated()`.
  **DONE 2026-10-22** (`tests/live.js` 18/18): every change goes through Lit again, and one
  shared MutationObserver turns plain attributes (`colour`, `track`, `physics`...) into
  updates. `position`/`rotation`/`scale` alone apply in place (meshes, `<garden-element>`,
  cameras; physics teleports); anything else rebuilds: `unbuild()` stops behaviours and
  physics, `setMesh` keeps other elements' child meshes and disposes the build's own parts
  and unworn materials (not a `<garden-material>`'s or `<garden-texture>`'s). Light, water,
  sound, marker, thumbstick and model opt out with `handlesChanges`. Fixed on the way: trees
  never rebuilt and leaked on removal; cameras never disposed; info stacked observers;
  house/semi-house merges failed on rebuild; materials and textures now swap themselves in.
  Known: `<garden-lathe>` and `<garden-replicate>` throw when built with no attributes (as
  before); a child element's own change doesn't re-merge a house.
  **Moving a built element: DONE 2026-10-22** (QUESTIONS.md §15, `tests/moved.js`):
  `GardenElement` defers disposal a microtask (a move cancels it, a re-add after it rebuilds via
  `updated()`), subclasses override `dispose()`, `moved()` re-parents a mesh / rebuilds rocks and
  walls, behaviours' observers go through `el.observe()` and stop on disposal. The live-attributes
  half (below) is still to do. Original note:
  Decided 2026-10-22 to do on the same night (Q1 of the 2026-10-21 queue): **moving a built
  element.** Today water, light, sky, sound, particles and lightning come back empty when
  removed and re-added (they dispose on `disconnectedCallback`), and `GardenMesh` elements
  dispose nothing when removed. Do it once in `GardenElement`: disconnect schedules disposal
  (microtask / next frame), a reconnect before it runs cancels it (a move keeps everything),
  a reconnect after it runs rebuilds; `GardenMesh` elements dispose on permanent removal; a
  move to a new parent re-applies transform and ground sampling. Test: move a box, water and
  light; remove one for good and check it has left the scene; re-run `follow` and `walk`.
- [ ] Babylon 9 is out (2026-03-26); this moved to 8.56.2 as decided.
- [ ] Grotto equivalents: parked.
- [x] `<garden-mesh-model height>`/`fit`/`base` on skinned models (looked into 2026-10-21): not a
  measuring bug. A skinned figure under an armature scaled 100 is measured as drawn
  (`node tests/model-skinned.js`, 4 checks, fixture made by `tests/fixtures/make-scaled-armature.py`).
  The model that prompted it, an animated wolf from Poly Pizza, has a skin Babylon can't draw as
  it comes (it warns "Skeleton node is not a common root" and draws the legs crossed in an X);
  re-exported through Blender it draws properly and `height` sizes it right (0.95 asked, 0.951
  drawn, feet on the ground). If a model comes out the wrong size, check it draws properly first.
- [x] **Shared pieces from a third-person game** (2026-10-20), moved here so later games
  can use them, each with a browser test:
  - `camera.show()` / `unshow()` / `swingTo()` on the follow camera: a cutaway to an event and
    back (`npm run test:cutaway`, 9 checks).
  - `src/Characters/`: `PoseLayer`, `waveLayer`, `BoneSeat`, `HeldProp`, `Huddle`, plus
    `worldPosition` and `boneNode` (`npm run test:characters`, 14 checks on the new CC0
    `Mannequin.glb`, cut down from Quaternius's Universal Animation Library by
    `Tools/slim-glb.py`).
  - `toStandardMaterials()` and `<garden-mesh-model materials="standard">`.
  - `src/Nature/`: `splatMaterial`, `imageFromFunction`, `PanoramaSky`, `StillWater`,
    `rockMesh`, `stoneWall`, `arcPath`, `cardTrees`, `leafTexture`, `leafMaterial`,
    `GlowRing`, `mottle`, `texturedMaterial`, and `noise`/`smoothstep`/`seededRandom`
    (`npm run test:nature`, 15 checks).
  - The `<script>` bundle now has a global name, `window.JuelGarden`, so pages can use these.
  - [x] A demo of them together (2026-10-21): `examples/Characters/pieces.html`, on the CC0
    Mannequin: the guide waves while waiting and carries a staff, a small figure rides a
    follower's shoulders, the group huddles behind the guide while the camera cuts away to
    what appeared, on a splat ground (textures drawn in the page) with a glow ring, rocks,
    trees, walls and a pool. Opened by `npm run test:examples`.
- [x] Elements for the nature pieces (`<garden-water>`, `<garden-rocks>`, `<garden-trees>`,
  `<garden-stone-wall>`, a `<garden-sky>` with panoramas), so markup-only scenes can use them too
  (2026-10-21; all together in `examples/Nature/nature.html`, skies drawn in the page).
  - [x] `<garden-water>` (2026-10-21): `StillWater` in markup; `position`, `radius`, `colour`,
    `ripples`, `mirror`, and `reflect` (bare: the whole scene once it has loaded; a selector:
    just those elements' meshes; set from code: the mirror turns on then).
    `npm run test:nature-elements`. Fixed the same night: two waters that reflect each other
    (both bare, or naming each other) waited on each other's mirror for ever, so neither got one;
    a water now doesn't wait for another water, whose mesh is there at once. And changing
    `reflect` while the first mirror was still waiting started a second build, whose `whenReady`
    replaced the first (which then never resolved) and whose newer selector was ignored; now
    one build runs at a time and picks up the newer `reflect`.
    And once the mirror was made, changing `reflect` (another selector) or removing it did
    nothing; now the mirror is remade for the new selector, or turned off (`StillWater.unreflect()`).
    And (2026-10-22) a water given `reflect` and removed in the same task threw a page error:
    its queued update ran with no parent, and `getScene()` looked inside `null`. `getScene()` and
    `getSceneEl()` (`GardenElement`, `GardenMesh`) now give null once an element is removed.
    The same for any element removed before its *first* build (2026-10-22): a box, sphere,
    plane, line or model added and removed in one task built a stray mesh into the scene and
    then threw. `GardenElement.shouldUpdate()` now skips that build, and adding the element
    back builds it (`node tests/detached.js`).
  - [x] `<garden-rocks>` (2026-10-21): `rockMesh`es scattered over `width` × `depth` or a
    `ground` (sitting on it, slopes too), merged into one mesh; `count`, `size`, `seed`, and the
    usual texture/colour attributes (default a weathered grey).
  - [x] `<garden-trees>` (2026-10-21): `cardTrees` shapes (hidden) instanced over an area or a
    `ground`, `spacing` apart; `count`, `seed`, `variants`, `size`, `bark-colour`,
    `bark-texture`, `bark-bump-texture`, `leaf-colours`.
  - [x] `<garden-stone-wall>` (2026-10-21): along `points` or a ring (`radius`, `gate`,
    `gate-width`), following a `ground`; `height`, `foot-width`, `top-width`, `cap-every`; the
    capstones share the wall's material (`setMaterial` passes it on). Fixed 2026-10-22: with
    `ground`, a wall or rocks turned by `rotation` (or scaled) sampled the ground where they'd be
    unturned, so they floated or sank on a slope (a 45° wall up to 0.58 m off); they now sample it
    through the element's own position, rotation and scale.
    Also fixed 2026-10-22: one with its own `rotation` inside a turned element gets the parent's
    turn added to it (`ModifyRotationSetter`) but sampled without it (1.7 m off); both now read
    their frame through `Modifier.transformOf`, exactly as the mesh gets it. The position too: inside a
    moved element they ignored its position (unlike every other mesh element); now they add it.
    And inside a `parent`-tagged element, whose node their mesh is really parented to, they sampled
    as if unparented (a wall up to 4.3 m off, rocks buried 1.4 m); they now sample in that node's
    world frame (`Modifier.worldFrameOf`). Rocks with no `position` there were also centred off
    their ground by the parent's place (they cover the ground elsewhere); the ground's centre is
    now turned into that node's frame.
  - [x] `<garden-sky panorama>` (2026-10-21): `panorama`, `panorama-to`, `blend` (live),
    `duration`, `tint`, `tint-to`, `haze-from`, `haze-range`, `size` (the dome); flashes with `<garden-lightning>`;
    `blendTo()`, `flash()`. Colour and cubemap skies unchanged (`test:weather` 17/17).
    Fixed the same night: removing the element left both domes (and their per-frame observer)
    in the scene, since `mesh` is only the first dome; it now disposes its `PanoramaSky`.
- [ ] `stoneWall`'s sides shade from light at the top to near-black at the foot, even untextured
  in daylight (seen in `examples/Nature/nature.html`): probably the extruded shape's normals
  smoothed round the foot and top edges. Check with a textured wall before changing it.
  Measured 2026-10-22 (normals read back from the same `ExtrudeShape`): it is. Each shape corner
  is shared by the side and the bottom or top, so a side's normal at the foot is (-0.74, -0.68),
  tilted 43° down from the face's own (-1.00, 0.09), and at the top 43° up. Lit from above, the
  foot turns away from the light. A fix (unshared corners, or flat normals) changes how every
  wall looks, so it waits for a look at both.
- [x] `tests/follow.js` "…and stop once there" was flaky (one follower at 0.20 m/s against a
  0.2 limit about every other run). Measured 2026-10-21: no endless jostling; at 5 s the
  followers are still creeping the last centimetres (0.12–0.18 m/s, easing in against keeping
  apart, resting about 0.92 m apart, just past the 0.9 "crowded" line) and stop within 0.4 s more.
  The check now waits up to 3 s for them to stop, then requires them to stay stopped for a
  second (under 0.05 m/s; a follower kept nudged reads over 1 m/s and fails it).
- [x] **`follow` and `follow-wait` find an element added later** (2026-10-20,
  in `npm run test:follow`): they looked their target up once and gave up
  (with a warning) if it wasn't in the DOM yet, so a guide waiting for a
  player created after it never waited. `GardenElement.resolveEventually`
  keeps looking (every 250 ms, up to 30 s). Found in a game.
- [x] **Replaying a one-shot from `garden-animation-end`** (2026-10-20, in
  `npm run test:named-animations`): the mixer went back to the loop after
  announcing the end, overriding a listener that played the one-shot again,
  and Babylon also clears an animation group started inside its own end
  notification. Now a listener's choice stands, and the same group restarts
  before the next frame's animations at the weight it had. Found in a game
  (a gesture repeated while a pose holds).
- [x] **Look controls for the follow camera** (2026-10-20, `npm run test:look`):
  with `free-look`, the gamepad's right stick, Q/E and a second touch thumb pad
  (`look-pad`, bottom right) turn the view independently of walking, like
  twin sticks; `look-speed`; `orbitAngle` settable from code. The thumb pad
  is shared with `walk` (`src/Utils/ThumbPad.ts`). The walk example's wave
  moved from E to F.
- [x] **`<garden-thumbstick>`** (2026-10-20, `npm run test:thumbstick`): an
  on-screen stick for touch screens that `controls` a `walk` element or the
  follow camera (`camera`); `side`, `show` (auto/always/never), `mode`
  (floating, the default: it comes to the thumb; or fixed), `size`, `colour`,
  `disabled`; start/move/end events. While one controls something the
  built-in pads stay away. `ThumbPad` gained floating mode and colour;
  `Utils/ThumbstickRegistry.ts` lets walk and the camera read the sticks.
- [x] `<garden-height-map minheight>` was ignored (the option map's key was
  `'minheigh'`), so every height map started at 0. Fixed 2026-10-20, with a
  check in `npm run test:ground`; found building a game on a ground that dips
  below 0.
- [x] **Next/previous keys on `<garden-waypoint>`** (2026-10-21, `node tests/waypoint-keys.js`):
  `keys`, on by default (`keys="false"` off): PageDown/ArrowRight call `next()`,
  PageUp/ArrowLeft `previous()`, what presentation clickers send, so a published
  scene works with one. A `keydown` listener on `window` (added on connect,
  removed on disconnect; in an iframe it hears keys while the iframe has focus)
  that leaves alone keys typed into an input, textarea, select or editable text,
  keys with Ctrl/Alt/Meta held, and keys already `preventDefault()`ed by the page;
  only the keys it acts on are `preventDefault()`ed. The scene's audio-unlock
  `keydown` (capture phase) is untouched.
- [ ] `walk` with `<garden-physics>` can rest up to about 15 cm above the floor (2026-10-21,
  measured 0.02-0.14 m over 8 runs): Babylon's `PhysicsCharacterController` counts as standing
  anywhere within `keepDistance` (0.05) + `keepContactTolerance` (0.1) of a surface, and
  `BehaviourWalk` (like Babylon's sample) adds no gravity once it stands, so it stays where it
  first came within that band. `tests/walk.js` "falls and lands" failed about 1 run in 5 on a
  0.1 limit; it now checks the real band and that it has stopped. Possible fix: a small
  downward pull while supported, or a smaller tolerance; check slopes and steps don't jitter.
- [x] `teleport()` from inside the physics step did nothing (2026-10-22): it turned the pre-step
  back off with an `onAfterPhysicsObservable.addOnce`, and called from a `garden-rest` or
  `garden-collide` listener (both fire inside that observable) the new observer ran in the same
  pass, so the body never got the new transform; the mesh jumped for a frame, then went back.
  Now it waits for the next step to begin (`onBeforePhysicsObservable`) before handing the
  transform back. Found when a game put a ball back after a shot from its rest handler; check in
  `npm run test:physics`.
