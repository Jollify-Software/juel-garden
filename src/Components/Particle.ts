import { Color4 } from "@babylonjs/core/Maths/math.color";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshParticleEmitter } from "@babylonjs/core/Particles/EmitterTypes/meshParticleEmitter";
import { NoiseProceduralTexture } from "@babylonjs/core/Materials/Textures/Procedurals/noiseProceduralTexture";
import { Nullable } from "@babylonjs/core/types";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { ParticleHelper } from "@babylonjs/core/Particles/particleHelper";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { ParticleSystemSet } from "@babylonjs/core/Particles/particleSystemSet";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
import { Colour4Convert } from "../Converters/Colour4Convert";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Utility } from "../Utility";
import { Weather } from "./Weather";

/**
 * A particle system, either one of Babylon's built-in preset effects
 * (`effect`, via `ParticleHelper`) or a fully custom one (the `url`/`colour1`/
 * etc. attributes below). Emits from the parent mesh's position when nested
 * inside one.
 *
 * **Weather:** `preset="rain"`, `"snow"`, `"sand"` or `"dust-devil"` -- tuned
 * systems that need no image and play at once (see {@link Weather}). Rain,
 * snow and sand fall or blow round the camera; a dust devil spins on its
 * parent mesh, so it travels when the mesh does (`track`, `wander`).
 * `wind` (`"x y z"`, units/second) blows sand and leans rain and snow;
 * `size` scales the particles; `density` (0 = none, 1 = normal, 2 = a storm)
 * can be set from code at any time, e.g. ramped up as a storm builds.
 *
 * Attributes: `effect` (a Babylon `ParticleHelper` preset name, e.g. `"fire"`
 * -- when set, the custom attributes below are ignored), `event`
 * (`"load"` auto-plays; `"pointerdown"` toggles on click via
 * {@link "GardenMesh"!GardenMesh.modifyMesh}; anything else waits to be played on demand),
 * and for a custom system: `url`, `capacity`, `emitter`, `minemitbox`/
 * `maxemitbox`, `colour1`/`colour2`/`colourdead`, `minsize`/`maxsize`,
 * `minlifetime`/`maxlifetime`, `emitrate`, `direction1`/`direction2`,
 * `minemitpower`/`maxemitpower`, `minangularspeed`/`maxangularspeed`,
 * `updatespeed`, `gravity`, `billboard`
 * (`"all"` (default)|`"y"`|`"stretched"` -- stretched draws each particle as
 * a streak along its own current velocity instead of a flat sprite, e.g. for
 * stars rushing past a moving viewpoint: fast-moving particles read as long
 * comet-like lines rather than dots), `texture-mask` (`"r g b a"`: multiplies the
 * image, so `"0.1 0.8 0.8 1"` keeps mostly its green and blue -- one white image
 * as differently coloured sparks, or one channel of a packed image as the
 * particle's shape), `blend` (`"oneone"` (default: adds the image's colour, black is
 * clear), `"add"` (adds it, weighted by its alpha), `"standard"` (alpha-blended smoke and
 * glows), `"multiply"`, `"multiplyadd"`), `rendering-group` (Babylon's `renderingGroupId`:
 * group 0 draws first and a later group draws over it, e.g. a halo kept behind its mesh),
 * `local` (the particles move with the emitter mesh instead of being left behind),
 * `invert-y="false"` (the image not flipped, as a glTF-style sheet wants),
 * `minscalex`/`maxscalex`/`minscaley`/`maxscaley` (stretch each particle),
 * `mininitialrotation`/`maxinitialrotation` (radians). Any attribute left unset keeps Babylon's
 * own default for that property (e.g. angular speed 0), rather than NaN.
 * `capacity` has no Babylon default (the constructor needs one, and without it
 * the system grows without limit), so an unset one is {@link DefaultCapacity}.
 *
 * **Colour over life:** `colour-gradients` (`"0 r g b a, 0.4 r g b a, 1 r g b a"`, or
 * `#rrggbbaa` in place of the four numbers): the colour at each point of a particle's life
 * (0 born, 1 dead), in place of `colour1`/`colour2`/`colourdead` -- embers that fade in
 * yellow, burn red and fade out.
 *
 * **Turbulence:** `noise-strength` (`"x y z"`) pushes particles about with a Perlin noise
 * texture (Babylon's `NoiseProceduralTexture`, `noise-size` pixels, default 256);
 * `noise-speed` (default 1), `noise-octaves` (default 3), `noise-persistence` (default 0.8)
 * and `noise-brightness` (default 0.2) shape it.
 *
 * **Sprite sheets:** `sprite-cell` (`"width height"` of one cell, in pixels) makes the image
 * a sheet of cells; `sprite-cells` (`"first last"`, default all of them), `sprite-speed`
 * (Babylon's `spriteCellChangeSpeed`, default 1; 0 keeps each particle on its first cell)
 * and `sprite-random-start` (each particle starts on a random cell): wisps of vapour, all
 * different, from one image.
 *
 * **From a mesh's surface:** `surface` emits from random points on the parent mesh's
 * surface (Babylon's `MeshParticleEmitter`) instead of from a point or a box, following the
 * mesh as it moves. Inside a `<garden-mesh-model>`, `part="name"` emits from that named
 * part of the model (and implies `surface`). The particles leave along the surface's
 * normals, unless `direction1`/`direction2` are set (then in a random direction between
 * them); `use-normals="true"|"false"` says which outright. It builds once the model has loaded.
 *
 * **On and off:** `cycle="on off"` (seconds) plays the system for `on` seconds, stops it
 * for `off` (the particles out live out their lives) and repeats, from when it is played:
 * a geyser, or a blade that flares every few seconds.
 *
 * A custom system directly in the scene (not inside a mesh) emits from its
 * `emitter` point, and plays at once with `event="load"`. A changed attribute
 * builds the system again.
 *
 * @example
 * ```html
 * <garden-column position="-4 -5 -22" diameter="1" height="6">
 *   <garden-particle effect="fire"></garden-particle>
 * </garden-column>
 * <garden-particle preset="sand" wind="8 0 3" density="0.5"></garden-particle>
 * <garden-sphere diameter="0.1" wander wander-radius="20"><garden-particle preset="dust-devil"></garden-particle></garden-sphere>
 * <garden-mesh-model src="lantern.glb">
 *   <garden-particle part="flame" url="spark.png" blend="add" event="load" cycle="5 5"
 *       colour-gradients="0 1 0.8 0.2 0, 0.4 1 0.4 0.1 1, 1 0.3 0 0 0" noise-strength="6 6 4"></garden-particle>
 * </garden-mesh-model>
 * ```
 *
 * @category Components
 */
