# Juel Garden

A library of custom components written with [Lit](https://lit.dev/) to create 3D and VR scenes with [BabylonJS](https://www.babylonjs.com/).  
This library has been inspired by [A-Frame](https://aframe.io/), but instead of [ThreeJS](https://threejs.org/) we are using Babylon.

## What's in the name

The name 'Garden' was chosen because of the [Hanging Gardens of Babylon](https://en.wikipedia.org/wiki/Hanging_Gardens_of_Babylon), we are using BabylonJS so this seems fitting.  
I am also inspired by [The Village Green Preservation Society](https://youtu.be/lc7dmu4G8oc), the main tutorial [builds a village](https://doc.babylonjs.com/start/chap2).  
God save the village green!

Juel is the Jollify Unique Element Library which is another project I am working on.

# Development

I have developed this library by following the tutorials and taking some examples from the [Babylon Playground](https://www.babylonjs-playground.com/) and creating custom elements based on them.  
Here is the Garden equivalent of the [A-Frame basic scene](https://aframe.io/docs/1.2.0/introduction/):

```html
<garden-scene>
    <garden-camera></garden-camera>
    <garden-light></garden-light>
    
    <garden-element parent position="0 -1 0">
        <garden-box position="-1 0.5 -3" rotation="0 45 0" colour="#4CC3D9"></garden-box>
        <garden-sphere position="0 1.25 -5" diameter="2.50" colour="#EF2D5E"></garden-sphere>
        <garden-cylinder position="1 0.75 -3" diameter="1" height="1.5" colour="#FFC65D"></garden-cylinder>
        <garden-ground position="0 0 -4" width="4" height="4" colour="#7BC8A4"></garden-ground>
    </garden-element>
</garden-scene>
```

The [Waypoints example](https://jollify.app/doc/waypoints.html) shows how this library could be used to create educational VR experiences.  
`<garden-waypoint>` moves you to a stop when you click it, or when you **look at it and hold**
(`dwell`, 1500 ms by default, `0` off: a white reticle, dark-edged so it reads on pale surfaces too, fills at the centre of view, for headsets
without controllers); the **next** stop in order has a glowing ring (`highlight-next="false"`
hides it); `next()`, `previous()` and `go(index)` fly along the order and fire
`waypoint-changed` (`{ index }`). For headsets keep the fly short (`speed="2"` or more).
**Keys** (`keys`, on by default): PageDown and Right arrow go to the next stop, PageUp and Left arrow
to the previous one, which is what presentation clickers send, so a published scene works with one
(in an iframe, while the iframe has focus); keys typed into a form field or editable text, or with
Ctrl/Alt/Meta held, are left alone, and `keys="false"` turns it off.
A stop that moves (one with `orbit`) is followed during the fly, so you land on it and ride its orbit.
Tests: `node tests/waypoint-dwell.js`, `node tests/waypoint-orbit.js`, `node tests/waypoint-keys.js`.  
A stop can circle something: give it `orbit` (and `orbit-angle`, radians per frame) inside the
element it goes round. Its `position` stays world-space (height included), and a
`<garden-mesh-model>` parent is waited for until its file has loaded. Test: `node tests/orbit.js`.  
My favourite example is the [temple example](https://jollify.app/doc/temple.html) which demonstrates how the library could be used to create experiences for museum exhibits:

```html
<garden-scene gravity="0 -0.2 0" collisions>
    <garden-camera type="free" collisions position="0 0 -40"></garden-camera>
    <garden-light></garden-light>

    <garden-room id="r1" collisions></garden-room>
    <garden-opening between="r1 r2" position="0 1 -4" width="2" height="2" depth="0.4"></garden-opening>
    <garden-room id="r2" position="0 0 -8" collisions></garden-room>
    <garden-opening between="r2 s1" position="0 1 -12" width="2" height="2" depth="0.4"></garden-opening>

    <garden-column position="-4 -5 -22" diameter="1" height="6" collisions>
        <garden-particle effect="fire"></garden-particle>
    </garden-column>
    <garden-column position="4 -5 -22" diameter="1" height="6" collisions>
        <garden-particle effect="fire"></garden-particle>
    </garden-column>
    <garden-stairs id="s1" position="0 -5 -32" height="5" depth="20" collisions>
        <garden-sound loop autoplay maxdistance="20"
            url="https://upload.wikimedia.org/wikipedia/commons...Epitaph_of_Seikilos.ogg">
        </garden-sound>
    </garden-stairs>
    <garden-ground width="150" height="160" colour="green" position="0 -5 0" collisions></garden-ground>
</garden-scene>
```

## Links between and within scenes

`<garden-link>` is the equivalent of A-Frame's [`link`](https://aframe.io/docs/1.8.0/components/link.html).
Its `href` is another page (the next scene, a website) or `#id` of an element
in this scene, which flies the camera there -- e.g. from a shopping centre's
concourse into one shop. Each `#id` jump is a browser history entry, so the
back button flies back out, and another page can link straight to
`mall.html#shop-12`. Where you put it decides how it looks:

```html
<!-- On its own: a portal, turned to face the camera. -->
<garden-link href="food-court.html" title="Food court" image="food-court.jpg" position="-4 1.5 1"></garden-link>

<!-- Inside a mesh: the mesh is the link (outlined on hover). -->
<garden-plane position="0 2.9 4.85" width="4" height="1" texture="coffee-sign.png">
    <garden-link href="#coffee" offset="0 1.6 -2.5" look-at="#coffee-counter"></garden-link>
</garden-plane>

<!-- Inside a <garden-info>: a button on the info card. -->
<garden-info title="Coffee">
    <garden-link href="https://example.com/" target="_blank">Website</garden-link>
</garden-info>
```

In a headset `#id` jumps teleport instead of flying, and on browsers with WebXR
navigation (Meta Quest Browser) `<garden-webxr>` re-enters VR on the next
page, so visitors can walk from scene to scene without leaving VR. Every
link fires a cancelable `garden-navigate` event first, for host pages that
want to route it themselves. See
[examples/Navigation/shopping-centre.html](examples/Navigation/shopping-centre.html);
`npm run test:link` drives it in Chrome.

## Rooms

`<garden-room>` is a floor plus walls, merged into one mesh. Its `type` picks the footprint:

| Attribute | Applies to | Default | Meaning |
|---|---|---|---|
| `type` | all | `rect` | `rect`: a `width` x `depth` box; `rotunda`: round, or oval with an explicit `depth`; `polygon`: any simple polygon from `points` |
| `width`, `depth` | `rect`, `rotunda` | 8, 16 (a `rotunda` without `depth` is round: `depth` = `width`) | outer size in metres (ignored by `polygon`) |
| `points` | `polygon` | none | the corners, `"x z, x z, ..."` (at least three; `x y z` also accepted, `y` ignored), in the room's own space (relative to `position`), tracing the walls' **outer** face. Concave shapes (an L, a U) work; either winding. A repeated corner (or a closing point equal to the first) is dropped; fewer than three distinct corners warns and builds a box. A `<garden-roof>` child (or a structure's roof) sizes to the points' bounds, and a flat one is trimmed to the outline unless `clip="false"`. |
| `height`, `thickness` | all | 6, 0.2 | wall height and wall/floor thickness |
| `wall-thickness` | all | `thickness` | the walls' thickness alone, when it differs from the floor slab's (a venue's 1.5 m walls). The outer face stays on the outline, so a thicker wall grows inward; a `<garden-structure>` join cuts through both rooms' walls however thick. |
| `floor-color`, `north-color`, `east-color`, `south-color`, `west-color` | all | floor `#9c968c`, walls `#e0dcd3` | surface colours; a `rotunda`, a `polygon` room or one with `<garden-wall slot>` sides has one wall colour, `north-color` |
| `debug-colors` | all | off | the per-face black/green/red/blue/yellow palette |

A `<garden-material slot="floor">` child overrides the floor; `slot="north"` (and
east/south/west) a box room's walls, or `slot="wall"` the single wall of a rotunda,
polygon or curved-side room. A polygon room's walls are mitred, so they keep their
full thickness into every corner.

Inside a `<garden-structure>`, a polygon room joins its neighbours the way a curved
room does: along its actual wall line, not its bounding box, so a shared edge gets a
doorway at any angle (a diagonal wall between two triangles works) and against a box
room too. A hand-placed `<garden-opening>` is an axis-aligned box, so it cuts cleanly
only through an edge that runs along x or z; for a slanted edge, rely on the
structure's join. (Every structure doorway, box or polygon, starts 5 cm below the
higher room's floor top: a shallow groove at the threshold, never through the slab.)

```html
<garden-room type="polygon" height="4" points="-6 -4, 6 -4, 6 0, 0 0, 0 4, -6 4"></garden-room>
```

See [examples/Structures/polygon-room.html](examples/Structures/polygon-room.html);
`npm run test:polygon` checks it in Chrome.

A `<garden-structure>` cuts a doorway (`opening-width` wide, 3 m by default) in the
middle of every wall two of its rooms share. When the doors come from a plan instead
(several doors in one wall, a wide arch, a wall with none), set `doorways="none"`:
the structure then cuts no doorways of its own, only the floor openings its stairs
need, and each door is a `<garden-opening>`.

```html
<garden-structure doorways="none">
  <garden-room id="a" width="10" depth="10" position="-5 0 0"></garden-room>
  <garden-room id="b" width="10" depth="10" position="5 0 0"></garden-room>
  <garden-opening between="#a #b" position="0 0 2" width="0.6" depth="2" height="3"></garden-opening>
</garden-structure>
```

## Characters, guides and weather

Building blocks for a third-person "follow the guide" game, and for museums
and walk-throughs with guides and talking exhibits (the plan is
[DESIGN-characters-and-guides.md](DESIGN-characters-and-guides.md); examples in
[examples/Characters/](examples/Characters/)):

```html
<garden-scene fog-density="0.01">
    <!-- free-look: the camera keeps its own angle; look round with a drag, Q/E, the gamepad's
         right stick, or a second thumb pad bottom right on touch screens (look-pad). -->
    <garden-camera type="follow" target="#player" free-look radius="7" height-offset="3.5"></garden-camera>
    <!-- Touch screens: two thumbsticks, one to walk and one to look (floating: touch anywhere on that half). -->
    <garden-thumbstick side="left" controls="#player"></garden-thumbstick>
    <garden-thumbstick side="right" controls="camera"></garden-thumbstick>
    <garden-sky colour="#d89a6a" colour-to="#1b2140" duration="120"></garden-sky>
    <garden-height-map id="dunes" url="dunes.png" width="120" height="120" maxheight="6"></garden-height-map>

    <!-- A walking player: WASD / gamepad / touch thumb pad, relative to the camera. -->
    <!-- materials="standard": its PBR materials as StandardMaterials (no environment map here). -->
    <garden-mesh-model id="player" src="robot.glb" height="1.8" walk terrain="#dunes" materials="standard"
        anim-idle="Idle" anim-walk="Walking" anim-run="Running"></garden-mesh-model>

    <!-- A guide on a path who waits (and turns round) when you fall 10 m behind. -->
    <garden-line points="0 0 0, 0 0 40, 30 0 40">
        <garden-mesh-model id="guide" src="robot.glb" track follow-wait="#player" follow-wait-distance="10" materials="standard"
            anim-idle="Idle" anim-walk="Walking">
            <garden-light pool="6" position="0 3 0" diffuse="1 0.8 0.5"></garden-light>
            <garden-sound url="voice.mp3" loop ref-distance="3"></garden-sound>
        </garden-mesh-model>
    </garden-line>

    <!-- Animals that trail the guide, keeping apart. -->
    <garden-mesh-model src="fox.glb" follow="#guide" follow-spacing="1.5" anim-walk="Walk"></garden-mesh-model>

    <garden-marker target="#guide" icon="★" from="#player" hide-within="5" show-distance></garden-marker>
    <garden-particle preset="sand" wind="7 0 2" density="0.5"></garden-particle>
    <garden-lightning interval="8 20"><garden-sound url="thunder.wav"></garden-sound></garden-lightning>
</garden-scene>
<script>
    // A cutaway to the marker's target: when the guide stops to wait, the camera swings round
    // to show where he is, then back to exactly where it was.
    const guide = document.getElementById("guide");
    guide.addEventListener("garden-wait", () => {
        const camera = document.querySelector("garden-camera").camera;
        camera.show(guide.mesh);
        setTimeout(() => camera.unshow(), 3000);
    });
</script>
```

| Piece | What it does |
|---|---|
| `walk` | A walking player, camera-relative; Havok's character controller with `<garden-physics>`, else `terrain` or `collisions`. `element.walker` |
| `follow`, `follow-wait` | Followers that keep apart; a leader that stops for stragglers (`garden-wait` / `garden-resume`) |
| `play()`, `anim-*` | Named GLB animations with cross-fades; idle/walk/run picked by speed; one-shots fire `garden-animation-end` |
| `near` | `garden-near` / `garden-far` when something (or `camera`) comes close |
| `<garden-torus-knot>` | `radius`, `tube`, `p`, `q`, `radial-segments`, `tubular-segments` |
| `grab` | Pick a mesh or model up and move it in six directions (a controller or hand turns it over); `grab="scale"` pinches it bigger or smaller; `grab-box` draws a bounding box with handles; `garden-grab` / `garden-release`. A physics body is carried while held and thrown when let go, at the speed it was moving (`grab-throw` scales it, `0` drops it; `test:throw`) |
| `<garden-light pool>` | Lights carried by meshes; a pool of light on the ground; live `intensity`/`range`; `shadows` (everything casts but grounds and height maps; a mesh's `cast-shadows`/`receive-shadows` overrides it); a spot light's `exponent`; `cascades` (cascaded shadow maps for big outdoor scenes); `specular` |
| Weather | `<garden-particle preset="rain/snow/sand/dust-devil">`, `<garden-lightning>`, scene fog + `fogTo()`, `<garden-sky colour>` + `fadeTo()` |
| `<garden-camera type="arc">` | `alpha`/`beta`/`radius` (radians, as Babylon's ArcRotateCamera), `target="x y z"` or an element to follow, `beta-lower`/`beta-upper`/`radius-lower`/`radius-upper` |
| `<garden-camera type="device">` | Turns with the phone or tablet it's on (a phone in a viewer); a free camera on a desktop. `target="x y z"` aims a free or device camera too |
| `<garden-sky environment>` | A prefiltered `.env`/`.dds` cube as the sky and the light PBR materials (glTF models) reflect; `blur`, `lighting="false"`, `backdrop="false"` (light only: the background is `colour`), `turn` (degrees). `environment="default"`: Babylon's default environment (backdrop, ground fitted under the models once they load, and light) |
| `<garden-material node>` | A node material (the Node Material Editor's output) from a JSON file or `#ID` on Babylon's snippet server: shaders, water, anti-tiling grounds; `<garden-texture block="name">` fills a texture block, `input-<name>` sets an input block |
| `<garden-node-geometry>` | A mesh from a node geometry (JSON or `#ID`), `input-<name>` for its inputs |
| `<garden-pipeline>` | The finish: `samples`, `fxaa`, `bloom` (+ `bloom-threshold`, `bloom-kernel`), `sharpen`, `grain`, `vignette`, `chromatic-aberration`, `depth-of-field` (+ `focal-length`, `f-stop`), `tone-mapping="aces"`, `exposure`, `contrast`; each off unless given; live |
| `<garden-animation type="vector3">` | Keyframes with several parts: `"0 (0 0 0), 60 ((Math.PI) 0 1.2)"` or `"0 0 0 0, 60 4 0 -2"`; also `vector2`, `quaternion`, `color3`, `color4` |
| `<garden-marker>` | An icon over a target, or an edge-of-screen arrow to it |
| `<garden-sound>` | Spatial audio on Babylon's audio engine: `play()`/`stop()`, `play-on="garden-near"`, cones, roll-off |
| `<garden-thumbstick>` | On-screen thumbsticks for touch screens: one `controls` a walker, one the `camera` |
| `camera.show(what)` | A cutaway: the follow camera swings round to look past the player at something happening, then `unshow()` swings it back to exactly where it was (`swingTo(place)`; `test:cutaway`) |
| `materials="standard"` | A GLB's PBR materials swapped for StandardMaterials, for scenes without an environment map (`toStandardMaterials()` from code) |
| `extension` | A model's file type (`glb`, `gltf`, `obj`…) for a `src` that doesn't end in one, such as a `blob:` or `data:` URL; Babylon picks its loader by it (`node tests/model-extension.js`) |

### Characters from code

For a script driving rigged characters (`npm run test:characters`; the classes are exported
by the ES module, and are `window.JuelGarden.*` with the `<script>` bundle):

| Class | What it does |
|---|---|
| `PoseLayer` | Changes to bones laid over whatever animation plays: `turn(bone, by)`, `scale(bone, by)`, `rest(bones)` (back to the rig's rest pose); fades in and out with `target`. A child's proportions from an adult rig, legs spread to sit astride |
| `waveLayer()` | A wave over any clip (arm up, forearm swaying, hand open); defaults for the Unreal-style rig of Quaternius's Universal Animation Library |
| `BoneSeat` | Keeps one model's bone on another's as both move: a child on someone's shoulders |
| `HeldProp` | A staff, lamp or flag in the hand, following it but staying upright; `lift` for a gesture |
| `Huddle` | A group shelters behind someone from a danger (pausing their `follow`), turns to watch it, and says when each has settled; `end()` lets them go |
| `worldPosition()`, `boneNode()` | A node's exact place this frame; a skeleton's bone by name |

All of them together, with the nature pieces, in
[examples/Characters/pieces.html](examples/Characters/pieces.html).

### Nature

Pieces for outdoor scenes built in code, light enough for a tablet (`npm run test:nature`):

| Piece | What it does |
|---|---|
| `splatMaterial()` | Three ground textures with normal maps, blended by a mix map (a StandardMaterial plugin, so fog and lights work) |
| `imageFromFunction()` | A heightmap or mix map drawn from a function, as a PNG data URL |
| `PanoramaSky` | One or two sky photographs on domes, cross-fading (`blend`), hidden by thick fog, lit by `flash()` |
| `StillWater` | A dark pool with moving ripples, and a mirror switched on by `reflect()` |
| `rockMesh()`, `stoneWall()`, `arcPath()` | Lumpy rocks; a tapering dry-stone wall with capstones, round a circle with a gateway |
| `cardTrees()`, `leafTexture()`, `leafMaterial()` | Gnarled low trees with leaf-card crowns, as templates to instance |
| `GlowRing` | A glowing rim on the ground round a circle (where a pool of light ends), following the ground |
| `mottle()`, `noise()`, `texturedMaterial()` | Brightness varied over a ground; smooth value noise; a texture with its normal map |

#### Nature in markup

The same pieces as elements, for scenes written in HTML (`npm run test:nature-elements`; all of
them together in [examples/Nature/nature.html](examples/Nature/nature.html)):

| Element | Attributes |
|---|---|
| `<garden-water>` | A still pool (`StillWater`): `position` (its centre; the surface's height), `radius` (default 5), `colour`, `ripples` (0–1, default 0.25), `mirror` (0–1, default 0.4), `reflect` (bare: mirror the whole scene once it has loaded; a selector: only those elements; set it from code to turn the mirror on later, change it to mirror something else, remove it to turn the mirror off). `element.water` |
| `<garden-rocks>` | Rocks scattered and merged into one mesh: `count` (default 12), `width`/`depth` (the area round `position`, default 10 × 10), `size` (smallest and largest radius, default `0.3 0.9`), `seed`, `ground` (a selector for a ground or height map: the rocks sit on it, and cover it unless `width`/`depth` say otherwise); `texture`, `bump-texture`, `colour` or a `<garden-material>` child as on any mesh |
| `<garden-trees>` | Low gnarled trees (`cardTrees`) as instances: `count` (default 8), `width`/`depth` (default 20 × 20) or `ground`, `seed`, `variants` (shapes, default 3), `size` (scale range, default `0.85 1.15`), `spacing` (least distance between trunks, default 2.5), `bark-colour`, `bark-texture`, `bark-bump-texture`, `leaf-colours` (shades separated by spaces). `element.trees`, `element.shapes` |
| `<garden-stone-wall>` | A dry-stone wall (`stoneWall`): along `points` (relative to `position`), or a ring of `radius` round `position` with `gate` (the gateway's direction in degrees, 0 = +z; off for a closed ring) and `gate-width` (default 1.2); `height` (default 1.05), `foot-width`, `top-width`, `cap-every` (0 for no capstones), `ground` (follow it up and down); `texture`, `bump-texture`, `colour` or a `<garden-material>`, shared by the capstones (`element.caps`) |
| `<garden-sky panorama>` | A photographed sky (`PanoramaSky`): `panorama` (a 2:1 image), `panorama-to` (a second behind it), `blend` (0 the first … 1 the second; live), `duration` (cross-fade to the second once built), `tint`/`tint-to`, `haze-from`/`haze-range` (thick fog hides it), `size` (the dome's diameter, default 900); a `<garden-lightning>` strike lights it up. `blendTo(blend, seconds)`, `flash()`, `element.panoramaSky`. The `colour` and `root` skies work as before |

The test characters are Quaternius's CC0 RobotExpressive and Mannequin (the Universal
Animation Library's, cut down by `Tools/slim-glb.py`) and the Khronos Fox
(see [examples/assets/characters/LICENCES.md](examples/assets/characters/LICENCES.md)).

## Physics for games: joints, forces, raycasts, ragdolls

On top of `<garden-physics>` and a mesh's `physics` attribute (Havok), the pieces a physics game
needs, all declared (together in [examples/Physics/joints.html](examples/Physics/joints.html)):

```html
<garden-physics debug="moving"></garden-physics>
<!-- A gate on a hinge, a ball on a rope, a wheel on a motor. -->
<garden-joint type="hinge" between="#post #gate" pivot-a="0.15 0 0" pivot-b="-1 0 0" axis-a="0 1 0" limits="angular-x -1.57 1.57"></garden-joint>
<garden-joint type="distance" between="#beam #ball" min-distance="0" max-distance="3"></garden-joint>
<garden-joint type="hinge" between="#axle #wheel" axis-a="0 0 1" axis-b="0 1 0" motor="1.5"></garden-joint>
<!-- 120 bricks as one mesh, each its own body; an explosion to knock them down. -->
<garden-box width="0.9" height="0.45" depth="0.45" grid="12 5 2" grid-spacing="1 0.45 0.5" physics mass="0.5"></garden-box>
<garden-force id="blast" type="explosion" position="0 1 3" radius="6" strength="4" falloff="linear"></garden-force>
<!-- A character that falls as a ragdoll when knocked over. -->
<garden-mesh-model src="guy.glb" play="Idle">
  <garden-ragdoll><garden-ragdoll-bone bones="Hips" size="0.25"></garden-ragdoll-bone>...</garden-ragdoll>
</garden-mesh-model>
```

| Piece | What it does |
|---|---|
| `<garden-joint>` | A joint between two bodies (`between="#a #b"`): `ball`, `distance` (a rod; a rope with `min-distance`), `hinge`, `slider`, `prismatic`, `lock`, `spring`, `six-dof`; `pivot-a`/`-b`, `axis-a`/`-b`, `limits="angular-x 0 1.57, ..."`, `motor` (speed, live) and `motor-force`, `collisions`. Joins rebuilt bodies again (`test:joint`) |
| `<garden-force>` | `explosion` (once), `gravity`, `updraft`, `vortex` (fields): `position`, `radius`, `strength`, `height`, `falloff`; `event="load"`, `delay`, `duration`, `show`; `fire()`/`stop()`, `garden-force` event (`test:force`) |
| `physics.raycast(from, to, { ignore, triggers })` | The first body on a line: `{ element, point, normal, distance, instance }`, or null. Aim lines, line of sight, what's under the pointer (`test:raycast`) |
| `grid="nx ny nz"` | Any mesh repeated as GPU thin instances, `grid-spacing` apart, `instance-colours` (`random` or a list); with `physics` each copy is a body; picking and raycasts say which copy (`test:raycast`) |
| `<garden-ragdoll>` | In a rigged `<garden-mesh-model>`, with a `<garden-ragdoll-bone>` per bone group (`bones`, `size`/`width`/`height`/`depth`, `box-offset`, `rotation-axis`, `min`/`max`, `joint`): boxes ride the animation until `limp` (or `limp()`), then it falls; `impulse(v, bone)`; `garden-ragdoll` event. The skeleton's top bone must have a box (`test:ragdoll`) |
| `<garden-physics debug>` | Wireframes of every body (`debug="moving"`: not the static ones) |

**Extra cameras** (`test:viewport`): a second `<garden-camera viewport="x y w h">` (fractions,
from the bottom-left) is drawn over the main one -- a picture-in-picture view, a rear-view mirror,
an overhead map. It takes no input unless it has `controls`. `layer-mask` on cameras and meshes
says which camera sees what (a roof hidden from the overhead camera). `rotation` (degrees) turns a
`free` camera, and the meshes inside a `<garden-camera parent>` ride with it.

**Sprites** (`test:sprite`, `test:picking`): `<garden-sprite cells="0 40" cell-delay="100">` plays a sprite
sheet's cells in turn (`cell-loop="false"` once); `cell="5"` shows one, still, and
`cell="0 18 44"` gives each sprite its own (taken in turn). `angle` turns them (degrees, a
list taken in turn too); `pickable` lets the pointer pick them. Without `capacity`, the
sheet has room for every sprite placed.

**Picking, rays and touching** (`test:picking`, `test:overlap`): what's under the pointer, what a
line meets, what touches what -- the questions a game asks every frame -- without physics.

```html
<garden-box id="turret" ray ray-length="50" ray-show="#ff0000" face-pointer></garden-box>
<garden-sphere diameter="0.3" at-pointer emissive-colour="#00ff00"></garden-sphere>
<garden-sphere overlap="#spikes" overlap-precise emissive-colour="#ffffff">
  <garden-action trigger="garden-overlap" type="set" property="material.emissiveColor" value="#ff0000"></garden-action>
</garden-sphere>
<garden-sprite url="players.png" width="64" height="64" positions="0 0 0, 1 0 0" count="1" pickable>
  <garden-action trigger="garden-pick" type="increment" property="angle" value="0.5"></garden-action>
</garden-sprite>
```

| Piece | What it does |
|---|---|
| `sceneEl.pick(x, y, { ignore, sprites })`, `sceneEl.pickRay(origin, direction, length, options)` | The nearest mesh or pickable sprite under a screen point (default the pointer) or along a line: `{ element, mesh, sprite, index, point, normal, distance }`; a model's parts give the model's element; `index` is the sprite (or `grid` copy) |
| `garden-pick` | Fired (bubbling) on the element pressed, mesh or sprite; `detail` is the hit, with `sprite` and `index` for a sprite |
| `ray` | A ray out of the mesh along its own `"x y z"` (bare: straight ahead), turning with it: `element.rayHit`, `garden-ray-hit` / `garden-ray-miss` when what it meets changes; `ray-length` (100), `ray-show` (a line; `#rrggbb`), `ray-ignore` |
| `face-pointer`, `at-pointer` | Turn about the vertical to face where the pointer meets the scene; put the mesh there (`at-pointer="0 0.5 0"`: an offset); `pointer-ignore`; `element.pointerHit` |
| `overlap` | `garden-overlap` / `garden-overlap-end` when the mesh's box starts or stops touching another's (`overlap="#a, #b"`); `overlap-precise` uses their own turned boxes; `overlap-point="x y z"` a point; `element.overlapping` |
| `<garden-launcher>` | A tap or click (in VR, a controller's trigger; `hand="right"` for one hand) throws a copy of its `<template>` along the pointer's ray: `speed`, `offset`, `max`; `garden-launch`, `fire(origin, direction)`, `clear()` (`test:throw`) |
| `<garden-webxr physics-controllers physics-headset>` | Bodies on the VR controllers or hands (the value is their size, default 0.1 m) and on the head: knock things over, bat a ball, headbutt it (`test:throw` checks it stays quiet without WebXR) |
| `<garden-action trigger="garden-...">` | On any DOM event from inside its parent: `type="set"` or `"increment"` a `property` path (`material.emissiveColor`, `position.y`, a sprite's `angle`) of the element the event came from (the sprite picked, its light, its mesh), or of `target`; `value` a colour, number, boolean or `"x y z"` |

**Materials and light** (`test:overlap`): `<garden-material>` takes `wireframe`, `back-faces`
(both sides drawn), `lighting="false"` (unlit, only its emissive colour) and `ambient-colour`
(its share of the scene's `ambient-colour`, set on `<garden-scene>`, live).
`<garden-light shadows shadow-filter="blur-exponential">` picks how the shadow's edges are
softened: `pcf` (default), `poisson`, `exponential`, `blur-exponential`, `close-exponential`,
`blur-close-exponential`, `contact-hardening` or `none` (live).

**`<garden-environment>`** (`test:environment`): Babylon's default environment, the lighting map
PBR models need plus an optional ground and sky (`ground`, `sky`, `colour`, `ground-shadow`,
`ground-size`, `ground-y`, `texture`).

# Building and using it

`npm run dev` builds `dist/juel-garden.js` (with esbuild), the global bundle
for a plain `<script>` tag: every element, plus all of Babylon as
`window.BABYLON`. `npm run build` minifies it. Havok's WASM and the
Draco/meshopt decoders are copied next to it.

In an app with a bundler, install the package (a git dependency works:
`npm install github:Jollify-Software/juel-garden`; `prepare` builds it) and
import it:

```js
import "juel-garden";                       // registers the <garden-*> elements
import { GardenMeshModel } from "juel-garden"; // and the classes, with types
```

That is the ES-module build (`npm run build:lib` → `lib/`), with
`@babylonjs/core` imported per module, so the bundler leaves out the parts of
Babylon juel-garden doesn't use (about 4.4 MB minified, against 7.5 MB for the
global bundle). Copy `HavokPhysics.wasm` and `decoders/` next to your page, or
point `<garden-physics wasm="...">` at it.

`npm run test:examples` opens every example in Chrome; `npm run test:lean`
does the same against the npm build, which catches a Babylon side-effect
import missing from `src/SideEffects.ts` (it skips pages that script the
global bundle's `BABYLON` or `JuelGarden`, which the npm build doesn't
define). Each feature has its own
`npm run test:*`.

# Related projects

## Changing, adding, moving and removing elements

Elements can be changed, added, moved and removed from script at any time:

- **Changing** an attribute (or its property) after the element has built applies it.
  `position`, `rotation` and `scale` alone move a mesh, a plain `<garden-element>` or a camera
  in place (a physics body is teleported). Anything else, `width`, `colour`, `texture`, `track`,
  `physics` and so on, builds the element again: its old mesh, own material and behaviours go,
  and its child elements' meshes stay with the new one. A `<garden-material>` or
  `<garden-texture>` that changes swaps itself into whatever wore the old one. A light, water,
  sound, marker, thumbstick or model changes in place (a model reloads only for a new file).
  Changing `id`, `class`, `style`, `slot`, `data-*` or `aria-*` builds nothing.

- **Moving** one (`appendChild`/`insertBefore` elsewhere, or anything else that removes it and
  adds it back in the same task) keeps what it built: the same mesh, water, light or sound.
  Under a different parent, a mesh follows a `parent`-tagged element's node (or leaves it), a
  physics body is teleported to match, and `<garden-rocks>`/`<garden-stone-wall>`, which sit on
  the ground where they are, are built again.
- **Removing** one for good disposes what it built a microtask later: its mesh, physics body,
  light, water, sky, sound, particles or model leave the scene, and its behaviours (`track`,
  `follow`, `walk`, …) stop. Materials stay; their `<garden-material>` owns them.
- **Adding it back** after that builds it again from its attributes.

`node tests/live.js` covers changes, `node tests/moved.js` moves and removals. A subclass
disposes its own objects by overriding `dispose()` (removed for good) and `unbuild()` (before a
rebuild for a change), each calling `super`; one whose `updated()` handles changes itself
returns true from `handlesChanges`. A script or behaviour ties per-frame work to an element's
build with `element.observe(scene.onBeforeRenderObservable, fn)` or `element.whenDisposed(fn)`:
it stops when the element rebuilds or goes.

## HTML on a surface (`texture="html"`)

A mesh with `texture="html"` wears its first child element, rasterised with html2canvas and
styled by the page's CSS like any other element (`npm run test:html-texture`):

```html
<style>.sign { width: 100%; height: 100%; padding: 40px; border-radius: 32px; background: #fbfaf6; font: 32px sans-serif; }</style>
<garden-plane width="1.8" height="1.2" position="0 1.5 3" texture="html"
    html-size="960 640" html-background="transparent" html-unlit>
  <div class="sign"><h1>Welcome</h1><p>Some <em>styled</em> text.</p></div>
</garden-plane>
```

- `html-size="w h"`: the CSS-pixel box the content is laid out in (else its own size).
- `html-resolution`: texture pixels per CSS pixel (default 1.5); the texture is that rounded to a
  power of two, at most `html-max-size` (default 2048) a side, mipmapped, so text stays sharp.
- `html-background`: the colour behind the content (default white); `transparent` lets rounded
  corners and cut-outs show the scene through.
- `html-unlit`: the content shows in its own colours whatever the lights.

The content moves into a hidden `<div class="garden-html-host">` at the top of `<body>` (inside
the scene it would push the canvas down), so select it by its own classes, not through the
`garden-*` element. Editing it redraws the texture (debounced); after a stylesheet change call
`element.renderHtml()`. Each draw fires `garden-html-rendered`. Draws are queued one at a time.
html2canvas is not a browser: it supports most CSS (gradients, rounded corners, web fonts once
loaded), but not filters, blend modes or some newer layout features, and images must be
same-origin or CORS-enabled.

A `<garden-waypoint>` stop with `look-at` (a selector or `"x y z"`) turns the camera to face it
while flying there (`npm run test:waypoint-look`); Parterre's slide platforms look at their panels.

## Parterre

[Parterre](../parterre) (`@C:\Jollify\parterre`) is a **generator that targets
this library**: annotated SVG floor plan in, a juel-garden scene out. It walks
the SVG with AngleSharp, maps each `data-fixture` element to a `<garden-room>` /
`<garden-stairs>` / `<garden-ground>` / wall, wraps the joinable ones in a
`<garden-structure>`, and drops the result into a `<garden-scene>` page with a
free camera and `<garden-webxr>`. The intended use is venues &mdash; museums,
galleries, shopping centres &mdash; publishing a walk-through 3D/VR map of their
space straight from a CAD/vector plan.

It is a separate C# repo (a sibling checkout, like `jellyfish-cli` is to
`Jellyfish`), not part of this build. It depends only on the **authoring
contract** for `<garden-structure>` and friends &mdash; the same markup a person
would write by hand &mdash; never on the juel-garden package itself. Practical
consequence for work in this repo: the attribute names and semantics of
`garden-structure` / `garden-room` / `garden-stairs` / `garden-ground` /
`garden-opening` are now a consumed API. If they change, update Parterre's
fixture handlers (`Parterre/Fixtures/`) and its `README` schema table to match.

This revives an idea first prototyped years ago as
`Api/Services/Generators/VirtualLayout`, which emitted A-Frame markup; the
target is now a first-party library.

## Games

Juel Garden is also the engine of games, not only venues and presentations:
a zero-gravity pool game built on its Havok physics (pocket cameras, an aim
guide, bodies coming to rest), and a third-person story game whose
characters, poses, held props, terrain, sky and water pieces now live here.
So physics, ragdolls, raycasts, extra cameras, shaders and post-processing
are in scope, and a change can break a game as well as Parterre: those games
build their scene markup from the same elements and call into the scene
directly (`window.BABYLON`, `camera.show()`, `garden-rest`).

# Contribution

Contribution would be greatly appreciated.  
In order to contribute please open a new issue or a discussion topic and we can talk about it.  
After you have created a issue, you should then fork the project to create your own repo, you can then make changes there.  
Changes should be made on a separate branch, it is a good idea to use prefixes like `feature/...` or `issue/...` when creating your branch.

> Pull requests will not be accepted unless they have a issue for them and reference that issue in the pull request.

I should also say that this is the first Open Source project I have created, so please be patient if I get things wrong.

## What I would like to achieve

* More examples and improvements.
  * ~~The positioning on the basic example is not quite right...~~ Fixed 2026-08-25 by giving the basic example's camera an explicit starting `position` -- the default arc camera starts at radius 3 around the origin, far too close to actually frame that example's group of shapes. `rotation` (degrees) now turns a `free` camera; an orbiting `arc` camera still takes only a `position`.
  * The temple example is my favourite but it need some improvement.
    * The rooms really need to touch the ground not be floating in the air. Perhaps we could add a ground level variable?
    * I would like the temple to have more rooms and also a roof, like an Aztec or Greek temple.
* `garden-structure` currently detects joins by bounding-box overlap, so it only works for axis-aligned, box-ish children (rooms, stairs). Rotated children or curved shapes (a `curvature` stairway, a dome roof) need a hand-placed `garden-opening` instead -- would be good to support those too.
* [WebXR](https://doc.babylonjs.com/divingDeeper/webXR/introToWebXR) is now available via a `<garden-webxr>` component (a sibling of `<garden-camera>`, same pattern as `<garden-light>`) -- see the [temple example](examples/Structures/temple.html) or the dedicated [webxr example](examples/Camera/webxr.html). It shows an "enter VR/AR" button when the browser/device supports it and does nothing otherwise, so `<garden-camera>` stays a full mouse/keyboard fallback either way.
  * Teleportation only works on meshes passed in as the `floor` attribute (defaults to every `<garden-ground>`) -- a room's floor is fused into the same collision mesh as its walls/ceiling, so interior rooms aren't teleport-targets yet. Worth revisiting once rooms expose their floor as a separate mesh.

