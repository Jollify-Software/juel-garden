import { DeviceOrientationCamera } from "@babylonjs/core/Cameras/deviceOrientationCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

/**
 * `type="device"`: a `DeviceOrientationCamera`. On a phone or tablet the view turns
 * as the device does (a phone in a cardboard-style viewer, a classroom headset); on
 * a desktop it's a free camera (mouse-look, WASD). `position`, `target` (a point to
 * look at first), `speed` and `collisions` as `type="free"`. See
 * {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export const DeviceCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    let cam = new DeviceOrientationCamera("camera", new Vector3(0, 1.6, 0), scene);
    if (el.ellipsoid)
        cam.ellipsoid = el.ellipsoid;
    if (el.hasAttribute("collisions")) {
        cam.checkCollisions = true;
        cam.applyGravity = true;
    }
    if (el.speed)
        cam.speed = el.speed;
    cam.keysUp.push(87);    //W
    cam.keysDown.push(83);  //S
    cam.keysLeft.push(65);  //A
    cam.keysRight.push(68); //D
    return cam;
}
