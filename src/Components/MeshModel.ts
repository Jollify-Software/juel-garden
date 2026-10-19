import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Nullable } from "@babylonjs/core/types";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// Registers the glTF/GLB, OBJ and STL plugins with SceneLoader (side effect).
// Without it only Babylon's own .babylon format loads.
import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/OBJ";
import "@babylonjs/loaders/STL";
// Compressed glTF (Draco, meshopt) decodes with copies next to the bundle, not Babylon's CDN.
import "../Decoders";
import { customElement, property } from "lit/decorators.js";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";
import { AnimationMixer, PlayOptions, driveByMotion } from "../AnimationMixer";

/**
 * Imports an external 3D model file (glTF/GLB -- Draco- or meshopt-compressed
 * too, decoded offline from `decoders/` beside the bundle -- OBJ, STL, .babylon) via
 * Babylon's `SceneLoader.ImportMeshAsync`. A {@link GardenSkeletonMesh}, so an
 * imported rig's skeleton is picked up automatically for
 * `<garden-animation type="skeleton">`.
 *
 * The model hangs under an empty holder mesh, so `position`/`rotation`/`scale`
 * always work (a glTF root carries its own quaternion and handedness flip,
 * which would otherwise swallow `rotation`).
 *
 * Attributes:
 * - `src`: the model's URL (or use `root` + `filename`).
 * - `meshnames`: which meshes to import, empty/`"*"` for all.
 * - `height`: scales the model so it stands this tall (scene units, i.e.
 *   metres). Scans and downloads come in any unit; this fixes it.
 * - `fit`: alternatively, scales so the largest dimension is this size.
 * - `base`: `"ground"` (default when `height`/`fit` is set) moves the model
 *   so it stands on its own `position`, centred; `"none"` keeps the file's origin.
 * - `animation` (or `play`): a glTF animation group to loop (by name, any
 *   case), or `"none"` to stop the loader's auto-play.
 * - `anim-idle`, `anim-walk`, `anim-run`: animations picked by how fast the
 *   model moves (a `walk`, `follow`, `track` or `wander`, or anything moving
 *   it), cross-fading between them and speeding walk/run to match.
 *   `anim-walk-speed`/`anim-run-speed` are the speeds (units/second) the
 *   walk and run clips were made for, default `1.5` and `4`.
 *
 * - `load-distance`: don't load until the camera comes within this many
 *   metres of the model's `position` -- for big scans in a large venue, so
 *   the visitor only downloads what they walk up to.
 * - `loading-screen`: `"false"` to skip Babylon's loading screen, which
 *   otherwise covers the canvas while any model is loading. A model with
 *   `load-distance` loads quietly unless this is `"true"`.
 *
 * Script API: {@link play}`(name, { blend, loop, speed })` cross-fades to a
 * named animation (`loop: false` plays it once, then goes back to the
 * motion animation and fires `garden-animation-end`), {@link stopAnimation},
 * {@link animationNames}, and the underlying {@link mixer}.
 *
 * Fires `garden-model-progress` (detail: `{ loaded, total }`, bytes; `total`
 * is 0 when the server doesn't say), `garden-model-load` (detail:
 * `{ meshes, animationGroups }`) once loaded, and `garden-model-error`
 * (detail: `{ error }`) if it fails. A `<garden-info>` child opens when the
 * model is clicked and anchors to the model's centre.
 *
 * @example
 * ```html
 * <garden-mesh-model src="models/moai.glb" height="2.4" position="0 0 5"></garden-mesh-model>
 * ```
 *
 * @category Components
 */
@customElement("garden-mesh-model")
export class GardenMeshModel extends GardenSkeletonMesh {
    @property() meshNames: string;
    @property() src: string;
    @property() root: string;
    @property() filename: string;
    @property({ type: Number }) height: number;
    @property({ type: Number }) fit: number;
    @property() base: string;
    @property() animation: string;
    @property({ type: Number, attribute: "load-distance" }) loadDistance: number;

    animationGroups: AnimationGroup[] = [];
    private _mixer: AnimationMixer;
    private motionObserver: Nullable<Observer<Scene>>;
    /** Models still loading, across the page: the loading screen shows while this is above 0. */
    private static loading = 0;
    private loadedKey: string;
    private nearObserver: Nullable<Observer<Scene>>;
    private nearScene: Scene;

    /** Resolves once the model has loaded (or failed). */
    loaded: Promise<void>;

    updated(changed?: Map<string, unknown>) {
        let key = [this.src, this.root, this.filename, this.meshNames,
            this.height, this.fit, this.base, this.animation].join("|");
        if (key == this.loadedKey) {
            // Only position/rotation/scale etc. changed: no need to reload.
            if (this.mesh)
                this.update();
            return;
        }
        this.loadedKey = key;
        // whenReady waits for the model, so a follow camera or a `walk` targeting it
        // finds its mesh (with load-distance, not until the camera comes near).
        this.beginBuild();
        this.loaded = (this.loadDistance > 0 ? this.whenNear().then(() => this.load()) : this.load())
            .finally(() => this.endBuild());
    }

    /** Resolves once the active camera is within `load-distance` of the model. */
    private whenNear(): Promise<void> {
        let scene = this.nearScene = this.getScene();
        if (this.nearObserver) scene.onBeforeRenderObservable.remove(this.nearObserver);
        return new Promise(resolve => {
            let frame = 0;
            this.nearObserver = scene.onBeforeRenderObservable.add(() => {
                if (frame++ % 15) return; // a few checks a second is plenty
                let camera = scene.activeCamera;
                if (!camera) return;
                let at = this.position ?? Vector3.Zero();
                if (Vector3.Distance(camera.globalPosition, at) > this.loadDistance) return;
                scene.onBeforeRenderObservable.remove(this.nearObserver);
                this.nearObserver = null;
                resolve();
            });
        });
    }

