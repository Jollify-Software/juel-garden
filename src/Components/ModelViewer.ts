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
 * A viewer's camera: `alpha` and `beta` (radians, as `<garden-camera>`), `radius` (metres from
 * `target`) and `target`, the point it turns round (the model's centre, unless someone panned).
 */
export interface ModelView {
    alpha: number;
    beta: number;
    radius: number;
    target?: { x: number; y: number; z: number };
}

/** How often, at most, `garden-view-change` fires: 15 times a second. */
const ViewEventGap = 1000 / 15;

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
 * - **The view, for another screen:** when a person turns or zooms the model (a drag, the wheel,
 *   a pinch, a key, and the camera's glide after them), the viewer fires `garden-view-change`
 *   (bubbling) with a {@link ModelView} as its `detail`, at most 15 times a second and once more
 *   when it stops. Never for `auto-rotate`, for framing, or for a view it was given.
 *   {@link setView} moves the camera to such a view, eased, and stops `auto-rotate`;
 *   {@link getView} reads it. A presentation uses them to show the presenter's turn on the
 *   audience's screen.
 * - **Animations:** {@link animationNames}, {@link play}, {@link playOnce} (a one-shot that
 *   holds its last frame, with a Promise) and {@link stopAnimation}. No animation plays on
 *   its own (the model loads with `animation="none"`) and no buttons are drawn: the page
 *   makes its own.
 * - **Loading:** `poster` (an image URL) shows until the model's first frame; there's no
 *   loading screen. {@link loaded} is a Promise for the model (`true` loaded, `false`
 *   not), there from the start. The model's `garden-model-load`, `garden-model-error` and
 *   `garden-model-progress` events bubble out of the viewer.
 * - **Deferred:** `deferred` builds no scene and holds no WebGL context, for a page with more
 *   models than a browser allows contexts (about 16), such as a slide deck: it shows `poster`, or
 *   the frame it last drew ({@link still}). Taking the attribute away builds the scene and
 *   loads the model; adding it again keeps a still, disposes the scene and lets the context go.
 *   {@link loaded} waits until the model has been asked for. Without the attribute nothing changes.
 * - **A model that can't load:** the page's `slot="fallback"` content takes the empty scene's
 *   place, with a `load-failed` attribute (a CSS hook), until a model does load. With no such
 *   content the scene stays. A page opened straight from disk is the usual case, as a browser
 *   won't let it read the model's file.
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
    /** The file type (`glb`, `.gltf`), for a `src` whose URL doesn't end in one: a `data:` or `blob:` URL. */
    @property() extension: string;
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
    /** Build no scene, and hold no WebGL context, until this is taken away (see above). */
    @property({ type: Boolean }) deferred: boolean;

    /**
     * The frame the viewer last drew before it was deferred, as a data URL; `undefined` if it
     * hasn't drawn the model yet. What a deferred viewer shows when it has no `poster`.
     */
    still: string;

    private sceneEl: GardenScene;
    private cameraEl: GardenCamera;
    private modelEl: GardenMeshModel;
    private posterEl: HTMLImageElement;
    private touched = false;
    private framed = false;
    /** The view last set by the viewer itself (framing, {@link setView}): a camera there isn't a person's move. */
    private placed: Nullable<ModelView> = null;
    /** A view asked for before the model was framed, applied once it is. */
    private pendingView: Nullable<ModelView> = null;
    private viewObserver: Nullable<Observer<unknown>> = null;
    private easeObserver: Nullable<Observer<Scene>> = null;
    private lastViewEvent = 0;
    private viewEventTimer = 0;
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

    /**
     * The camera's view now ({@link ModelView}). Before the model is framed (or while deferred),
     * the view {@link setView} was given to apply when it is, or `null`.
     */
    getView(): Nullable<ModelView> {
        let camera = this.camera;
        if (!camera || !this.framed) return this.pendingView;
        let t = camera.target;
        return { alpha: camera.alpha, beta: camera.beta, radius: camera.radius, target: { x: t.x, y: t.y, z: t.z } };
    }

    /**
     * Moves the camera to `view`, easing over `ease` seconds (default 0.15; 0 jumps), and stops
     * `auto-rotate` for good, as a person's touch does. Fires no `garden-view-change`. Turns the
     * short way round: an `alpha` a whole turn or more away (one viewer has turned on its own)
     * doesn't spin the model round. Before the model is framed, or while deferred, it's kept and
     * applied once the model is framed. A person's touch during the ease takes over.
     */
    setView(view: ModelView, options: { ease?: number } = {}): void {
        this.touched = true;
        let camera = this.camera;
        if (!camera || !this.framed) {
            this.pendingView = view;
            return;
        }
        this.pendingView = null;
        this.stopEase();
        let from = this.getView();
        let turn = 2 * Math.PI;
        let to: ModelView = { ...view, alpha: view.alpha + turn * Math.round((from.alpha - view.alpha) / turn) };
        // The camera's own glide from an earlier drag would carry on over the new view.
        camera.inertialAlphaOffset = camera.inertialBetaOffset = camera.inertialRadiusOffset = 0;
        camera.inertialPanningX = camera.inertialPanningY = 0;
        let ease = Math.max(0, options.ease ?? 0.15) * 1000;
        if (!ease || !this.scene) {
            this.place(to);
            return;
        }
        let start = performance.now();
        let mix = (a: number, b: number, k: number) => a + (b - a) * k;
        this.easeObserver = this.scene.onBeforeRenderObservable.add(() => {
            let k = Math.min(1, (performance.now() - start) / ease);
            let s = k * k * (3 - 2 * k);
            let ft = from.target, tt = to.target ?? ft;
            this.place({
                alpha: mix(from.alpha, to.alpha, s), beta: mix(from.beta, to.beta, s), radius: mix(from.radius, to.radius, s),
                target: { x: mix(ft.x, tt.x, s), y: mix(ft.y, tt.y, s), z: mix(ft.z, tt.z, s) },
            });
            if (k >= 1) this.stopEase();
        });
    }

    /** Puts the camera at `view` and remembers it as the viewer's own. */
    private place(view: ModelView) {
        let camera = this.camera;
        if (!camera) return;
        // Within the camera's limits, as it would clamp them itself on the next frame (and that
        // clamp would look like a person's move).
        camera.alpha = view.alpha;
        camera.beta = Math.min(Math.max(view.beta, camera.lowerBetaLimit ?? -Infinity), camera.upperBetaLimit ?? Infinity);
        camera.radius = Math.min(Math.max(view.radius, camera.lowerRadiusLimit ?? 0), camera.upperRadiusLimit ?? Infinity);
        if (view.target) camera.target.copyFromFloats(view.target.x, view.target.y, view.target.z);
        this.placed = this.getView();
    }

    private stopEase() {
        if (this.easeObserver) this.scene?.onBeforeRenderObservable.remove(this.easeObserver);
        this.easeObserver = null;
    }

    /** The camera moved: a person's move (not the viewer's own) becomes a `garden-view-change`. */
    private onViewChanged() {
        if (!this.touched || !this.framed || this.easeObserver) return;
        let now = this.getView(), placed = this.placed;
        if (placed && Math.abs(now.alpha - placed.alpha) < 1e-6 && Math.abs(now.beta - placed.beta) < 1e-6
            && Math.abs(now.radius - placed.radius) < 1e-6 * Math.max(1, placed.radius)
            && (!placed.target || Math.hypot(now.target.x - placed.target.x, now.target.y - placed.target.y, now.target.z - placed.target.z) < 1e-6 * Math.max(1, placed.radius)))
            return;
        this.placed = null;
        if (this.viewEventTimer) return;
        let wait = this.lastViewEvent + ViewEventGap - performance.now();
        if (wait <= 0) this.sendView();
        // The last move before a pause is always sent: the timer reads the view when it fires.
        else this.viewEventTimer = window.setTimeout(() => { this.viewEventTimer = 0; this.sendView(); }, wait);
    }

    private sendView() {
        let view = this.camera && this.framed ? this.getView() : null;
        if (!view) return;
        this.lastViewEvent = performance.now();
        this.dispatchEvent(new CustomEvent<ModelView>("garden-view-change", { detail: view, bubbles: true, composed: true }));
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

    /**
     * Holds the model at the first or last frame of a named animation, at once, with nothing
     * playing: the state before a step, or its end when the viewer prefers reduced motion.
     *
     * @example
     * ```js
     * viewer.pose("Open", "start"); // the lid is shut again
     * ```
     */
    pose(name: string, at?: "start" | "end"): boolean {
        return this.modelEl?.pose(name, at) ?? false;
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
            garden-model-viewer:not([no-webgl]):not([load-failed]) > [slot="fallback"] {
                display: none;
            }
            garden-model-viewer[load-failed] > garden-scene {
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

    /** The picture over the viewer while it has no frame of its own: `poster`, else its last frame. */
    private makePoster() {
        let src = this.poster || this.still;
        if (!src || this.posterEl)
            return;
        this.posterEl = document.createElement("img");
        this.posterEl.className = "garden-model-viewer-poster";
        this.posterEl.alt = "";
        this.posterEl.src = src;
    }

    firstUpdated() {
        GardenModelViewer.injectStyles();
        this.makePoster();
        if (!GardenModelViewer.webglAvailable) {
            this.showNoWebgl();
            return;
        }

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
        this.addEventListener("pointerdown", () => { this.touched = true; this.stopEase(); }, { capture: true });
        if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
        if (!this.hasAttribute("role")) this.setAttribute("role", "img");
        this.addEventListener("keydown", e => this.onKey(e));

        if (this.deferred) {
            if (this.posterEl) this.append(this.posterEl);
            return;
        }
        this.startScene();
    }

    /** Builds the scene and starts loading the model. */
    private startScene() {
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
        if (this.extension) modelEl.setAttribute("extension", this.extension);
        if (this.src) modelEl.setAttribute("src", this.src);
        sceneEl.append(cameraEl, hemi, sun, modelEl);

        this.sceneEl = sceneEl;
        this.cameraEl = cameraEl;
        this.modelEl = modelEl;

        modelEl.addEventListener("garden-model-load", e => {
            if (e.target == modelEl && this.modelEl == modelEl) {
                this.removeAttribute("load-failed");
                this.settleLoaded(true);
                this.onModelLoad();
            }
        });
        modelEl.addEventListener("garden-model-error", e => {
            if (e.target == modelEl && this.modelEl == modelEl) {
                this.settleLoaded(false);
                this.removePoster();
                // The page's own words, rather than an empty scene. With none, the scene stays, as it did.
                if (this.querySelector(':scope > [slot="fallback"]'))
                    this.setAttribute("load-failed", "");
            }
        });
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

    /**
     * Keeps the frame on show as {@link still}, disposes the scene and lets its WebGL context go
     * at once: Babylon's dispose leaves that to the garbage collector, too late for a browser
     * that counts live contexts. The next start begins afresh, from the start view.
     */
    private stopScene() {
        let sceneEl = this.sceneEl, canvas = sceneEl.querySelector("canvas");
        // Only once its shaders are ready: until then a frame has nothing in it, and an empty
        // picture would hide nothing but say "this is the model".
        if (this.framed && canvas && this.scene?.isReady()) {
            // Drawn here, in the same task: a WebGL canvas is blank to read otherwise.
            try {
                this.scene?.render();
                this.still = canvas.toDataURL("image/webp", 0.9);
            } catch { /* no still, then: the poster or nothing */ }
        }
        if (this.rotateObserver) this.scene?.onBeforeRenderObservable.remove(this.rotateObserver);
        this.rotateObserver = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.stopEase();
        this.camera?.onViewMatrixChangedObservable.remove(this.viewObserver as Observer<any>);
        this.viewObserver = null;
        window.clearTimeout(this.viewEventTimer);
        this.viewEventTimer = 0;
        this.placed = null;
        this.sceneEl = this.cameraEl = this.modelEl = null;
        this.framed = false;
        this.touched = false;
        if (this.loadedSettled)
            this.newLoaded();
        this.removePoster();
        this.makePoster();
        if (this.posterEl) this.append(this.posterEl);
        // Removed, the scene disposes its engine in a microtask (GardenScene): this one runs after it.
        sceneEl.remove();
        queueMicrotask(() => {
            let gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
            gl?.getExtension("WEBGL_lose_context")?.loseContext();
        });
    }

    updated(changed: Map<PropertyKey, unknown>) {
        if (changed.has("label") || changed.has("src")) {
            let label = this.label || (this.src ?? "").split(/[?#]/)[0].split("/").pop();
            if (label) this.setAttribute("aria-label", label);
        }
        if (changed.has("deferred") && GardenModelViewer.webglAvailable) {
            if (this.deferred && this.sceneEl) this.stopScene();
            else if (!this.deferred && !this.sceneEl) {
                this.startScene();
                return;
            }
        }
        if (!this.modelEl)
            return;
        if (changed.has("extension") && this.extension)
            this.modelEl.setAttribute("extension", this.extension);
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
            this.viewObserver = camera.onViewMatrixChangedObservable.add(() => this.onViewChanged());
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
        if (this.pendingView) this.setView(this.pendingView, { ease: 0 });
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
        // The viewer's own view, not a person's move.
        let t = camera.target;
        this.placed = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius, target: { x: t.x, y: t.y, z: t.z } };
    }
}
