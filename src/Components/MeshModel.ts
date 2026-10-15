import { AnimationGroup, Mesh, SceneLoader, Vector3 } from "babylonjs";
// Registers the glTF/GLB, OBJ and STL plugins with SceneLoader (side effect).
// Without it only Babylon's own .babylon format loads.
import "babylonjs-loaders";
import { customElement, property } from "lit/decorators";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";

/**
 * Imports an external 3D model file (glTF/GLB, OBJ, STL, .babylon) via
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
 * - `animation`: a glTF animation group to loop (by name), or `"none"` to stop
 *   the loader's auto-play.
 *
 * - `loading-screen`: `"false"` to skip Babylon's loading screen, which
 *   otherwise covers the canvas while any model is loading.
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

    animationGroups: AnimationGroup[] = [];
    /** Models still loading, across the page: the loading screen shows while this is above 0. */
    private static loading = 0;
    private loadedKey: string;

    /** Resolves once the model has loaded (or failed). */
    loaded: Promise<void>;

    updated(changed: Map<string, unknown>) {
        let key = [this.src, this.root, this.filename, this.meshNames,
            this.height, this.fit, this.base, this.animation].join("|");
        if (key == this.loadedKey) {
            // Only position/rotation/scale etc. changed: no need to reload.
            if (this.mesh)
                this.update();
            return;
        }
        this.loadedKey = key;
        this.loaded = this.load();
    }

    private async load() {
        let scene = this.getScene();
        let [root, file] = this.src ? splitUrl(this.src) : [this.root ?? "", this.filename];
        if (!file) return;
        let names = !this.meshNames || this.meshNames == "*" ? "" : this.meshNames;
        let screen = this.getAttribute("loading-screen") != "false";
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

        if (this.animation == "none") {
            for (let group of this.animationGroups) group.stop();
        } else if (this.animation) {
            for (let group of this.animationGroups) group.stop();
            let group = this.animationGroups.find(g => g.name == this.animation);
            if (group) group.start(true);
            else console.warn(`<garden-mesh-model> has no animation "${this.animation}"; it has: ${this.animationGroups.map(g => g.name).join(", ")}`);
        }

        if (result.skeletons.length > 0)
            this.skeleton = result.skeletons[0];
        this.setMesh(holder);
        this.update();

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
