import { FreeCamera, Vector3, VirtualJoysticksCamera } from "babylonjs";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

/**
 * `type="free"`: WASD/arrow-key + mouse-look free-fly camera, or a
 * touch-joystick camera on a tablet when `touch="true"` (the default). See
 * {@link GardenCamera}.
 *
 * @category Camera Types
 */
export const FreeCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    let cam: FreeCamera;
    const userAgent = navigator.userAgent.toLowerCase();
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
    if (el.touch == 'true' && isTablet && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        cam = new VirtualJoysticksCamera("camera", new Vector3(0, 5, -10), scene);
    } else {
        cam = new FreeCamera("camera", new Vector3(0, 5, -10), scene);
    }
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
