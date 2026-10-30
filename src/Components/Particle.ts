import { Color4 } from "@babylonjs/core/Maths/math.color";
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
 * comet-like lines rather than dots). Any attribute left unset keeps Babylon's
 * own default for that property (e.g. angular speed 0), rather than NaN.
 * `capacity` has no Babylon default (the constructor needs one, and without it
 * the system grows without limit), so an unset one is {@link DefaultCapacity}.
 *
 * @example
 * ```html
 * <garden-column position="-4 -5 -22" diameter="1" height="6">
 *   <garden-particle effect="fire"></garden-particle>
 * </garden-column>
 * <garden-particle preset="sand" wind="8 0 3" density="0.5"></garden-particle>
 * <garden-sphere diameter="0.1" wander wander-radius="20"><garden-particle preset="dust-devil"></garden-particle></garden-sphere>
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

    @property({ converter: Vector3Convert.fromString }) direction1: Vector3;
    @property({ converter: Vector3Convert.fromString }) direction2: Vector3;
    @property({ converter: Vector3Convert.fromString }) gravity: Vector3;

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
        } else {
        this.particleSystem = new ParticleSystem("particles",
            this.capacity > 0 ? this.capacity : GardenParticle.DefaultCapacity, scene);
        this.particleSystem.particleTexture = new Texture(this.url, scene);

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

if (this.billboard)
    this.particleSystem.billboardMode = StaticConvert.particleBillboardMode(this.billboard);

        // play() can arrive before this first build (the parent GardenMesh's setTimeout(0)
        // auto-play races the child's own update): start the system it asked for now.
        if (this.isPlaying)
            this.particleSystem.start();
        }
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
        this.disposeSystems();
        super.dispose();
    }

    /** Starts the system; if it isn't built yet, it starts as soon as it is. */
    play() {
        this.isPlaying = true;
        this.particleSystem?.start();
    }

    stop() {
        this.isPlaying = false;
        this.particleSystem?.stop();
    }

    toggle() {
        if (this.isPlaying == true) {
            this.stop();
        } else {
            this.play();
        }
    }
}