@customElement("garden-particle")
export class GardenParticle extends GardenElement {
    @property() effect: string;
    @property() event: string;
    @property({ type: Number }) capacity: number;
    @property({ type: Number }) minSize: number;
    @property({ type: Number }) maxSize: number;
    @property({ type: Number }) emitRate: number;
    @property({ type: Number }) minLifeTime: number;
    @property({ type: Number }) maxLifeTime: number;

    @property({ type: Number }) minAngularSpeed: number;
    @property({ type: Number }) maxAngularSpeed: number;
    @property({ type: Number }) minEmitPower: number;
    @property({ type: Number }) maxEmitPower: number;
    @property({ type: Number }) updateSpeed: number;

    @property() billboard: string;

    @property() url: string;
    @property({ converter: Vector3Convert.fromString }) emitter: Vector3;
    @property({ converter: Vector3Convert.fromString }) minEmitBox: Vector3;
    @property({ converter: Vector3Convert.fromString }) maxEmitBox: Vector3;
    @property({ converter: Colour4Convert.fromString }) colour1: Color4;
    @property({ converter: Colour4Convert.fromString }) colour2: Color4;
    @property({ converter: Colour4Convert.fromString }) colourDead: Color4;
    @property({ attribute: "texture-mask", converter: Colour4Convert.fromString }) textureMask: Color4;

    @property({ converter: Vector3Convert.fromString }) direction1: Vector3;
    @property({ converter: Vector3Convert.fromString }) direction2: Vector3;
    @property({ converter: Vector3Convert.fromString }) gravity: Vector3;

    @property({ type: Number }) minScaleX: number;
    @property({ type: Number }) maxScaleX: number;
    @property({ type: Number }) minScaleY: number;
    @property({ type: Number }) maxScaleY: number;
    @property({ type: Number }) minInitialRotation: number;
    @property({ type: Number }) maxInitialRotation: number;

    /** Emit from the parent mesh's surface. */
    @property({ type: Boolean }) surface: boolean;
    /** Inside a `<garden-mesh-model>`: emit from the surface of its part with this name. */
    @property({ attribute: "part" }) partName: string;
    @property({ attribute: "use-normals" }) useNormals: string;
    @property({ attribute: "colour-gradients" }) colourGradients: string;
    @property({ attribute: "noise-strength", converter: Vector3Convert.fromString }) noiseStrength: Vector3;
    @property({ attribute: "sprite-cell" }) spriteCell: string;
    @property({ attribute: "sprite-cells" }) spriteCells: string;
    @property({ attribute: "sprite-speed", type: Number }) spriteSpeed: number;
    @property({ attribute: "sprite-random-start", type: Boolean }) spriteRandomStart: boolean;
    @property({ type: Boolean }) local: boolean;
    @property({ attribute: "rendering-group", type: Number }) renderingGroup: number;
    @property() blend: string;
    @property() cycle: string;

