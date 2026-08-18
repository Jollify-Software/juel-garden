import { Animatable, Animation } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { ObjectConverter } from "../Converters/ObjectConverter";
import { StaticConvert } from "../Converters/StaticConvert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";

@customElement("garden-animation")
export class GardenAnimation extends GardenElement {
    @property() target: string;
    @property() property: string;
    @property() event: string;
    @property({ converter: StaticConvert.animationType }) type: number;
    @property({ type: Number }) from: number;
    @property({ type: Number }) to: number;
    @property({ type: Boolean }) loop: boolean = false;
    @property({ converter: StaticConvert.animationLoopMode }) loopmode: number;
    @property() keyframes: string;
    @property({ type: Number }) speed: number;

    // Built once and reused -- play() can be called repeatedly (e.g. by a
    // <garden-button> toggling it on/off), and re-pushing a fresh Animation onto
    // mesh.animations on every call would leave older ones still running underneath.
    private animation: Animation;

    play(el: GardenMesh): Animatable {
        let targetEl = el;
        if (this.target) {
            targetEl = document.getElementById(this.target) as GardenMesh;
        }
        let target: any;
        let scene = this.getScene();
        switch (this.type) {
            case "skeleton":
                target = (<GardenSkeletonMesh>targetEl).skeleton;
                return scene.beginAnimation(target, this.from, this.to, this.loop, this.speed);
            default:
                if (!this.animation) {
                    this.animation = new Animation("animation", this.property, this.speed,
                        this.type, this.loopmode);
                    this.animation.setKeys(ObjectConverter.keyframeRay(this.keyframes));
                }
                if (!targetEl.mesh.animations)
                    targetEl.mesh.animations = []
                if (targetEl.mesh.animations.indexOf(this.animation) < 0)
                    targetEl.mesh.animations.push(this.animation);
                target = targetEl.mesh;
                return scene.beginAnimation(target, this.from, this.to, this.loop);
        }
    }

    stop(el: GardenMesh) {
        let targetEl = el;
        if (this.target) {
            targetEl = document.getElementById(this.target) as GardenMesh;
        }
        let target = this.type === "skeleton" ? (<GardenSkeletonMesh>targetEl).skeleton : targetEl.mesh;
        this.getScene().stopAnimation(target);
    }
}