import { Engine, IAction, Mesh, Scene, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { ActionInfo } from "../ActionInfo";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { JuelGarden } from "../JuelGarden";
import { Utility } from "../Utility";

@customElement("garden-scene")
export class GardenScene extends LitElement {
    @property({ converter: Vector3Convert.fromString }) gravity: Vector3;

    canvas: HTMLCanvasElement;
    engine: Engine;
    scene: Scene;

    actions: {[id: string]: ActionInfo} = {};

    selectedElement: GardenMesh;

    getScene() {
        return this.scene;
    }

    getSceneEl() {
        return this;
    }

    createRenderRoot() {
        return this;
    }

    firstUpdated() {
        this.canvas = document.createElement("canvas");
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);

        if (this.gravity)
            this.scene.gravity = this.gravity;

        if (this.hasAttribute("collisions"))
            this.scene.collisionsEnabled = true;

        this.appendChild(this.canvas);
        let styles = document.createElement("style");
        styles.id = "garden-garden-styles";
        styles.textContent = `html, body {
            overflow: hidden;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }
        canvas {
            width: 100%;
            height: 100%;
            touch-action: none;
        }`;
        document.head.appendChild(styles);

        setTimeout(() => {
            Utility.applyRules(this);
            
            let cameraEl = this.querySelector("garden-camera") as GardenElement;
            cameraEl.updateComplete.then(() => {
                this.engine.runRenderLoop(() => {
                    this.scene.render();
                });
                // Watch for browser/canvas resize events
                window.addEventListener("resize", () => {
                    this.engine.resize();
                });
                this.engine.resize();    
            });
        });

        this.scene.onPointerDown = (evt, pickResult) => {
            // We try to pick an object
            if (pickResult.hit && 'element' in pickResult.pickedMesh) {
                let el = (<any>pickResult.pickedMesh).element as GardenMesh;
                this.selectedElement = el;
                el.activate();
            }
        };
    }

}