    /** The particle limit of a custom system whose `capacity` is unset or not a positive number. */
    static DefaultCapacity = 2000;

    particleSystem: ParticleSystem;
    isPlaying: boolean = false;

    private weather: Weather.WeatherSystem;
    private effectSet: ParticleSystemSet;
    private _density: number;

    /** How much weather, for a `preset`: 0 none, 1 the preset's normal amount, more for a storm. */
    get density(): number {
        return this._density ?? (this.hasAttribute("density") ? Number(this.getAttribute("density")) : 1);
    }
    set density(value: number) {
        this._density = Math.max(0, value);
        if (this.weather)
            this.weather.system.emitRate = this.weather.baseRate * this._density;
    }

    updated() {
        let scene = this.getScene();
        // A rebuild for a changed attribute: the last build's system goes first, or it
        // carried on running (and drawing) beside the new one, and outlived the element.
        this.disposeSystems();
        let count = ++this.buildCount;
        let preset = this.getAttribute("preset");
        if (preset) {
            this.buildWeather(preset);
            return;
        }
        if (this.effect) {
            ParticleHelper.CreateAsync(this.effect, scene).then((set) => {
                // Removed for good while it was being made.
                if (!this.parentElement) {
                    set.dispose();
                    return;
                }
                // Two changes close together: the set made for the first is replaced, not kept.
                this.effectSet?.dispose();
                this.effectSet = set;
                if ('mesh' in this.parentElement) {
                    // World position, not the raw local `.position` -- so the emitter is
                    // right even when the parent mesh is nested under a <garden-element
                    // parent position="..."> group. Each system gets its own copy.
                    let mesh = (<GardenMesh>this.parentElement).mesh;
                    mesh.computeWorldMatrix(true);
                    let origin = mesh.getAbsolutePosition().clone();
                    if (this.parentElement.hasAttribute("height"))
                        origin.y += Number(this.parentElement.getAttribute("height"));
                    set.systems.forEach(s => s.emitter = origin.clone());
                }
                set.start();
            });
        } else if (this.surface || this.partName) {
            this.buildOnSurface(count);
        } else {
            this.buildCustom();
        }
    }

    /** Counts builds, so a surface build still waiting for its mesh knows a newer one replaced it. */
    private buildCount = 0;

    /** `surface`/`part`: waits for the parent mesh (a model has to load), then builds on its surface. */
    private async buildOnSurface(count: number) {
        this.beginBuild();
        try {
            await GardenElement.whenDocumentReady();
            let parent = this.parentElement as any;
            if (parent?.whenReady)
                await parent.whenReady;
            if (count != this.buildCount || this.parentElement != parent)
                return;
            let mesh: AbstractMesh = this.partName
                ? (typeof parent?.getPart == "function" ? parent.getPart(this.partName) : null)
                : parent?.mesh;
            if (!mesh) {
                console.warn(this.partName
                    ? `<garden-particle part="${this.partName}">: the parent has no part of that name.`
                    : "<garden-particle surface> needs to be inside a mesh.");
                return;
            }
            this.buildCustom(mesh);
        } finally {
            this.endBuild();
        }
    }

