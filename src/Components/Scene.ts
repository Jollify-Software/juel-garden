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
 * (enables `scene.collisionsEnabled`), `embedded` (see below).
 *
 * **Full-window or embedded:** by default the scene takes over the window: the page's
 * `html` and `body` lose their margins and scrolling, and the canvas fills the body.
 * With `embedded` the scene is a block inside an ordinary page, sized by the page's CSS,
 * and the page scrolls as usual. Either way only the scene's own canvas is styled.
 *
 * **Fog:** `fog-mode` (`exp`, `exp2`, `linear` or `none`; setting
 * `fog-density` alone picks `exp2`), `fog-density` (e.g. `0.02`; `0.1` is a
 * thick dust storm), `fog-colour` (default: the `<garden-sky>` colour, else
 * grey), `fog-start`/`fog-end` (for `linear`). All can change at any time;
 * {@link fogTo} eases them for a storm that closes in and clears, and a
 * `<garden-animation property="fogDensity">` inside the scene animates them.
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
 * @example
 * ```html
 * <article>
 *   <p>Text above the scene...</p>
 *   <garden-scene embedded style="width: 100%; aspect-ratio: 16 / 9">
 *     <garden-camera type="arc" radius="4"></garden-camera>
 *     <garden-light></garden-light>
 *     <garden-box position="0 0.5 0"></garden-box>
 *   </garden-scene>
 *   <p>...and text below it; the page scrolls.</p>
 * </article>
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
    /**
     * The scene lives inside the page instead of taking over the window: the page keeps
     * scrolling and its own margins, and the scene fills its own box, which the page sizes
     * (`width`, `height`, `aspect-ratio`). The canvas follows the box's size as it changes.
     */
    @property({ type: Boolean }) embedded = false;

    canvas: HTMLCanvasElement;
    engine: Engine;
    scene: Scene;

    actions: {[id: string]: ActionInfo} = {};

    selectedElement: GardenMesh;

    private _renderLoopActive = false;
    /** True once the scene was removed for good and its engine disposed: added back, it builds again. */
    private _disposedForGood = false;
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

    updated(changed: Map<PropertyKey, unknown>) {
        this.applyFog();
        if (changed.has("embedded") && this.scene)
            this.applyEmbedded();
    }

    /** Scenes in the document that take over the whole window (no `embedded`). */
    private static fullWindowScenes = new Set<GardenScene>();

    /**
     * Every scene's canvas fills the scene, and only the scene's own canvas: other
     * canvases on the page keep their size. An embedded scene is a block the page sizes.
     */
    private static injectCanvasStyles() {
        if (document.getElementById("garden-garden-styles"))
            return;
        let styles = document.createElement("style");
        styles.id = "garden-garden-styles";
        styles.textContent = `garden-scene > canvas {
                width: 100%;
                height: 100%;
                touch-action: none;
            }
            :where(garden-scene[embedded]) {
                display: block;
                position: relative;
            }
            :where(garden-scene[embedded] > canvas) {
                display: block;
            }`;
        document.head.appendChild(styles);
    }

    /**
     * The full-window page styles (`html, body` with no scrolling, no margin), in the
     * document while at least one scene without `embedded` is in it.
     */
    private static updatePageStyles() {
        let styles = document.getElementById("garden-garden-page-styles");
        if (GardenScene.fullWindowScenes.size && !styles) {
            styles = document.createElement("style");
            styles.id = "garden-garden-page-styles";
            styles.textContent = `html, body {
                overflow: hidden;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
            }`;
            document.head.appendChild(styles);
        } else if (!GardenScene.fullWindowScenes.size && styles) {
            styles.remove();
        }
    }

    private _resizeObserver: ResizeObserver;

    /** Full-window or embedded, as the `embedded` attribute says now. */
    private applyEmbedded() {
        if (this.embedded) {
            GardenScene.fullWindowScenes.delete(this);
            if (!this._resizeObserver) {
                this._resizeObserver = new ResizeObserver(() => this.engine?.resize());
                this._resizeObserver.observe(this);
            }
        } else {
            if (this.isConnected)
                GardenScene.fullWindowScenes.add(this);
            this._resizeObserver?.disconnect();
            this._resizeObserver = null;
        }
        GardenScene.updatePageStyles();
        this.engine?.resize();
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

        GardenScene.injectCanvasStyles();
        this.applyEmbedded();

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

    connectedCallback() {
        super.connectedCallback();
        if (this._disposedForGood) {
            // Added back after it was removed for good: a new canvas, engine and scene, as an
            // element builds again; the children, added back with it, build into the new scene.
            this._disposedForGood = false;
            this.canvas?.remove();
            this.firstUpdated();
            this.applyFog();
        } else if (this.hasUpdated && !this.embedded) {
            GardenScene.fullWindowScenes.add(this);
            GardenScene.updatePageStyles();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        // The page styles go with the last full-window scene; a microtask, so a move keeps them.
        GardenScene.fullWindowScenes.delete(this);
        queueMicrotask(() => GardenScene.updatePageStyles());
        // A move (removed and added back in one task, as `appendChild` does) keeps the engine,
        // as a moved element keeps its build; removed for good, the scene is disposed.
        queueMicrotask(() => {
            if (!this.isConnected)
                this.disposeEngine();
        });
    }

    /** Stops drawing and disposes the engine and audio, once the scene has been removed for good. */
    private disposeEngine() {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        window.removeEventListener("resize", this._resizeHandler);
        if (this.engine && !this.engine.isDisposed) {
            this.engine.stopRenderLoop();
            this.engine.dispose();
            this._renderLoopActive = false;
            this._disposedForGood = true;
        }
        if (this._audioEngine) {
            this._audioEngine.then(audio => audio.dispose()).catch(() => {});
            this._audioEngine = null;
        }
    }

}