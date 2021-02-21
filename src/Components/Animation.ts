import { customElement, property } from "lit-element";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";

@customElement("juel-animation")
export class JuelAnimation extends GardenElement {
    @property() target: string;
    @property() event: string;
    @property() type: string;
    @property({ type: Number }) from: number;
    @property({ type: Number }) to: number;
    @property({ type: Boolean }) loop: boolean = false;
    @property({ type: Number }) speed: number;

    play() {
        let targetEl = document.getElementById(this.target);
        let target: any;
        switch (this.type) {
            case "skeleton":
                target = (<GardenSkeletonMesh>targetEl).skeleton;
        }

        let scene = this.getScene();
        scene.beginAnimation(target, this.from, this.to, this.loop, this.speed);
    }
}