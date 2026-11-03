import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Nullable } from "@babylonjs/core/types";
import { Scene } from "@babylonjs/core/scene";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { PlayOptions } from "../AnimationMixer";
import { Color3Convert } from "../Converters/Color3Convert";
import { GardenElement } from "../GardenElement";
import { GardenCamera } from "./Camera";
import { GardenMeshModel } from "./MeshModel";
import { GardenScene } from "./Scene";

/**
 * One tag that shows a model inside an ordinary page: it builds its own embedded
 * `<garden-scene>`, an orbit camera, lights and a `<garden-mesh-model>` inside itself.
 * The page sizes it with CSS (`width`, `height`, `aspect-ratio`; 300 px wide and 2:1 by
 * default), and the page around it keeps scrolling.
 *
 * - **Framing:** once the model loads, the camera orbits the centre of the model's
 *   bounding box at a distance that fits the whole model in view, for the viewer's shape;
 *   the clip planes and zoom limits follow the model's size, so a 5 cm model and a 50 m
 *   one both fill the view, seen from the front (glTF models face +z). `alpha`, `beta`
 *   (radians, as `<garden-camera>`) and `radius` (metres) override the start view;
 *   a change after the model has loaded applies at once.
 * - **Background:** `background="transparent"` (the default: the page shows through) or a
 *   colour (`#rrggbb` or a name).
 * - **Light:** a soft hemispheric light and a directional one, which suit most glTF
 *   models without an environment map. `materials="standard"` passes through to the model.
 * - **Input:** drag to turn, pinch to zoom. The mouse wheel scrolls the page unless Ctrl
 *   (or ⌘) is held, so a page never gets stuck on the viewer (`wheel="ctrl"`, the
 *   default); `wheel="zoom"` zooms with the wheel alone. `auto-rotate="20"` turns the model
 *   at 20 degrees a second until someone touches it, and not while the page prefers
 *   reduced motion (`prefers-reduced-motion: reduce`).
 * - **Keyboard:** the viewer takes focus (Tab), with a focus ring; arrow keys turn the model
 *   and `+`/`-` zoom. Screen readers hear `label` (default: the model's file name).
 * - **Animations:** {@link animationNames}, {@link play}, {@link playOnce} (a one-shot that
 *   holds its last frame, with a Promise) and {@link stopAnimation}. No animation plays on
 *   its own (the model loads with `animation="none"`) and no buttons are drawn: the page
 *   makes its own.
 * - **Loading:** `poster` (an image URL) shows until the model's first frame; there's no
 *   loading screen. {@link loaded} is a Promise for the model (`true` loaded, `false`
 *   not), there from the start. The model's `garden-model-load`, `garden-model-error` and
 *   `garden-model-progress` events bubble out of the viewer.
 * - **No WebGL:** if the browser can't start WebGL, the viewer builds no scene: it shows
 *   `poster` and the page's own content marked `slot="fallback"` (hidden otherwise), the
 *   poster above the content when there are both, or else a short message; it gets the
 *   `no-webgl` attribute (a CSS hook), {@link loaded} resolves `false`, and it fires
 *   `garden-model-error` from itself once the document has loaded.
 *
 * Script API: {@link model} (the `<garden-mesh-model>`), {@link scene}, {@link camera},
 * {@link frame}.
 *
 * @example
 * ```html
 * <garden-model-viewer id="box" src="box.glb" style="width: 100%; aspect-ratio: 4 / 3"></garden-model-viewer>
 * <button onclick="document.getElementById('box').playOnce('Open')">Open</button>
 * <garden-model-viewer src="box.glb">
 *     <p slot="fallback">A box with a lid (this browser can't show it in 3D).</p>
 * </garden-model-viewer>
 * ```
 *
 * @category Components
 */
