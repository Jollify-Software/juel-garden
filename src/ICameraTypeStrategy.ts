import { Camera } from "@babylonjs/core/Cameras/camera";
import { Scene } from "@babylonjs/core/scene";
import type { GardenCamera } from "./Components/Camera";

/**
 * The shape every entry in {@link "CameraTypes/CameraTypeStrategies"!CameraTypeStrategies}'s `type` map
 * implements: given the `<garden-camera>` element and the Babylon `Scene`,
 * construct and return the actual Babylon `Camera`. Implemented by
 * {@link "CameraTypes/ArcCameraStrategy"!ArcCameraStrategy}, {@link "CameraTypes/FreeCameraStrategy"!FreeCameraStrategy},
 * {@link "CameraTypes/FollowCameraStrategy"!FollowCameraStrategy} and
 * {@link "CameraTypes/DeviceCameraStrategy"!DeviceCameraStrategy}.
 *
 * @category Core
 */
export interface ICameraTypeStrategy {
    (el: GardenCamera, scene: Scene): Camera;
}
