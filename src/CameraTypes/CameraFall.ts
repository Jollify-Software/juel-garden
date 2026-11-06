import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";

/** Metres below everything in the scene at which a camera has fallen off the world and goes back to where it started. */
const LostBelow = 15;

/** Babylon's collision threshold with a walking camera: below it, a step that slides along a stair or wall is dropped. Its own default is 0.001. */
const WalkingEpsilon = 0.0001;

/**
 * A walking camera that falls at a steady rate, whatever the frame rate (`<garden-camera collisions fall="5">`). Babylon's
 * `scene.gravity` is a drop per frame added to the walking step, so the faster the screen, the more it beats the step, and at a
 * walking pace on a 60 Hz screen the camera can't climb a stair. Here the camera's own moves leave that drop out and the fall is a
 * move of its own, so a step only has to climb. A faster screen also means shorter steps, and Babylon drops a slide of about a
 * centimetre or less, so its threshold is lowered while one of these is about.
 *
 * `applyGravity` still says whether it falls, so a jump in the air, or a page looking from above, turns it off as they always did.
 * A camera that walks off the edge of the world doesn't fall for ever: well below everything in the scene, it's back where it started.
 * See {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export class CameraFall {
    private observer: Observer<Scene>;
    private start: Vector3;
    private startRotation: Vector3;

    constructor(private camera: FreeCamera, private scene: Scene, private metresASecond: number) {
        this.start = camera.position.clone();
        this.startRotation = camera.rotation.clone();
        AbstractEngine.CollisionsEpsilon = Math.min(AbstractEngine.CollisionsEpsilon, WalkingEpsilon);
        let move = FreeCamera.prototype._collideWithWorld.bind(camera);
        camera._collideWithWorld = (displacement: Vector3) => {
            let gravity = scene.gravity;
            scene.gravity = Vector3.Zero();
            try { move(displacement); }
            finally { scene.gravity = gravity; }
        };
        this.observer = scene.onBeforeRenderObservable.add(() => this.step());
    }

    private step() {
        let camera = this.camera;
        if (!camera.applyGravity || !camera.checkCollisions || !this.scene.collisionsEnabled || this.scene.activeCamera != camera) return;
        let seconds = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.1);
        camera._collideWithWorld(new Vector3(0, -this.metresASecond * seconds, 0));
        if (camera.position.y < this.start.y - LostBelow && this.fellOffTheWorld()) {
            camera.position.copyFrom(this.start);
            camera.rotation.copyFrom(this.startRotation);
            camera.cameraDirection.setAll(0);
        }
    }

    /** Worked out only once it has already dropped a long way, so a deep basement still counts as somewhere to be. */
    private fellOffTheWorld(): boolean {
        let camera = this.camera;
        let lowest = this.scene.getWorldExtends(mesh => mesh.isEnabled() && mesh.isVisible && mesh.checkCollisions && mesh.getTotalVertices() > 0).min.y;
        return camera.position.y < lowest - LostBelow;
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        delete (<any>this.camera)._collideWithWorld;
    }
}
