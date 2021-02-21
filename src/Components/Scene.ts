import { Engine, Scene } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { GardenElement } from "../GardenElement";
import { JuelGarden } from "../JuelGarden";

@customElement("juel-scene")
export class JuelScene extends LitElement {

    canvas: HTMLCanvasElement;
    engine: Engine;
    scene: Scene;

    getScene() {
        return this.scene;
    }

    createRenderRoot() {
        return this;
    }

    firstUpdated() {
        this.canvas = document.createElement("canvas");
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.appendChild(this.canvas);
        let styles = document.createElement("style");
        styles.id = "juel-garden-styles";
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
            let cameraEl = this.querySelector("juel-camera") as GardenElement;
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
    }

}