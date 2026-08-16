import { Animation, Camera, PointerEventTypes, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-waypoint")
export class GardenWaypoint extends GardenElement {
    @property() waypoints: GardenMesh[];
    @property({ converter: Vector3Convert.fromString }) offset: Vector3;
    @property({ type: Number }) speed: number;
    index: number = 0;
    prevWaypoint: GardenMesh;

    async updated() {
        if (typeof this.waypoints !== 'string')
            return;

        this.beginBuild();
        try {
            // Waypoints are resolved by id from anywhere in the document, so we can't
            // proceed until the whole document has actually been parsed.
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve =>
                    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
                );
            }

            this.waypoints = await GardenElement.resolveReady<GardenMesh>(<string>this.waypoints);

            let scene = this.getScene();
            this.setPosition(this.waypoints[this.index].getPosition());

            scene.onPointerObservable.add((pointerInfo) => {
                switch (pointerInfo.type) {
                    case PointerEventTypes.POINTERDOWN:
                        if (pointerInfo.pickInfo.hit) {
                            let wp = this.waypoints.find(x => x.mesh == pointerInfo.pickInfo.pickedMesh)
                            if (wp) {
                                this.prevWaypoint = this.waypoints[this.index];
                                if ('leave' in this.prevWaypoint) {
                                    (<any>this.prevWaypoint).leave(
                                        (<Camera>(<any>this.parentElement).camera)
                                    );
                                }
                                // Fly to the target's current (world-space) position first, and
                                // only join its orbit once we've actually arrived -- entering the
                                // orbit reparents the camera, so doing it before the fly-to
                                // animation finishes would have the animation tween a value that's
                                // suddenly local-to-the-pivot instead of world-space, causing a
                                // jump and then a runaway drift.
                                this.moveToPosition(wp.getPosition(), () => {
                                    if ('enter' in wp) {
                                        (<any>wp).enter((<Camera>(<any>this.parentElement).camera));
                                    }
                                });
                                this.index = this.waypoints.indexOf(wp);
                            }
                        }
                        break;
                }
            });
        } finally {
            this.endBuild();
        }
    }

    moveToPosition(position: Vector3, onComplete?: () => void) {
        let scene = this.getScene();
        let camera = (<Camera>(<any>this.parentElement).camera);
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
        camera.animations = [];
        camera.animations.push(anime);
        scene.beginAnimation(camera, 0, 100, false, 1.0, onComplete);
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