@customElement("garden-model-viewer")
export class GardenModelViewer extends LitElement {
    /** The model's URL (glTF/GLB, or anything `<garden-mesh-model>` loads). */
    @property() src: string;
    /** `transparent` (the default) or a colour. */
    @property() background: string;
    /** `standard`: the model's PBR materials become StandardMaterials (see `<garden-mesh-model>`). */
    @property() materials: string;
    /** `ctrl` (the default): the wheel zooms only with Ctrl or ⌘ held, else the page scrolls. `zoom`: the wheel always zooms. */
    @property() wheel: string;
    /** Degrees a second to turn the model on its own, until someone touches it (off by default). It doesn't turn while the page prefers reduced motion. */
    @property({ type: Number, attribute: "auto-rotate" }) autoRotate: number;
    /** An image shown until the model's first frame. */
    @property() poster: string;
    /** What the model is, for screen readers (the viewer's `aria-label`; default: the file name from `src`). */
    @property() label: string;
    /** The camera's start angle round the model, in radians (as `<garden-camera>`; default π/2, the model's front). */
    @property({ type: Number }) alpha: number;
    /** The camera's start angle down from the top, in radians (as `<garden-camera>`). */
    @property({ type: Number }) beta: number;
    /** The camera's start distance from the model's centre, in metres (default: fits the model). */
    @property({ type: Number }) radius: number;

    private sceneEl: GardenScene;
    private cameraEl: GardenCamera;
    private modelEl: GardenMeshModel;
    private posterEl: HTMLImageElement;
    private touched = false;
    private framed = false;
    private rotateObserver: Nullable<Observer<Scene>>;
    private resizeObserver: ResizeObserver;
    private resolveLoaded: (loaded: boolean) => void;
    private loadedSettled = false;
    /** `role="img"` was set by the viewer (not the page), so it may take it off again. */
    private ownRole = false;
    private static webgl: boolean;

    /**
     * Resolves once the model has loaded (`true`), or failed or can't be shown without WebGL
     * (`false`). It exists from the start, so a script that runs after the model has loaded
     * still hears about it, which a `garden-model-load` listener added then wouldn't. A new
     * `src` after that makes a new Promise.
     *
     * @example
     * ```js
     * if (await viewer.loaded) console.log(viewer.animationNames);
     * ```
     */
    loaded: Promise<boolean>;

    constructor() {
        super();
        this.newLoaded();
    }

    private newLoaded() {
        this.loadedSettled = false;
        this.loaded = new Promise(resolve => this.resolveLoaded = resolve);
    }

    private settleLoaded(loaded: boolean) {
        this.loadedSettled = true;
        this.resolveLoaded(loaded);
    }

    /**
     * Whether this browser can start WebGL (or WebGL 2): a throwaway canvas is asked once a
     * page, and its context is let go at once.
     */
    static get webglAvailable(): boolean {
        if (GardenModelViewer.webgl == null) {
            try {
                let canvas = document.createElement("canvas");
                let gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
                GardenModelViewer.webgl = !!gl;
                gl?.getExtension("WEBGL_lose_context")?.loseContext();
            } catch {
                GardenModelViewer.webgl = false;
            }
        }
        return GardenModelViewer.webgl;
    }

    createRenderRoot() {
        return this;
    }

    /** The `<garden-mesh-model>` inside. */
    get model(): GardenMeshModel {
        return this.modelEl;
    }

    /** The Babylon scene. */
    get scene(): Scene {
        return this.sceneEl?.scene;
    }

    /** The orbit camera. */
    get camera(): ArcRotateCamera {
        return this.cameraEl?.camera as ArcRotateCamera;
    }

    /** The model's animation names (empty until it has loaded). */
    get animationNames(): string[] {
        return this.modelEl?.animationNames ?? [];
    }

    /** Plays one of the model's named animations (see `<garden-mesh-model>`'s `play`). */
    play(name: string, options?: PlayOptions): boolean {
        return this.modelEl?.play(name, options) ?? false;
    }

    /**
     * Plays a named animation once and holds its last frame. Resolves `true` when it ends,
     * `false` if there's no such animation or another play or stop takes over.
     *
     * @example
     * ```js
     * await viewer.playOnce("Open");
     * ```
     */
    playOnce(name: string, options?: Omit<PlayOptions, "loop">): Promise<boolean> {
        return this.modelEl?.playOnce(name, options) ?? Promise.resolve(false);
    }

    /** Stops the playing animation. */
    stopAnimation(blend?: number) {
        this.modelEl?.stopAnimation(blend);
    }

