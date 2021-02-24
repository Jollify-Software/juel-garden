import { Color4, ParticleSystem, Texture, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { Colour4Convert } from "../Converters/Colour4Convert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";

@customElement("juel-particle")
export class JuelParticle extends GardenElement {
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
        console.log(this.emitter)
        let scene = this.getScene();
        this.particleSystem = new ParticleSystem("particles", this.capacity, scene);
        this.particleSystem.particleTexture = new Texture(this.url, scene);

        this.particleSystem.emitter = this.emitter; // the point at the top of the fountain
        this.particleSystem.minEmitBox = this.minEmitBox; // minimum box dimensions
this.particleSystem.maxEmitBox = this.maxEmitBox; // maximum box dimensions

this.particleSystem.color1 = this.colour1;
this.particleSystem.color2 = this.colour2;
this.particleSystem.colorDead = this.colourDead;
this.particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

this.particleSystem.minSize = this.minSize;
this.particleSystem.maxSize = this.maxSize;
this.particleSystem.minLifeTime = this.minLifeTime;
this.particleSystem.maxLifeTime = this.maxLifeTime;

this.particleSystem.emitRate = this.emitRate;

this.particleSystem.direction1 = this.direction1;
this.particleSystem.direction2 = this.direction1;
this.particleSystem.minEmitPower = this.minEmitPower;
this.particleSystem.maxEmitPower = this.maxEmitPower;
this.particleSystem.updateSpeed = this.updateSpeed;

this.particleSystem.gravity = this.gravity;

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