    /** Plays the model's named animations with cross-fades. Created on first use (or by `animation`/`anim-*`), which stops the loader's auto-play. */
    get mixer(): AnimationMixer {
        if (!this._mixer && this.animationGroups.length)
            this._mixer = new AnimationMixer(this.getScene(), this.animationGroups, this);
        return this._mixer;
    }

    /** The model's animation names. */
    get animationNames(): string[] {
        return this.animationGroups.map(g => g.name);
    }

    /** Cross-fades to the animation `name` (any case). False if the model has no such animation. */
    play(name: string, options?: PlayOptions): boolean {
        return this.mixer?.play(name, options) ?? false;
    }

    /** Stops the animations, fading out over `blend` seconds (default 0.25). */
    stopAnimation(blend?: number) {
        this.mixer?.stop(blend);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.motionObserver) this.nearScene?.onBeforeRenderObservable.remove(this.motionObserver);
        this.motionObserver = null;
        // getScene() walks parentElement, which is gone by now.
        if (this.nearObserver) this.nearScene?.onBeforeRenderObservable.remove(this.nearObserver);
        this.nearObserver = null;
    }

    private async load() {
        let scene = this.getScene();
        let [root, file] = this.src ? splitUrl(this.src) : [this.root ?? "", this.filename];
        if (!file) return;
        let names = !this.meshNames || this.meshNames == "*" ? "" : this.meshNames;
        let screenAttr = this.getAttribute("loading-screen");
        let screen = this.loadDistance > 0 ? screenAttr == "true" : screenAttr != "false";
        let engine = scene.getEngine();
        if (screen && GardenMeshModel.loading++ == 0)
            engine.displayLoadingUI();
        let progress = (e: { loaded: number, total: number, lengthComputable: boolean }) => {
            let total = e.lengthComputable ? e.total : 0;
            if (screen && total)
                engine.loadingUIText = `Loading ${Math.round(100 * e.loaded / total)}%`;
            this.dispatchEvent(new CustomEvent("garden-model-progress", { bubbles: true, detail: { loaded: e.loaded, total } }));
        };
        let result;
        try {
            result = await SceneLoader.ImportMeshAsync(names, root, file, scene, progress);
        } catch (error) {
            console.error(`<garden-mesh-model> couldn't load ${root}${file}`, error);
            this.dispatchEvent(new CustomEvent("garden-model-error", { bubbles: true, detail: { error } }));
            return;
        } finally {
            if (screen && --GardenMeshModel.loading == 0)
                engine.hideLoadingUI();
        }

        for (let group of this.animationGroups) group.dispose();
        this._mixer?.dispose();
        this._mixer = null;
        if (this.motionObserver) scene.onBeforeRenderObservable.remove(this.motionObserver);
        this.motionObserver = null;
        this.animationGroups = result.animationGroups;

        let holder = new Mesh(this.id || "garden-mesh-model", scene);
        let tops = result.meshes.filter(m => !m.parent);
        for (let top of tops) top.parent = holder;

        let target = this.height || this.fit;
        if (target) {
            let { min, max } = holder.getHierarchyBoundingVectors(true);
            let size = max.subtract(min);
            let current = this.height ? size.y : Math.max(size.x, size.y, size.z);
            let k = current > 0 ? target / current : 1;
            let ground = (this.base ?? "ground") == "ground";
            for (let top of tops) {
                top.scaling.scaleInPlace(k);
                if (ground)
                    top.position.subtractInPlace(new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2).scale(k));
                else
                    top.position.scaleInPlace(k);
            }
        }

        let first = this.animation ?? this.getAttribute("play");
        if (first == "none") {
            for (let group of this.animationGroups) group.stop();
        } else if (first) {
            this.mixer?.play(first, { blend: 0 });
        }

        if (result.skeletons.length > 0)
            this.skeleton = result.skeletons[0];
        this.setMesh(holder);
        this.update();

        let anim = (name: string) => this.getAttribute("anim-" + name);
        if (this.mixer && (anim("idle") || anim("walk") || anim("run"))) {
            this.nearScene = scene;
            let num = (name: string, fallback: number) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : fallback;
            this.motionObserver = driveByMotion(this.mixer, scene, holder, {
                idle: anim("idle"), walk: anim("walk"), run: anim("run"),
                walkSpeed: num("anim-walk-speed", 1.5), runSpeed: num("anim-run-speed", 4),
                speedOf: () => {
                    let walker = (<any>this).walker, follower = (<any>this).follower;
                    return walker?.enabled ? walker.speed : follower?.enabled ? follower.speed : undefined;
                },
            });
        }

        this.dispatchEvent(new CustomEvent("garden-model-load", {
            bubbles: true, detail: { meshes: result.meshes, animationGroups: this.animationGroups }
        }));
    }
}

/** "https://x/y/moai.glb?v=1" → ["https://x/y/", "moai.glb?v=1"]; a data: or blob: URL stays whole. */
function splitUrl(url: string): [string, string] {
    if (/^(data|blob):/.test(url)) return ["", url];
    let path = url.split(/[?#]/)[0];
    let slash = path.lastIndexOf("/");
    return slash < 0 ? ["", url] : [url.substring(0, slash + 1), url.substring(slash + 1)];
}
