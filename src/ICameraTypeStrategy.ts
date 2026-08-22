import { Camera, Scene } from "babylonjs";
import type { GardenCamera } from "./Components/Camera";

/**
 * The shape every entry in {@link CameraTypeStrategies}'s `type` map
 * implements: given the `<garden-camera>` element and the Babylon `Scene`,
 * construct and return the actual Babylon `Camera`. Implemented by
 * {@link ArcCameraStrategy}, {@link FreeCameraStrategy} and
 * {@link FollowCameraStrategy}.
 *
 * @category Core
 */
export interface ICameraTypeStrategy {
    (el: GardenCamera, scene: Scene): Camera;
}