    private static injectStyles() {
        if (document.getElementById("garden-model-viewer-styles"))
            return;
        let styles = document.createElement("style");
        styles.id = "garden-model-viewer-styles";
        styles.textContent = `:where(garden-model-viewer) {
                display: block;
                position: relative;
                width: 300px;
                aspect-ratio: 2 / 1;
            }
            garden-model-viewer > garden-scene {
                width: 100%;
                height: 100%;
            }
            garden-model-viewer > .garden-model-viewer-poster {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: contain;
                pointer-events: none;
            }
            garden-model-viewer:not([no-webgl]) > [slot="fallback"] {
                display: none;
            }
            /* No WebGL, with a poster and the page's fallback content: the poster above, the
               content below it, both in view (the poster gives up height to the content). */
            garden-model-viewer[no-webgl] {
                display: flex;
                flex-direction: column;
            }
            garden-model-viewer[no-webgl] > .garden-model-viewer-poster {
                position: static;
                order: -1;
                flex: 1 1 0;
                min-height: 0;
                height: auto;
            }
            garden-model-viewer[no-webgl] > [slot="fallback"] {
                flex: none;
            }
            garden-model-viewer > .garden-model-viewer-message {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 1em;
                box-sizing: border-box;
                text-align: center;
            }
            :where(garden-model-viewer:focus-visible) {
                outline: 2px solid Highlight;
                outline: 2px solid -webkit-focus-ring-color;
                outline-offset: 2px;
            }`;
        document.head.appendChild(styles);
    }

    firstUpdated() {
        GardenModelViewer.injectStyles();
        if (this.poster) {
            this.posterEl = document.createElement("img");
            this.posterEl.className = "garden-model-viewer-poster";
            this.posterEl.alt = "";
            this.posterEl.src = this.poster;
        }
        if (!GardenModelViewer.webglAvailable) {
            this.showNoWebgl();
            return;
        }

        let sceneEl = document.createElement("garden-scene") as GardenScene;
        sceneEl.setAttribute("embedded", "");
        let cameraEl = document.createElement("garden-camera") as GardenCamera;
        cameraEl.setAttribute("type", "arc");
        let hemi = document.createElement("garden-light");
        hemi.setAttribute("type", "hemi");
        hemi.setAttribute("intensity", "0.8");
        let sun = document.createElement("garden-light");
        sun.setAttribute("type", "directional");
        // From above and in front (the camera starts at +z), a little to one side.
        sun.setAttribute("direction", "-1 -2 -2");
        sun.setAttribute("intensity", "0.6");
        let modelEl = document.createElement("garden-mesh-model") as GardenMeshModel;
        modelEl.setAttribute("animation", "none");
        modelEl.setAttribute("loading-screen", "false");
        if (this.materials) modelEl.setAttribute("materials", this.materials);
        if (this.src) modelEl.setAttribute("src", this.src);
        sceneEl.append(cameraEl, hemi, sun, modelEl);

        this.sceneEl = sceneEl;
        this.cameraEl = cameraEl;
        this.modelEl = modelEl;

        modelEl.addEventListener("garden-model-load", e => {
            if (e.target == modelEl) {
                this.settleLoaded(true);
                this.onModelLoad();
            }
        });
        modelEl.addEventListener("garden-model-error", e => {
            if (e.target == modelEl) {
                this.settleLoaded(false);
                this.removePoster();
            }
        });
        // The wheel scrolls the page unless Ctrl/⌘ is held: stopped here, on the way down,
        // the camera never sees it and the browser scrolls as usual. A wheel that zooms
        // mustn't scroll the page (or zoom it, with Ctrl) as well: the camera is attached
        // without preventing defaults, so that's done here.
        this.addEventListener("wheel", e => {
            if ((this.wheel ?? "ctrl") != "zoom" && !e.ctrlKey && !e.metaKey) {
                e.stopPropagation();
            } else {
                e.preventDefault();
                // A zoom is a touch: a later resize mustn't frame over it.
                this.touched = true;
            }
        }, { capture: true, passive: false });
        this.addEventListener("pointerdown", () => this.touched = true, { capture: true });
        if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
        if (!this.hasAttribute("role")) this.setAttribute("role", "img");
        this.addEventListener("keydown", e => this.onKey(e));

        this.append(sceneEl);
        if (this.posterEl)
            this.append(this.posterEl);

        // Once the scene exists: its background, and the camera's zoom steps.
        sceneEl.updateComplete.then(() => this.setUpScene());

        this.resizeObserver = new ResizeObserver(() => {
            if (this.framed && !this.touched && this.radius == null)
                this.frame();
        });
        this.resizeObserver.observe(this);
    }

