import { Animation, Camera, PointerEventTypes, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-waypoint")
export class JuelWaypoint extends GardenElement {
    @property() waypoints: GardenMesh[];
    @property({ converter: Vector3Convert.fromString }) offset: Vector3;
    @property({ type: Number }) speed: number;
    index: number = 0;

    updated() {
        setTimeout(() => {
            if (typeof this.waypoints === 'string') {

                this.waypoints = (<any>this.waypoints).split(' ').map(x => document.getElementById(x) as GardenMesh);
                let scene = this.getScene();
                this.setPosition(this.waypoints[this.index].getPosition());

                scene.onPointerObservable.add((pointerInfo) => {
                    switch (pointerInfo.type) {
                        case PointerEventTypes.POINTERDOWN:
                            if (pointerInfo.pickInfo.hit) {
                                let wp = this.waypoints.find(x => x.mesh == pointerInfo.pickInfo.pickedMesh)
                                if (wp) {
                                    this.moveToPosition(wp.getPosition());
                                    this.index = this.waypoints.indexOf(wp);
                                }
                            }
                            break;
                    }
                });
            }
        });
    }

    moveToPosition(position: Vector3) {
        let scene = this.getScene();
        let anime = new Animation("anime", "position", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE, false);
        anime.setKeys([
            {
                frame: 0,
                value: this.waypoints[this.index].getPosition().add(this.offset)
            },
            {
                frame: 100,
                value: position.add(this.offset)
            }
        ]);
        (<Camera>(<any>this.parentElement).camera).animations = [];
        (<Camera>(<any>this.parentElement).camera).animations.push(anime);
        console.log((<any>this.parentElement).camera);
        scene.beginAnimation((<any>this.parentElement).camera, 0, 100, false);
    }

    setPosition(pos: Vector3) {
        if (this.offset)
            pos = pos.add(this.offset);

        console.log(pos);
        (<any>this.parentElement).setPosition(pos);
    }

    next() {
        this.index++;
        if (this.index >= this.waypoints.length) {
            this.index = 0;
        }
        this.setPosition(this.waypoints[this.index].getPosition());
    }
}