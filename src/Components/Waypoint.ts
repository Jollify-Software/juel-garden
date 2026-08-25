import { Animation, Camera, PointerEventTypes, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Flies the parent camera between a set of target elements when the user
 * clicks one, animating position along the way -- the mechanism behind the
 * library's "educational VR tour" examples (see the README's Waypoints
 * example). Must be a child of `<garden-camera>`.
 *
 * Attributes: `waypoints` (a selector resolving the tour stops, see
 * {@link resolveElements}), `offset` (a `Vector3` added to every stop's
 * position, e.g. eye height), `speed`.
 *
 * @category Components
 */
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
        this.lookAtOrigin();
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

        (<any>this.parentElement).setPosition(pos);
        this.lookAtOrigin();
    }

    // A fresh FreeCamera keeps whatever rotation it was constructed with (facing
    // Babylon's default +Z) -- nothing ever points it at the scene, so simply
    // teleporting it to a waypoint can leave it staring at empty sky instead of
    // whatever that stop is meant to show. The waypoint markers/content in these
    // tours tend to sit near the world origin, so aiming there on every move is a
    // reasonable default look direction without needing a per-waypoint "look at".
    lookAtOrigin() {
        let camera = (<any>this.parentElement).camera;
        if (camera && 'setTarget' in camera)
            camera.setTarget(Vector3.Zero());
    }

    next() {
        this.index++;
        if (this.index >= this.waypoints.length) {
            this.index = 0;
        }
        this.setPosition(this.waypoints[this.index].getPosition());
    }
}