    updated(changed: Map<PropertyKey, unknown>) {
        if (changed.has("label") || changed.has("src")) {
            let label = this.label || (this.src ?? "").split(/[?#]/)[0].split("/").pop();
            if (label) this.setAttribute("aria-label", label);
        }
        if (!this.modelEl)
            return;
        if (changed.has("src") && this.src && this.modelEl.getAttribute("src") != this.src) {
            this.framed = false;
            // A model already loaded (or failed): the new one gets its own Promise. One still
            // loading is replaced, and its Promise settles for the new one.
            if (this.loadedSettled)
                this.newLoaded();
            this.modelEl.setAttribute("src", this.src);
        }
        if (changed.has("materials") && this.materials)
            this.modelEl.setAttribute("materials", this.materials);
        if (changed.has("background"))
            this.applyBackground();
        if (changed.has("autoRotate"))
            this.applyAutoRotate();
        // A later alpha, beta or radius applies to the camera, as on <garden-camera>; before
        // the model has loaded, framing reads them.
        let camera = this.camera;
        if (this.framed && camera) {
            if (changed.has("radius"))
                this.frame();
            if (changed.has("alpha") && this.alpha != null) camera.alpha = this.alpha;
            if (changed.has("beta") && this.beta != null) camera.beta = this.beta;
        }
    }

    /**
     * WebGL can't start: no scene, but the poster, the page's `slot="fallback"` content or a
     * message, and a `garden-model-error` once the page's own scripts have had a chance to
     * listen.
     */
    private showNoWebgl() {
        this.setAttribute("no-webgl", "");
        if (!this.hasAttribute("role")) {
            this.setAttribute("role", "img");
            this.ownRole = true;
        }
        if (this.posterEl)
            this.append(this.posterEl);
        // The page's own children may not be parsed yet when the viewer first updates.
        GardenElement.whenDocumentReady().then(() => {
            let fallback = this.querySelector(':scope > [slot="fallback"]');
            if (!this.posterEl && !fallback) {
                let message = document.createElement("div");
                message.className = "garden-model-viewer-message";
                message.textContent = "This 3D view needs WebGL, which this browser can't start.";
                this.append(message);
            }
            // The page's own words (a description, a download link) are read as they are:
            // role="img" would hide them from screen readers.
            if (fallback && this.ownRole) {
                this.removeAttribute("role");
                this.ownRole = false;
            }
            this.settleLoaded(false);
            this.dispatchEvent(new CustomEvent("garden-model-error",
                { bubbles: true, detail: { error: new Error("WebGL is not available in this browser") } }));
        });
    }

    /**
     * Arrow keys turn the model (10° a press), `+`/`-` zoom (within the zoom limits). A key
     * counts as a touch, as a drag does.
     */
    private onKey(e: KeyboardEvent) {
        let camera = this.camera;
        // Only keys aimed at the viewer itself: a focused canvas has the camera's own keys.
        if (!camera || e.target != this || e.ctrlKey || e.metaKey || e.altKey) return;
        let step = Math.PI / 18;
        switch (e.key) {
            case "ArrowLeft": camera.alpha += step; break;
            case "ArrowRight": camera.alpha -= step; break;
            case "ArrowUp": camera.beta = Math.max(camera.beta - step, camera.lowerBetaLimit ?? 0.01); break;
            case "ArrowDown": camera.beta = Math.min(camera.beta + step, camera.upperBetaLimit ?? Math.PI - 0.01); break;
            case "+": case "=": camera.radius = Math.max(camera.radius / 1.1, camera.lowerRadiusLimit ?? 0); break;
            case "-": case "_": camera.radius = Math.min(camera.radius * 1.1, camera.upperRadiusLimit ?? Infinity); break;
            default: return;
        }
        e.preventDefault();
        this.touched = true;
    }

    /** The scene's background, the canvas out of the tab order, the camera's zoom steps and start view, and `auto-rotate`. */
    private async setUpScene() {
        let sceneEl = this.sceneEl;
        if (!sceneEl) return;
        this.applyBackground();
        // Babylon gives its canvas tabIndex 1, which Tab reaches before anything else on
        // the page: the viewer is the tab stop instead.
        sceneEl.querySelector("canvas")?.setAttribute("tabindex", "-1");
        await this.cameraEl.updateComplete;
        let camera = this.camera;
        if (camera) {
            // Zoom in steps relative to the distance, so any size of model zooms evenly.
            camera.wheelDeltaPercentage = 0.01;
            camera.pinchDeltaPercentage = 0.01;
            // glTF models face +z, which the loader keeps: start in front of the model.
            camera.alpha = this.alpha ?? Math.PI / 2;
            if (this.beta != null) camera.beta = this.beta;
        }
        this.applyAutoRotate();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.rotateObserver) this.scene?.onBeforeRenderObservable.remove(this.rotateObserver);
        this.rotateObserver = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasUpdated)
            return;
        this.applyAutoRotate();
        // Added back after it was removed for good, the scene inside builds again, in its own
        // connectedCallback (which runs after this one): set the new scene up as the first was.
        let engine = this.sceneEl?.engine;
        queueMicrotask(() => {
            if (this.isConnected && this.sceneEl?.engine !== engine)
                this.setUpScene();
        });
    }

