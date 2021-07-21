import { ArcRotateCamera, Camera, FreeCamera, Vector3 } from "babylonjs";
import { customElement, LitElement, property } from "lit-element";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenScene } from "./Scene";

@customElement("garden-camera")
export class GardenCamera extends GardenElement {
    @property() type: string = 'arc';
    @property({ type: Number }) speed: number = 0.4;
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) ellipsoid: Vector3 = new Vector3(1, 1, 1);

    camera: Camera;

    getPosition() {
        return this.camera?.position;
    }

    setPosition(position: Vector3) {
        this.camera.position = position;
    }
    updated() {
        let sceneEl = this.parentElement as GardenScene
        let scene = sceneEl.scene

        switch (this.type) {
            case 'arc':
                this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene);        
                break;
            case 'free':
                let cam = new FreeCamera("camera", new Vector3(0, 5, -10), scene);
                if (this.ellipsoid)
                    cam.ellipsoid = this.ellipsoid;
                    
        if (this.hasAttribute("collisions")) {
            cam.checkCollisions = true;
            cam.applyGravity = true;
        }
        if (this.speed)
            cam.speed = this.speed;
            
            this.camera = cam;
            default:
                break;
        }

        if (this.position)
            this.camera.position = this.position;
        

this.camera.attachControl(sceneEl.canvas, true);

    }
}