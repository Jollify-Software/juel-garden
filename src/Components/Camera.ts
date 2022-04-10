import { ArcRotateCamera, Camera, FreeCamera, Vector3, VirtualJoystick, VirtualJoysticksCamera } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenScene } from "./Scene";

@customElement("garden-camera")
export class GardenCamera extends GardenElement {
    @property() type: string;
    @property({ type: Number }) speed: number;
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) ellipsoid: Vector3;
    @property() touch: string;

    camera: Camera;

    constructor() {
        super();
        this.type = 'arc';
        this.speed = 0.4;
        this.ellipsoid = new Vector3(1, 1, 1);
        this.touch = 'true';
    }

    getPosition() {
        return this.camera?.position;
    }

    setPosition(position: Vector3) {
        this.camera.position = position;
    }
    updated() {
        let sceneEl = this.parentElement as GardenScene
        let scene = sceneEl.scene
        console.log(this.type)
        switch (this.type) {
            case 'arc':
                this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene);
                break;
            case 'free':
                let cam: FreeCamera;
                const userAgent = navigator.userAgent.toLowerCase();
                const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
                if (this.touch == 'true' && isTablet && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
                    cam = new VirtualJoysticksCamera("camera", new Vector3(0, 5, -10), scene);
                } else {
                    cam = new FreeCamera("camera", new Vector3(0, 5, -10), scene);
                }
                if (this.ellipsoid)
                    cam.ellipsoid = this.ellipsoid;

                if (this.hasAttribute("collisions")) {
                    cam.checkCollisions = true;
                    cam.applyGravity = true;
                }
                if (this.speed)
                    cam.speed = this.speed;
    
                this.camera = cam;
                
                break;
            default:
                break;
        }

        if (this.position)
            this.camera.position = this.position;

        let opt = this.buildOptions();
        this.camera = Object.assign(this.camera, opt);

        this.camera.attachControl(sceneEl.canvas, true);

    }
}