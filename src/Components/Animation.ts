import { Animation } from "babylonjs";
import { customElement, property } from "lit-element";
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

    play(el: GardenMesh) {
        let targetEl = el;
        if (this.target) {
            targetEl = document.getElementById(this.target) as GardenMesh;
        }
        console.log(targetEl)
        let target: any;
        let scene = this.getScene();
        switch (this.type) {
            case "skeleton":
                target = (<GardenSkeletonMesh>targetEl).skeleton;
                scene.beginAnimation(target, this.from, this.to, this.loop, this.speed);
                break;
            default:
                let anime = new Animation("animation", this.property, this.speed,
                    this.type, this.loopmode);
                anime.setKeys(ObjectConverter.keyframeRay(this.keyframes));
                if (!targetEl.mesh.animations)
                    targetEl.mesh.animations = []
                targetEl.mesh.animations.push(anime);
                target = targetEl.mesh;
                scene.beginAnimation(target, this.from, this.to, this.loop);
                break;
        }

        
    }
}