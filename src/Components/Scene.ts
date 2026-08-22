import { Engine, IAction, Mesh, Scene, Tools, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { ActionInfo } from "../ActionInfo";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { JuelGarden } from "../JuelGarden";
import { Utility } from "../Utility";

// Babylon requests images (textures, etc.) with crossOrigin="anonymous" by default,
// which Chromium refuses outright for file:// URLs -- "file" isn't a scheme it allows
// CORS-mode requests for, even loading a local file from the same folder. Examples are
// commonly opened straight from disk (no dev server), so only ask for CORS mode when
// the URL is actually remote; local/relative paths load fine without it.
Tools.CorsBehavior = (url: string) => (/^https?:\/\//i.test(String(url)) ? "anonymous" : null);

/**
 * The root element of a Juel Garden scene -- creates the Babylon `Engine`,
 * `Scene` and render `<canvas>`, and starts the render loop once its
 * `<garden-camera>` child has finished building. Everything else (shapes,
 * lights, the camera, prefabs) is declared as a descendant of this element.
 *
 * Attributes: `gravity` (a `Vector3`, e.g. `"0 -0.2 0"`), `collisions`
 * (enables `scene.collisionsEnabled`).
 *
 * @example
 * ```html
 * <garden-scene>
 *   <garden-camera></garden-camera>
 *   <garden-light></garden-light>
 *   <garden-box position="0 0.5 0" colour="#4CC3D9"></garden-box>
 *   <garden-ground width="4" height="4" colour="#7BC8A4"></garden-ground>
 * </garden-scene>
 * ```
 *
 * @category Components
 */
@customElement("garden-scene")
export class GardenScene extends LitElement {
    @property({ converter: Vector3Convert.fromString }) gravity: Vector3;

    canvas: HTMLCanvasElement;
    engine: Engine;
    scene: Scene;

    actions: {[id: string]: ActionInfo} = {};

    selectedElement: GardenMesh;

    private _renderLoopActive = false;

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

        // Only inject styles if not already present
        if (!document.getElementById("garden-garden-styles")) {
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
        }

        const setupScene = () => {
            try {
                Utility.applyRules(this);

                const cameraEl = this.querySelector("garden-camera");
                if (!cameraEl) {
                    console.warn("No <garden-camera> element found in <garden-scene>.");
                    return;
                }
                // Type safety: check if cameraEl is a GardenElement and has updateComplete
                if (
                    !(cameraEl instanceof HTMLElement) ||
                    typeof (cameraEl as any).updateComplete?.then !== "function"
                ) {
                    console.warn("<garden-camera> does not appear to be a valid GardenElement with updateComplete.");
                    return;
                }

                (cameraEl as GardenElement).updateComplete.then(() => {
                    // Use our own flag for render loop
                    if (!this._renderLoopActive) {
                        this.engine.runRenderLoop(() => {
                            this.scene.render();
                        });
                        this._renderLoopActive = true;
                    }
                    window.addEventListener("resize", this._resizeHandler);
                    this.engine.resize();
                });
            } catch (err) {
                console.error("Error during scene setup:", err);
            }
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", setupScene, { once: true });
        } else {
            setupScene();
        }

        this.scene.onPointerDown = (evt, pickResult) => {
            // We try to pick an object
            if (
                pickResult?.hit &&
                pickResult.pickedMesh &&
                "element" in pickResult.pickedMesh
            ) {
                const el = (pickResult.pickedMesh as any).element;
                // Type safety: check if el is a GardenMesh and has activate
                if (el && typeof el.activate === "function") {
                    this.selectedElement = el as GardenMesh;
                    el.activate();
                } else {
                    console.warn("Picked mesh does not have a valid GardenMesh element.");
                }
            }
        };
    }

    private _resizeHandler = () => {
        this.engine?.resize();
    };

    disconnectedCallback() {
        super.disconnectedCallback?.();
        window.removeEventListener("resize", this._resizeHandler);
        if (this.engine) {
            this.engine.stopRenderLoop();
            this.engine.dispose();
            this._renderLoopActive = false;
        }
    }

}