# Design: characters, guides, weather and spatial audio

Status: **built (2026-10-19)**, on branch `characters`, one commit per PR;
what is left over is in `TODO.md` ("Characters, guides and weather").
PR 8 (spatial audio) was done first, with the Babylon 8 upgrade, because
the legacy `Sound` stopped working there.

## Why

Two kinds of scene need the same building blocks:

- **A third-person "follow the guide" game**: a child walks across a stormy
  desert behind a guide who carries a pool of light, with animals and other
  children following them. The guide turns and waits when the player falls
  behind; a dust storm hides the guide, and the player finds them by their
  voice.
- **Museums and walk-throughs with NPCs** (see `examples/Structures/museum.html`,
  `great-court.html`, `examples/Navigation/shopping-centre.html`): a visitor
  walks round, a guide leads them room to room, exhibits talk when you walk up
  to them, and "this way" markers point to the next room.

Both need a walking player, characters that follow and wait, named
animations, "you're near / you've gone" events, lights carried by
characters, weather, an off-screen pointer, and spatial audio played from
code. juel-garden already has most of the foundations (below), so these
belong here rather than in each game.

**The rule:** juel-garden gives general building blocks, declared in
markup and driven from code through properties, methods and DOM events. A
game's own logic (when a storm starts, who the pointer points at) stays in
the game.

## What's there already