    /** A custom system (the `url`, `colour1`... attributes), from `surfaceMesh`'s surface when given. */
    private buildCustom(surfaceMesh?: AbstractMesh) {
        let scene = this.getScene();
        let sheet = (this.spriteCell ?? "").trim().split(/\s+/).map(Number).filter(n => n > 0);
        this.particleSystem = new ParticleSystem("particles",
            this.capacity > 0 ? this.capacity : GardenParticle.DefaultCapacity, scene, null, sheet.length > 0);
        this.particleSystem.particleTexture = new Texture(this.url, scene, false, this.getAttribute("invert-y") != "false");

        // Only the attributes the element sets: an unset one is `undefined`, and assigning
        // that would replace Babylon's default with NaN (e.g. no min/max-angular-speed made
        // every particle's angle NaN after its first update, so only newborns were drawn).
        const ps = this.particleSystem;
        const set = <K extends keyof ParticleSystem>(key: K, value: ParticleSystem[K]) => {
            if (value !== undefined && value !== null && !(typeof value == "number" && isNaN(value)))
                ps[key] = value;
        };
        set("emitter", this.emitter); // the point at the top of the fountain
        set("minEmitBox", this.minEmitBox); // minimum box dimensions
        set("maxEmitBox", this.maxEmitBox); // maximum box dimensions

        set("color1", this.colour1);
        set("color2", this.colour2);
        set("colorDead", this.colourDead);
        ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;

        set("minSize", this.minSize);
        set("maxSize", this.maxSize);
        set("minLifeTime", this.minLifeTime);
        set("maxLifeTime", this.maxLifeTime);

        set("emitRate", this.emitRate);

        set("direction1", this.direction1);
        set("direction2", this.direction2);
        set("minEmitPower", this.minEmitPower);
        set("maxEmitPower", this.maxEmitPower);
        set("updateSpeed", this.updateSpeed);
        set("minAngularSpeed", this.minAngularSpeed);
        set("maxAngularSpeed", this.maxAngularSpeed);

        set("gravity", this.gravity);
        set("textureMask", this.textureMask);
        set("minScaleX", this.minScaleX);
        set("maxScaleX", this.maxScaleX);
        set("minScaleY", this.minScaleY);
        set("maxScaleY", this.maxScaleY);
        set("minInitialRotation", this.minInitialRotation);
        set("maxInitialRotation", this.maxInitialRotation);
        set("renderingGroupId", this.renderingGroup);
        if (this.blend)
            ps.blendMode = GardenParticle.blendMode(this.blend);
        if (this.local)
            ps.isLocal = true;

        for (let [gradient, colour] of GardenParticle.parseGradients(this.colourGradients))
            ps.addColorGradient(gradient, colour);

        if (this.noiseStrength) {
            let number = (name: string) => {
                let value = Number(this.getAttribute(name));
                return this.getAttribute(name) && Number.isFinite(value) ? value : undefined;
            };
            let noise = new NoiseProceduralTexture("particle-noise", number("noise-size") ?? 256, scene);
            noise.animationSpeedFactor = number("noise-speed") ?? noise.animationSpeedFactor;
            noise.octaves = number("noise-octaves") ?? noise.octaves;
            noise.persistence = number("noise-persistence") ?? noise.persistence;
            noise.brightness = number("noise-brightness") ?? noise.brightness;
            ps.noiseTexture = noise; // disposed with the system
            ps.noiseStrength = this.noiseStrength;
        }

        if (sheet.length > 0) {
            ps.spriteCellWidth = sheet[0];
            ps.spriteCellHeight = sheet[1] ?? sheet[0];
            let cells = (this.spriteCells ?? "").trim().split(/\s+/).filter(c => c).map(Number);
            if (cells.length > 0) {
                ps.startSpriteCellID = cells[0];
                ps.endSpriteCellID = cells[1] ?? cells[0];
            } else {
                // Every cell, once the image's size is known.
                let texture = ps.particleTexture as Texture;
                let all = () => {
                    let size = texture.getBaseSize();
                    ps.startSpriteCellID = 0;
                    ps.endSpriteCellID = Math.max(0, Math.floor(size.width / ps.spriteCellWidth) * Math.floor(size.height / ps.spriteCellHeight) - 1);
                };
                if (texture.isReady()) all();
                else texture.onLoadObservable.addOnce(all);
            }
            set("spriteCellChangeSpeed", this.spriteSpeed);
            ps.spriteRandomStartCell = !!this.spriteRandomStart;
        }

        if (surfaceMesh) {
            let emitter = new MeshParticleEmitter(surfaceMesh);
            emitter.useMeshNormalsForDirection = this.useNormals != null
                ? this.useNormals != "false"
                : !(this.direction1 || this.direction2);
            if (this.direction1) emitter.direction1 = this.direction1.clone();
            if (this.direction2) emitter.direction2 = this.direction2.clone();
            ps.particleEmitterType = emitter;
            ps.emitter = surfaceMesh;
        }

        if (this.billboard)
            this.particleSystem.billboardMode = StaticConvert.particleBillboardMode(this.billboard);

        // play() can arrive before this first build (the parent GardenMesh's setTimeout(0)
        // auto-play races the child's own update): start the system it asked for now. Directly
        // in the scene, no mesh plays it: event="load" starts it here.
        if (this.isPlaying || (this.event == "load" && !(this.parentElement && 'mesh' in this.parentElement)))
            this.play();
    }

