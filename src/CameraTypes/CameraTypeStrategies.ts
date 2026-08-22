import { Camera, Scene } from "babylonjs";
import type { GardenCamera } from "../Components/Camera";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";
import { ArcCameraStrategy } from "./ArcCameraStrategy";
import { FollowCameraStrategy } from "./FollowCameraStrategy";
import { FreeCameraStrategy } from "./FreeCameraStrategy";

/**
 * Maps `<garden-camera type="...">` to the {@link ICameraTypeStrategy} that
 * builds it: `"arc"` ({@link ArcCameraStrategy}), `"free"`
 * ({@link FreeCameraStrategy}), `"follow"` ({@link FollowCameraStrategy}).
 *
 * @category Camera Types
 */
export module CameraTypeStrategies {
    var map: { [type: string]: ICameraTypeStrategy } = {
        'arc': ArcCameraStrategy,
        'free': FreeCameraStrategy,
        'follow': FollowCameraStrategy
    }

    export var build = function(el: GardenCamera, scene: Scene): Camera {
        let strategy = map[el.type];
        return strategy ? strategy(el, scene) : null;
    }
}
