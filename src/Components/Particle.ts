import { Color4, ParticleHelper, ParticleSystem, Texture, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Colour4Convert } from "../Converters/Colour4Convert";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Utility } from "../Utility";

/**
 * A particle system, either one of Babylon's built-in preset effects
 * (`effect`, via `ParticleHelper`) or a fully custom one (the `url`/`colour1`/
 * etc. attributes below). Emits from the parent mesh's position when nested
 * inside one.
 *
 * Attributes: `effect` (a Babylon `ParticleHelper` preset name, e.g. `"fire"`
 * -- when set, the custom attributes below are ignored), `event`
 * (`"load"` auto-plays; `"pointerdown"` toggles on click via
 * {@link GardenMesh.modifyMesh}; anything else waits to be played on demand),
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

    updated() {
        let scene = this.getScene();
        if (this.effect) {
            ParticleHelper.CreateAsync(this.effect, scene).then((set) => {
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