    private async buildWeather(preset: string) {
        if (!Weather.Presets.includes(preset)) {
            console.warn(`<garden-particle preset="${preset}"> is not one of ${Weather.Presets.join(", ")}.`);
            return;
        }
        this.beginBuild();
        await GardenElement.whenDocumentReady();
        let parent = this.parentElement as GardenElement;
        let anchor = null;
        if (parent && parent.localName != "garden-scene" && typeof parent.getNode == "function") {
            await parent.whenReady;
            anchor = parent.getNode();
        }
        this.weather?.dispose();
        let size = this.getAttribute("size");
        this.weather = Weather.create(preset, this.getScene(), anchor, {
            wind: Vector3Convert.fromString(this.getAttribute("wind")),
            colour: this.colour1,
            size: size ? Number(size) : undefined,
        });
        this.particleSystem = this.weather.system;
        this.density = this.density;
        // Weather plays at once unless told to wait.
        if ((this.event ?? "load") == "load" || this.isPlaying)
            this.play();
        this.endBuild();
    }

    /** Disposes the system (custom, effect set or weather) the last build made. */
    private disposeSystems() {
        if (this.weather) {
            // The weather's system is `particleSystem` too: only the weather disposes it, as
            // it keeps the dot texture every weather system in the scene shares.
            this.weather.dispose();
            this.weather = null;
            this.particleSystem = null;
        }
        this.effectSet?.dispose();
        this.effectSet = null;
        // A custom system's own texture goes with it.
        this.particleSystem?.dispose();
        this.particleSystem = null;
    }

    protected dispose() {
        this.stopCycle();
        this.disposeSystems();
        super.dispose();
    }

    /** Starts the system (and its `cycle`); if it isn't built yet, it starts as soon as it is. */
    play() {
        this.isPlaying = true;
        this.particleSystem?.start();
        if (this.particleSystem)
            this.startCycle();
    }

    stop() {
        this.isPlaying = false;
        this.stopCycle();
        this.particleSystem?.stop();
    }

    private cycleObserver: Nullable<Observer<Scene>>;
    private cycleScene: Scene;

    /** `cycle="on off"`: stops and starts the system in turn, by the scene's clock. */
    private startCycle() {
        this.stopCycle();
        let [on, off] = (this.cycle ?? "").trim().split(/[\s,]+/).map(Number);
        if (!(on > 0) || !(off > 0))
            return;
        let scene = this.cycleScene = this.getScene();
        let system = this.particleSystem, elapsed = 0, running = true;
        this.cycleObserver = scene.onBeforeRenderObservable.add(() => {
            if (this.particleSystem != system) {
                this.stopCycle(); // rebuilt: the new system's play() starts its own
                return;
            }
            elapsed += scene.getEngine().getDeltaTime() / 1000;
            let limit = running ? on : off;
            if (elapsed < limit)
                return;
            elapsed -= limit;
            running = !running;
            if (running) system.start();
            else system.stop();
        });
    }

    private stopCycle() {
        if (this.cycleObserver)
            this.cycleScene?.onBeforeRenderObservable.remove(this.cycleObserver);
        this.cycleObserver = null;
    }

    /** A `blend` name as Babylon's blend mode (`oneone` for one it doesn't know). */
    static blendMode(name: string): number {
        switch (name.trim().toLowerCase()) {
            case "add": return ParticleSystem.BLENDMODE_ADD;
            case "standard": return ParticleSystem.BLENDMODE_STANDARD;
            case "multiply": return ParticleSystem.BLENDMODE_MULTIPLY;
            case "multiplyadd": return ParticleSystem.BLENDMODE_MULTIPLYADD;
            default: return ParticleSystem.BLENDMODE_ONEONE;
        }
    }

    /** `"0 r g b a, 0.5 #rrggbbaa, ..."` as [gradient, colour] pairs; a malformed entry is skipped. */
    static parseGradients(value: string): [number, Color4][] {
        let out: [number, Color4][] = [];
        for (let entry of (value ?? "").split(",")) {
            let parts = entry.trim().split(/\s+/);
            let gradient = Number(parts[0]);
            if (parts.length < 2 || !parts[0] || !Number.isFinite(gradient))
                continue;
            let colour: Color4;
            if (parts[1].startsWith("#")) {
                if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(parts[1]))
                    continue;
                colour = Color4.FromHexString(parts[1].length == 7 ? parts[1] + "ff" : parts[1]);
            } else {
                let n = parts.slice(1).map(Number);
                if (n.length < 3 || n.some(x => !Number.isFinite(x)))
                    continue;
                colour = new Color4(n[0], n[1], n[2], n[3] ?? 1);
            }
            out.push([gradient, colour]);
        }
        return out;
    }

    toggle() {
        if (this.isPlaying == true) {
            this.stop();
        } else {
            this.play();
        }
    }
}