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
 * `minemitpower`/`maxemitpower`, `updatespeed`, `gravity`, `billboard`
 * (`"all"` (default)|`"y"`|`"stretched"` -- stretched draws each particle as
 * a streak along its own current velocity instead of a flat sprite, e.g. for
 * stars rushing past a moving viewpoint: fast-moving particles read as long
 * comet-like lines rather than dots).
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

    particleSystem: ParticleSystem;
    isPlaying: boolean = false;

    updated() {
        let scene = this.getScene();
        if (this.effect) {
            ParticleHelper.CreateAsync(this.effect, scene).then((set) => {
                if ('mesh' in this.parentElement) {
                    //var node = Utility.nodeFromMesh(
                    //    (<GardenMesh>this.parentElement).mesh
                    //);
                    set.systems.forEach(s => s.emitter = (<GardenMesh>this.parentElement).mesh.position)
                }
                if (this.parentElement.hasAttribute("height")) {
                    let h = Number(this.parentElement.getAttribute("height"));
                    set.systems.forEach(s => s.emitter = (<Vector3>s.emitter).add(
                        new Vector3(0, h, 0)
                    ));
                }
                set.start();
            });
        } else {
        this.particleSystem = new ParticleSystem("particles", this.capacity, scene);
        this.particleSystem.particleTexture = new Texture(this.url, scene);

        this.particleSystem.emitter = this.emitter; // the point at the top of the fountain
        this.particleSystem.minEmitBox = this.minEmitBox; // minimum box dimensions
this.particleSystem.maxEmitBox = this.maxEmitBox; // maximum box dimensions

this.particleSystem.color1 = this.colour1;
this.particleSystem.color2 = this.colour2;
this.particleSystem.colorDead = this.colourDead;
this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;

this.particleSystem.minSize = this.minSize;
this.particleSystem.maxSize = this.maxSize;
this.particleSystem.minLifeTime = this.minLifeTime;
this.particleSystem.maxLifeTime = this.maxLifeTime;

this.particleSystem.emitRate = this.emitRate;

this.particleSystem.direction1 = this.direction1;
this.particleSystem.direction2 = this.direction2;
this.particleSystem.minEmitPower = this.minEmitPower;
this.particleSystem.maxEmitPower = this.maxEmitPower;
this.particleSystem.updateSpeed = this.updateSpeed;
this.particleSystem.minAngularSpeed = this.minAngularSpeed;
this.particleSystem.maxAngularSpeed = this.maxAngularSpeed;

this.particleSystem.gravity = this.gravity;

if (this.billboard)
    this.particleSystem.billboardMode = StaticConvert.particleBillboardMode(this.billboard);
        }
    }

    play() {
        this.particleSystem.start();
        this.isPlaying = true;
    }

    stop() {
        this.particleSystem.stop();
        this.isPlaying = false;
    }

    toggle() {
        if (this.isPlaying == true) {
            this.stop();
        } else {
            this.play();
        }
    }
}