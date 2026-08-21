import { Camera, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { CameraTypeStrategies } from "../CameraTypes/CameraTypeStrategies";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
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
    async updated() {
        let sceneEl = this.parentElement as GardenScene
        let scene = sceneEl.scene

        this.camera = CameraTypeStrategies.build(this, scene);
        if (!this.camera) {
            console.warn(`<garden-camera> has unrecognized type "${this.type}".`);
            return;
        }

        if (this.position)
            this.camera.position = this.position;

        let opt = this.buildOptions();
        this.camera = Object.assign(this.camera, opt);

        this.camera.attachControl(sceneEl.canvas, true);

        let target = this.getAttribute("target");
        if (target && "lockedTarget" in this.camera) {
            this.beginBuild();
            try {
                // The target (e.g. a drivable car) can be declared after this camera in
                // the markup, so its element may not even exist yet -- wait for the whole
                // document before resolving by id, same as <garden-waypoint>.
                await GardenElement.whenDocumentReady();
                let [targetEl] = await GardenElement.resolveReady<GardenMesh>(target);
                if (targetEl?.mesh) {
                    (<any>this.camera).lockedTarget = targetEl.mesh;
                }
            } finally {
                this.endBuild();
            }
        }
    }
}