| Need | Already in juel-garden |
|---|---|
| Third-person camera | `<garden-camera type="follow" target="#id">` (`FollowCameraStrategy`, spring-damped) |
| Rigged models | `<garden-mesh-model>` (GLB), `GardenSkeletonMesh`, `<garden-animation type="skeleton">` |
| Moving things | behaviours `drive`, `wander`, `flee`, `track`, `orbit`, `terrain`, `suspension` |
| Ground | `<garden-ground>`, `<garden-height-map>` |
| Particles | `<garden-particle>` |
| Sound | `<garden-sound>` (attaches to its parent's mesh) |
| Physics | `<garden-physics>` (Havok), per-mesh `physics` attributes |
| Cards, GUI | `<garden-info>`, `src/Components/Gui/` |

## The plan: nine PRs

Each PR adds an example page and a test in `tests/` (the existing
Playwright pattern), and its docs (TSDoc for typedoc, and the README).
PRs 1–4 are enough for a "follow the guide across the ground" prototype.

### PR 1: `walk`, a walking player

`drive` is car-style keyboard steering in world space. A walker is different:

- **Moves relative to the camera** (push "up" and you walk away from the
  camera), turning the mesh smoothly to face the way it's going.
- **Input:** WASD/arrows, a gamepad stick, and a **touch joystick** (an
  on-screen thumb pad, shown only on touch screens).
- **Ground and walls:** Havok's `PhysicsCharacterController` for slopes,
  steps and collisions when `<garden-physics>` is present (check it's in the
  Babylon version used; see PR 9), otherwise the `terrain` behaviour's
  ground-following.
- Attributes: `walk-speed`, `walk-run-speed`, `walk-turn`,
  `walk-facing-offset` (like `drive-facing-offset`).
- Exposes `speed` (current, units/s) for PR 3 to drive the walk animation,
  and `enabled` so a game can take control away (for a cutscene, or while
  the player is carried).

Example: `examples/Characters/walk.html` on a height map with a follow camera.

### PR 2: `follow`, followers and flocks

A mesh follows a leader (`follow="#id"`):

- `follow-distance` (how far behind), `follow-offset` (a place relative to
  the leader, e.g. "beside, on the left"), `follow-speed`.
- **Spacing:** followers of the same leader keep `follow-spacing` apart, so
  a group walks round the leader in a loose ring instead of piling up.
- **Waiting:** `follow-wait="#id" follow-wait-distance="n"`: when that
  element (the player) is further than `n` behind, the leader stops and
  turns to face it, and fires `garden-wait` / `garden-resume`. This is
  "the guide waits for you", and works on any mesh, not just followers.
- Respects `terrain` / the character controller from PR 1 to stay on the
  ground.

Example: `examples/Characters/follow.html`: a guide on a `track`, a ring of
followers, a walking player the guide waits for.

### PR 3: named animations with blending

GLB files carry named animation groups (`idle`, `walk`, `wave`).
`<garden-animation type="skeleton">` plays bones by frame range, which
doesn't fit them.

- `<garden-mesh-model>` keeps the loaded `animationGroups` by name.
- Attribute `play="idle"`, and a method `play(name, { blend, loop, speed })`
  that cross-fades from the current animation (Babylon's animation
  weights / `enableBlending`).
- **Motion-driven:** `anim-idle="idle" anim-walk="walk" anim-run="run"`
  picks and speeds the animation from how fast the mesh is moving (from PR 1's
  `speed`, or measured frame to frame for `follow`, `wander`, `track`).
- One-shot actions (a wave, a stamp) return to the motion animation when
  they end, and fire `garden-animation-end`.

### PR 4: proximity events

`near="#id" near-distance="n"` on any element fires **`garden-near`** when
`#id` comes within `n`, and **`garden-far`** when it goes past
`n × near-hysteresis` (default 1.2, so it doesn't flicker at the edge).
Several targets: `near="#a, #b"`. The event's `detail` says which target
and the distance. A cheap distance check per frame, no physics needed.

Uses: the guide notices you've dropped behind; an exhibit starts talking
when you walk up; a trigger zone without a physics body.

### PR 5: lights carried by meshes

- A `<garden-light>` inside a mesh element parents itself to that mesh, with
  a local `position`.
- `range` and `intensity` attributes, animatable with `<garden-animation
  property="intensity">` / `property="range"` and settable from code (for a
  pool of light that grows).
- A **ground pool** option: a spot light pointing down, or a soft decal,
  so a carried light reads as a circle on the ground even on large terrain.
- Shadows stay optional (`shadows` attribute) for phones.

### PR 6: weather

- `<garden-particle preset="rain|snow|sand|dust-devil">`: tuned particle
  systems that follow the camera (rain, sand) or a mesh (a dust devil /
  whirlwind that can move along a `track` or `wander`).
- **`<garden-lightning>`**: a flash (a brief light and sky brightening) at
  random intervals or from code (`strike()`), with an optional delayed
  `<garden-sound>` child for the thunder.
- **Fog** on `<garden-scene>` (`fog-mode`, `fog-density`, `fog-colour`),
  animatable, for a storm that closes in and clears.
- Sky colour changes over time (dusk to night) on `<garden-sky>`.

### PR 7: `<garden-marker>`, an off-screen pointer

A GUI marker for a target element: an icon above it while it's on screen,
an arrow at the screen edge pointing to it while it's off screen or behind
the camera.

- `target="#id"`, settable from code (a game can point it at something
  else).
- `icon`, `colour`, `label`, `hide-within="n"` (hidden when you're close).
- Fullscreen-GUI based (`src/Components/Gui/`), with a WebXR fallback
  (a floating arrow in front of the headset) later.

Uses: "follow the guide", "this way to the next room".

### PR 8: spatial audio from code

`<garden-sound>` builds its `Sound` once and plays only if `autoplay`.

- Methods `play()`, `stop()`, `pause()`, and `garden-sound-end`.
- Spatial attributes: `ref-distance`, `rolloff`, `max-distance`,
  `distance-model`, `directional` (a cone, for a voice facing one way).
- Follows a moving parent mesh (it attaches already; check it tracks every
  frame) and can be re-parented from code.
- Plays on a DOM event: `play-on="garden-near"` (PR 4), so an exhibit talks
  when you walk up with no code at all.
- **Audio engine:** Babylon 8 replaces `Sound` with the new audio engine
  (`AudioEngineV2`, `CreateSoundAsync`, spatial sound). Decide with PR 9;
  keep the element's attributes the same either way.
- Unlocking audio on the first tap (mobile browsers) handled once, in
  `<garden-scene>`.

### PR 9: packaging

Games now copy a 6.3 MB global bundle (`dist/juel-garden.js`: all of
Babylon 7, Lit and juel-garden) into their own folder by hand, because
`parcel build` (minified) crashes on Windows.

- An **ES-module build** published as an npm package (a git dependency is
  enough to start), with types, so a game just runs `npm install` and its
  bundler drops the parts of Babylon it doesn't use.
- Move from the UMD `babylonjs` package to **`@babylonjs/core`** (+
  `@babylonjs/loaders`, `@babylonjs/havok` already), imported per module.
  This touches every file's imports, so it's mechanical but large.
- Consider **Babylon 8** at the same time (character controller, the new
  audio engine, better animation blending), checking every example still
  renders (`npm run test:examples`).
- Keep the global bundle as a second output for plain-HTML pages and the
  examples.
- Replace Parcel with esbuild or Vite library mode if the Windows crash
  persists.

Could go first if the move to `@babylonjs/core` is wanted before new
features are written against the old imports. See the open questions.

## Final example

`examples/Characters/guide.html`: a stormy height-map desert at dusk. Walk
(PR 1) behind a guide on a track carrying a ground pool of light (PR 5),
with a ring of followers (PR 2) all animated (PR 3). Drop behind and the
guide turns and waits (PR 2, PR 4); a dust devil and lightning (PR 6) pass
between you; the marker (PR 7) points the way; the guide's voice calls from
where they are (PR 8). And a museum version: a guide leading round
`museum.html`, exhibits that talk as you approach.

## Open questions

**Answered 2026-10-19:** features first, PR 9 after; upgrade to Babylon 8
now (8.56.2; Babylon 9 has since come out); Quaternius CC0 characters in
`examples/assets/`; Grotto equivalents parked.

1. **Order:** PR 9 (packaging, `@babylonjs/core`, maybe Babylon 8) first, so
   everything new is written against the new imports, or features first?
2. **Babylon 8:** upgrade as part of PR 9, or stay on 7.29?
3. **Characters to test with:** free rigged GLBs with idle/walk/wave (e.g.
   Mixamo-rigged or Quaternius CC0 models) in `examples/assets/`, with
   their licences.
4. **Grotto:** should each feature also get a native (Stride) equivalent in
   `juel-garden-grotto`, or is that parked?
