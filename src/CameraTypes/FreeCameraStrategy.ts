import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VirtualJoysticksCamera } from "@babylonjs/core/Cameras/virtualJoysticksCamera";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

/**
 * `type="free"`: WASD/arrow-key + mouse-look free-fly camera. On a touch screen
 * `touch="true"` (the default) adds tap-the-floor and a fading thumbstick to walk
 * ({@link "CameraTypes/CameraTouchMove"!CameraTouchMove}, built by the camera element);
 * `touch="joysticks"` is Babylon's two on-screen joysticks instead (tablets only).
 * `keys="arrows"`: the arrow keys only; `keys="none"`: no keys. See
 * {@link "Components/Camera"!GardenCamera}.
 *
 * @category Camera Types
 */
export const FreeCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    let cam: FreeCamera;
    const userAgent = navigator.userAgent.toLowerCase();
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
    if (el.touch == 'joysticks' && isTablet && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
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

    // `keys="arrows"` leaves W/A/S/D to the page (a `<garden-action trigger="keydown">`);
    // `keys="none"` moves it by mouse and touch only.
    let keys = el.getAttribute("keys");
    if (keys == "none")
        cam.keysUp = cam.keysDown = cam.keysLeft = cam.keysRight = [];
    else if (keys != "arrows") {
        cam.keysUp.push(87);    //W
        cam.keysDown.push(83);  //S
        cam.keysLeft.push(65);  //A
        cam.keysRight.push(68); //D
    }

    return cam;
}
