import { AudioEngineV2 } from "@babylonjs/core/AudioV2/abstractAudio/audioEngineV2";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/webAudio/webAudioEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { IAction } from "@babylonjs/core/Actions/action";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ActionInfo } from "../ActionInfo";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { JuelGarden } from "../JuelGarden";
import { Navigation } from "../Navigation";
import { Utility } from "../Utility";
import { tween } from "../Utils/tween";
import { Color3Convert } from "../Converters/Color3Convert";

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
 * **Fog:** `fog-mode` (`exp`, `exp2`, `linear` or `none`; setting
 * `fog-density` alone picks `exp2`), `fog-density` (e.g. `0.02`; `0.1` is a
 * thick dust storm), `fog-colour` (default: the `<garden-sky>` colour, else
 * grey), `fog-start`/`fog-end` (for `linear`). All can change at any time;
 * {@link fogTo} eases them for a storm that closes in and clears, and a
 * `<garden-animation property="fogDensity">` inside the scene animates them.
 *
 * **Resolution** (phones and tablets): `scaling="2"` draws the scene at half the
 * canvas's size (Babylon's hardware scaling level) and lets the browser stretch it,
 * `"1.5"` at two thirds; below 1 it draws more finely than the canvas (sharper on a
 * high-density screen, and slower). Live, so a game can drop it when frames are slow.
 * `<garden-pipeline fsr>` upscales a smaller picture more sharply.
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
    @property({ attribute: "fog-mode" }) fogMode: string;
    @property({ type: Number, attribute: "fog-density" }) fogDensity: number;
    @property({ attribute: "fog-colour" }) fogColour: string;
    @property({ type: Number, attribute: "fog-start" }) fogStart: number;
    @property({ type: Number, attribute: "fog-end" }) fogEnd: number;
    /** How much smaller than the canvas the scene is drawn: Babylon's hardware scaling level. */
    @property({ type: Number }) scaling: number;

    canvas: HTMLCanvasElement;
    engine: Engine;
    scene: Scene;

    actions: {[id: string]: ActionInfo} = {};

    selectedElement: GardenMesh;

    private _renderLoopActive = false;
    private _audioEngine: Promise<AudioEngineV2>;
    /** True once the fog has a colour of its own (`fog-colour`, or fogTo() with a colour): the sky stops colouring it. */
    fogColourSet = false;

    getScene() {
        return this.scene;
    }

    getSceneEl() {
        return this;
    }

    createRenderRoot() {
        return this;
    }

    /**
     * The scene's audio engine (Babylon's `AudioEngineV2`), created the first
     * time a `<garden-sound>` asks for it, so a silent scene never opens an
     * `AudioContext`. Its listener rides on the active camera. Browsers only
     * allow audio after the user has interacted with the page: the first
     * pointer, touch or key press anywhere unlocks it, and a sound that
     * started before then is heard from that moment.
     */
    audioEngine(): Promise<AudioEngineV2> {
        if (!this._audioEngine) {
            this._audioEngine = (async () => {
                let audio = await CreateAudioEngineAsync({ disableDefaultUI: true, resumeOnInteraction: true });
                let attachListener = () => {
                    if (this.scene?.activeCamera)
                        audio.listener.attach(this.scene.activeCamera);
                };
                attachListener();
                this.scene?.onActiveCameraChanged.add(attachListener);
                let unlock = () => {
                    audio.unlockAsync().catch(() => {});
                    for (let type of ["pointerdown", "touchend", "keydown"])
                        window.removeEventListener(type, unlock, true);
                };
                for (let type of ["pointerdown", "touchend", "keydown"])
                    window.addEventListener(type, unlock, true);
                return audio;
            })();
        }
        return this._audioEngine;
    }

    /** What a child `<garden-animation>` animates: the Babylon scene (`fogDensity`, `clearColor`, ...). */
    get animationTarget() {
        return this.scene;
    }

    updated() {
        this.applyFog();
        if (this.engine && this.engine.getHardwareScalingLevel() != (this.scaling > 0 ? this.scaling : 1))
            this.engine.setHardwareScalingLevel(this.scaling > 0 ? this.scaling : 1);
    }

    private applyFog() {
        let scene = this.scene;
        if (!scene) return;
        let mode = (this.fogMode ?? (this.fogDensity != null || this.fogEnd != null ? (this.fogEnd != null ? "linear" : "exp2") : "none")).toLowerCase();
        scene.fogMode = mode == "exp" ? Scene.FOGMODE_EXP : mode == "exp2" ? Scene.FOGMODE_EXP2
            : mode == "linear" ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_NONE;
        if (this.fogDensity != null) scene.fogDensity = this.fogDensity;
        if (this.fogStart != null) scene.fogStart = this.fogStart;
        if (this.fogEnd != null) scene.fogEnd = this.fogEnd;
        if (this.fogColour)
            this.fogColourSet = true;
        if (this.fogColour)
            scene.fogColor = this.fogColour.startsWith("#") ? Color3.FromHexString(this.fogColour) : Color3Convert.fromString(this.fogColour);
    }

    /**
     * Eases the fog to new values over `seconds` -- a dust storm closing in
     * (`fogTo({ density: 0.08, colour: "#b89a6a" }, 20)`) and clearing
     * (`fogTo({ density: 0 }, 30)`). Resolves when done.
     */
    fogTo(to: { density?: number, colour?: string, start?: number, end?: number }, seconds: number): Promise<void> {
        let scene = this.scene;
        if (scene.fogMode == Scene.FOGMODE_NONE) {
            scene.fogMode = to.end != null ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_EXP2;
            if (to.end == null) scene.fogDensity = 0;
        }
        let from = { density: scene.fogDensity, colour: scene.fogColor.clone(), start: scene.fogStart, end: scene.fogEnd };
        let colour = to.colour ? (to.colour.startsWith("#") ? Color3.FromHexString(to.colour) : Color3Convert.fromString(to.colour)) : null;
        if (colour)
            this.fogColourSet = true;
        let lerp = (a: number, b: number, k: number) => b == null ? a : a + (b - a) * k;
        return tween(scene, seconds, k => {
            scene.fogDensity = lerp(from.density, to.density, k);
            scene.fogStart = lerp(from.start, to.start, k);
            scene.fogEnd = lerp(from.end, to.end, k);
            if (colour) scene.fogColor = Color3.Lerp(from.colour, colour, k);
        }).then(() => {
            // Keep the attributes' properties in step, without re-applying mid-way.
            if (to.density != null) this.fogDensity = to.density;
            if (to.colour) this.fogColour = to.colour;
        });
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
                    // `#id` deep links and back/forward between <garden-link> jumps.
                    Navigation.install(this.scene);
                    // <garden-animation event="load"> directly inside the scene (fog, sky colour).
                    for (let child of Array.from(this.children))
                        if (child.matches("garden-animation") && (<any>child).event == "load")
                            (<any>child).playWhenReady(this);
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
            // An imported model's meshes hang under the element's own holder
            // mesh, so walk up to the nearest node that belongs to an element.
            let node: any = pickResult?.hit ? pickResult.pickedMesh : null;
            while (node && !("element" in node))
                node = node.parent;
            if (node) {
                const el = node.element;
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
        if (this._audioEngine) {
            this._audioEngine.then(audio => audio.dispose()).catch(() => {});
            this._audioEngine = null;
        }
    }

}