    private applyBackground() {
        let scene = this.scene;
        if (!scene) return;
        let value = (this.background ?? "transparent").trim();
        if (value == "transparent") {
            scene.clearColor = new Color4(0, 0, 0, 0);
            return;
        }
        let colour = value.startsWith("#") ? Color3.FromHexString(value) : Color3Convert.fromString(value);
        scene.clearColor = (colour ?? Color3.White()).toColor4(1);
    }

    private applyAutoRotate() {
        let scene = this.scene;
        if (this.rotateObserver) scene?.onBeforeRenderObservable.remove(this.rotateObserver);
        this.rotateObserver = null;
        if (!scene || !(this.autoRotate > 0) || !this.isConnected)
            return;
        // Read every frame, so a change of the reduced-motion setting takes effect at once.
        let reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        this.rotateObserver = scene.onBeforeRenderObservable.add(() => {
            let camera = this.camera;
            if (!camera || this.touched || reduce?.matches) return;
            camera.alpha += this.autoRotate * Math.PI / 180 * scene.getEngine().getDeltaTime() / 1000;
        });
    }

    private async onModelLoad() {
        await this.cameraEl.updateComplete;
        this.frame();
        this.framed = true;
        let scene = this.scene;
        if (this.posterEl && scene)
            scene.onAfterRenderObservable.addOnce(() => this.removePoster());
    }

    private removePoster() {
        this.posterEl?.remove();
        this.posterEl = null;
    }

    /**
     * Points the camera at the centre of the model's bounding box from a distance that fits
     * the whole model in view (or `radius`), and sets the clip planes and zoom limits from the
     * model's size. Runs when the model loads, and when the viewer's size changes before
     * anyone has touched it.
     */
    frame() {
        let camera = this.camera, holder = this.modelEl?.mesh;
        if (!camera || !holder)
            return;
        holder.computeWorldMatrix(true);
        let { min, max } = holder.getHierarchyBoundingVectors(true);
        let centre = min.add(max).scale(0.5);
        let r = Math.max(max.subtract(min).length() / 2, 1e-4);
        // The box's own shape: the engine may not have resized to it yet.
        let aspect = this.sceneEl.clientWidth / Math.max(1, this.sceneEl.clientHeight) || 1;
        let vHalf = camera.fov / 2;
        let hHalf = Math.atan(Math.tan(vHalf) * aspect);
        // The bounding sphere fits the narrower of the two angles, with a small margin.
        let fit = r / Math.sin(Math.min(vHalf, hHalf)) * 1.05;
        let radius = this.radius > 0 ? this.radius : fit;
        // Keep alpha and beta: without the last argument, setTarget works them out again from
        // the camera's position, which may not have moved to the start view yet (no frame
        // drawn since), and the model would be seen from behind.
        camera.setTarget(centre, false, false, true);
        camera.radius = radius;
        camera.lowerRadiusLimit = Math.min(r * 1.2, radius);
        camera.upperRadiusLimit = Math.max(fit, radius) * 4;
        camera.minZ = r * 0.01;
        camera.maxZ = (camera.upperRadiusLimit + r) * 2;
        if (this.alpha != null) camera.alpha = this.alpha;
        if (this.beta != null) camera.beta = this.beta;
    }
}
