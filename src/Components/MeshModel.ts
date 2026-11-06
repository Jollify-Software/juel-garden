import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Material } from "@babylonjs/core/Materials/material";
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
import { AnimationMixer, PlayOptions, WeightOptions, driveByMotion, skeletonRangeClips } from "../AnimationMixer";
import { RootMotionClip, RootMotionController } from "../RootMotion";
import { GardenElement } from "../GardenElement";
import type { GardenClip } from "./Clip";
import { toStandardMaterials } from "../Utils/StandardMaterials";

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
 * - `extension`: the file type (`glb`, `.gltf`, `obj`…), for a `src` whose URL doesn't end in
 *   one, such as a `blob:` or `data:` URL. Babylon picks its loader by it
 *   (`pluginExtension`). Without it, the loader is guessed from the URL.
 * - `meshnames`: which meshes to import, empty/`"*"` for all.
 * - `height`: scales the model so it stands this tall (scene units, i.e.
 *   metres). Scans and downloads come in any unit; this fixes it.
 * - `fit`: alternatively, scales so the largest dimension is this size.
 * - `base`: `"ground"` (default when `height`/`fit` is set) moves the model
 *   so it stands on its own `position`, centred; `"none"` keeps the file's origin.
 * - `animation` (or `play`): a glTF animation group to loop (by name, any
 *   case), or `"none"` to stop the loader's auto-play. With `"none"`, start
 *   animations with {@link play} or {@link playOnce}: every group's weight is 0
 *   once the model loads, so a group a page starts itself (`group.start()`)
 *   moves nothing unless the page also sets `group.weight = 1`. A `.babylon` file's named
 *   skeleton ranges are animations too. Changed later, it cross-fades to the new one.
 * - `click-play`: animations a click (or tap) on the model plays, one each click, in turn:
 *   `"Open, Close"` opens a hinged box on the first click and closes it on the next. Each plays
 *   once and holds its last frame (or goes back to `animation`, if it has one); a click while
 *   one is playing waits for it. Empty or bare: every animation, in the file's order.
 * - `blend`: the cross-fade time, seconds, when `animation`/`play` or `weights` change
 *   (default 0.25; 0 cuts).
 * - `weights`: several animations playing at once, each at its own weight,
 *   `"walk 0.5, strafe 0.5"` (see {@link AnimationMixer.setWeights}); changed later, they
 *   fade to the new weights over `blend`. `sync` names the one the others keep in step with.
 * - `<garden-clip>` children add animations: cut by frame from the model's own, or
 *   retargeted from another file (see {@link GardenClip}).
 * - `anim-idle`, `anim-walk`, `anim-run`: animations picked by how fast the
 *   model moves (a `walk`, `follow`, `track` or `wander`, or anything moving
 *   it), cross-fading between them and speeding walk/run to match.
 *   `anim-walk-speed`/`anim-run-speed` are the speeds (units/second) the
 *   walk and run clips were made for, default `1.5` and `4`; `"auto"` measures
 *   it from the clip (its root motion, see {@link rootMotionOf}).
 * - `root-motion`: the animations move the model. Each clip's travel is measured once
 *   (from the root's own travel, else from the planted feet of an in-place cycle; see
 *   {@link RootMotionClip}), the pose plays in place and the model's node is moved by it,
 *   weighted as the animations are blended, so the feet don't skate. Live; not for a model
 *   that `walk`, `follow` or anything else moves as well. {@link rootMotionOf} reads a clip's
 *   measured `cycleDistance`, `duration`, `speed`, `direction` and `source`.
 *
 * - `load-distance`: don't load until the camera comes within this many
 *   metres of the model's `position` -- for big scans in a large venue, so
 *   the visitor only downloads what they walk up to.
 * - `materials`: `"standard"` swaps the glTF's PBR materials for StandardMaterials when it
 *   loads (see {@link "Utils/StandardMaterials"!toStandardMaterials}), for a scene without an environment map, where
 *   PBR models come out dark.
 * - `loading-screen`: `"false"` to skip Babylon's loading screen, which
 *   otherwise covers the canvas while any model is loading. A model with
 *   `load-distance` loads quietly unless this is `"true"`.
 *
 * A `<garden-material>` child (a node or shader material, say) dresses every
 * part of the model that has geometry, in place of the file's materials; with
 * `part="name"` (or several names) only the parts of those names, so each part can
 * wear its own. `<garden-particle part="name">` emits from a part's surface, and
 * `<garden-animation part="name">` animates a part (or, with `morph`, one of its
 * morph targets). {@link getPart} finds a part by name.
 *
 * Script API: {@link play}`(name, { blend, loop, speed })` cross-fades to a
 * named animation (`loop: false` plays it once, then goes back to the
 * motion animation and fires `garden-animation-end`; with none it holds its
 * last frame), {@link playOnce} (the same, as a Promise), {@link stopAnimation},
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
    @property() extension: string;
    @property() root: string;
    @property() filename: string;
    @property({ type: Number }) height: number;
    @property({ type: Number }) fit: number;
    @property() base: string;
    @property() animation: string;
    @property({ attribute: "click-play" }) clickPlay: string;
    @property({ type: Number, attribute: "load-distance" }) loadDistance: number;

    animationGroups: AnimationGroup[] = [];
    private _mixer: AnimationMixer;
    private motionObserver: Nullable<Observer<Scene>>;
    /** Models still loading, across the page: the loading screen shows while this is above 0. */
    private static loading = 0;
    private loadedKey: string;
    private loadedMeshes: AbstractMesh[] = [];
    private nearObserver: Nullable<Observer<Scene>>;
    private nearScene: Scene;
    /** The `animation`/`play` and `weights` last applied, so a change of either cross-fades. */
    private playedAnimation: string;
    private playedWeights: string;
    /** The groups its `<garden-clip>` children made. */
    private clipGroups = new Map<GardenClip, AnimationGroup>();
    private loadedHolder: Mesh;
    /** Its animations are a `.babylon` skeleton's named ranges, cut from one take of the bones' own animation. */
    fromRanges = false;
    /** True once the model has loaded and built its clips: a clip changed after that builds again. */
    clipsBuilt = false;
    /** Each animation's root motion, measured on first use, by the model's own group. */
    private rootClips = new Map<AnimationGroup, RootMotionClip>();
    /** Moves the model by its clips' root motion while `root-motion` is on. */
    private rootController: RootMotionController;
    /** The `root-motion` last applied. */
    private rootMotionApplied = false;

    /** Resolves once the model has loaded (or failed). */
    loaded: Promise<void>;

    /** Reloads only when what it loads changes; anything else applies in place. */
    protected get handlesChanges() {
        return true;
    }

    updated(changed?: Map<string, unknown>) {
        let key = [this.src, this.extension, this.root, this.filename, this.meshNames,
            this.height, this.fit, this.base].join("|");
        if (key == this.loadedKey) {
            // Only position/rotation/scale, or which animations play, changed: no need to reload.
            if (this.mesh) {
                this.applyTransform();
                if (this.clipsBuilt) {
                    this.applyRootMotion();
                    this.applyAnimations();
                }
            }
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
    /** Which of `click-play`'s animations the next click plays. */
    private clickTurn = 0;
    private clickPlaying = false;
    private onPick = () => {
        if (!this.hasAttribute("click-play") || this.clickPlaying) return;
        let list = (this.clickPlay ?? "").split(",").map(s => s.trim()).filter(s => s);
        if (!list.length) list = this.animationNames;
        if (!list.length) return;
        let name = list[this.clickTurn++ % list.length];
        this.clickPlaying = true;
        this.playOnce(name).finally(() => this.clickPlaying = false);
    };

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener("garden-pick", this.onPick);
    }

    disconnectedCallback() {
        this.removeEventListener("garden-pick", this.onPick);
        super.disconnectedCallback();
    }

    get animationNames(): string[] {
        return this.animationGroups.map(g => g.name);
    }

    /** Cross-fades to the animation `name` (any case). False if the model has no such animation. */
    play(name: string, options?: PlayOptions): boolean {
        return this.mixer?.play(name, options) ?? false;
    }

    /**
     * Plays several animations at once at their own weights (`{ walk: 0.5, strafe: 0.5 }`),
     * fading to them over `blend` seconds; `sync` keeps the others in step with one. See
     * {@link AnimationMixer.setWeights}.
     */
    setWeights(weights: Record<string, number>, options?: WeightOptions) {
        this.mixer?.setWeights(weights, options);
    }

    /** True while `root-motion` is on (present and not `"false"`). */
    get rootMotion(): boolean {
        return this.hasAttribute("root-motion") && this.getAttribute("root-motion") != "false";
    }

    /**
     * The root motion of the animation `name` (any case): how far a cycle carries the model
     * (`cycleDistance`, in the model's units), in how long (`duration`), its `speed`, `direction`
     * and where that came from (`source`: `"root"`, `"contact"` or `"none"`). Measured once,
     * whether `root-motion` is on or not. Null before the model loads or with no such animation.
     */
    rootMotionOf(name: string): RootMotionClip {
        let group = this.animationGroups.find(g => g.name.toLowerCase() == name?.toLowerCase());
        if (!group || !this.loadedHolder)
            return null;
        let clip = this.rootClips.get(group);
        if (!clip) {
            try {
                clip = new RootMotionClip(group, this.loadedHolder);
            } catch (error) {
                console.warn(`<garden-mesh-model> couldn't measure the root motion of "${group.name}"`, error);
                return null;
            }
            this.rootClips.set(group, clip);
        }
        return clip;
    }

    /**
     * `root-motion` on: every animation's in-place group stands in for it in the mixer and the
     * controller moves the model; off: the model's own groups again. What was playing carries
     * on (from the start of its cycle) on the other groups.
     */
    private applyRootMotion() {
        let on = this.rootMotion && !!this.loadedHolder;
        // Clips whose animation went (a <garden-clip> rebuilt) go too.
        for (let [group, clip] of this.rootClips)
            if (!this.animationGroups.includes(group)) {
                this.rootController?.remove(clip);
                clip.dispose();
                this.rootClips.delete(group);
            }
        if (on == this.rootMotionApplied && (!on || this.animationGroups.every(g => this.rootClips.has(g))))
            return;
        this.rootMotionApplied = on;
        let mixer = this.mixer;
        let current = mixer?.current;
        if (on && !this.rootController)
            this.rootController = new RootMotionController(this.loadedHolder);
        let swapped = false;
        for (let group of this.animationGroups) {
            let clip = on ? this.rootMotionOf(group.name) : this.rootClips.get(group);
            if (!clip) continue;
            if (on) this.rootController.add(clip);
            let wanted = on ? clip.inPlace : group;
            if (mixer && mixer.group(group.name) != wanted) {
                mixer.add(wanted);
                swapped = true;
            }
        }
        if (!on) {
            this.rootController?.dispose();
            this.rootController = null;
        }
        if (swapped) {
            this.playedAnimation = this.playedWeights = undefined;
            this.applyAnimations(0);
            if (current && !mixer.current)
                mixer.play(current, { blend: 0 });
        }
    }

    /** The `blend` attribute: seconds, default 0.25. */
    private get blendTime(): number {
        let value = Number(this.getAttribute("blend"));
        return this.hasAttribute("blend") && Number.isFinite(value) ? value : 0.25;
    }

    /** `"walk 0.5, strafe 0.5"` as `{ walk: 0.5, strafe: 0.5 }` (a name may have spaces in it). */
    static parseWeights(value: string): Record<string, number> {
        let out: Record<string, number> = {};
        for (let part of (value ?? "").split(",")) {
            let match = part.trim().match(/^(.*\S)\s+(-?[\d.]+)$/);
            if (match) out[match[1]] = Number(match[2]);
        }
        return out;
    }

    /**
     * `animation`/`play` and `weights`, when either is new: at load (`blend` 0, it starts as
     * it is) and after any change of them (cross-fading over `blend`).
     */
    private applyAnimations(blend = this.blendTime) {
        let weights = this.getAttribute("weights");
        let sync = this.getAttribute("sync");
        let both = weights == null ? null : weights + "|" + (sync ?? "");
        // `weights` taken off: back to the `play` animation, even if `play` itself didn't change.
        if (both == null && this.playedWeights != null)
            this.playedAnimation = undefined;
        let first = this.animation ?? this.getAttribute("play");
        if (first != this.playedAnimation) {
            this.playedAnimation = first;
            if (first == "none") {
                if (this._mixer) this._mixer.stop(blend);
                else for (let group of this.animationGroups) group.stop();
            } else if (first) {
                this.mixer?.play(first, { blend });
            }
        }
        if (both != this.playedWeights) {
            this.playedWeights = both;
            if (weights != null)
                this.mixer?.setWeights(GardenMeshModel.parseWeights(weights), { blend, sync: sync ?? undefined });
        }
    }

    /** Builds a `<garden-clip>` again after it changed, replacing its old animation. */
    async rebuildClip(clip: GardenClip) {
        this.removeClip(clip);
        this.applyRootMotion();
        if (!this.loadedHolder || clip.parentElement != this)
            return;
        let key = this.loadedKey;
        let group = await clip.build(this, this.loadedHolder, this.ownGroups());
        if (!group || key != this.loadedKey || clip.parentElement != this) {
            group?.dispose();
            return;
        }
        this.addClipGroup(clip, group);
        this.applyRootMotion();
        // Asked for by `play` or `weights` (or playing before the change): play it now.
        let name = group.name.toLowerCase();
        let wanted = (this.animation ?? this.getAttribute("play"))?.toLowerCase() == name
            || Object.keys(GardenMeshModel.parseWeights(this.getAttribute("weights"))).some(n => n.toLowerCase() == name);
        if (wanted || this._mixer?.current?.toLowerCase() == name) {
            this.playedAnimation = this.playedWeights = undefined;
            this.applyAnimations(0);
        }
    }

    /** Takes a `<garden-clip>`'s animation off the model. */
    removeClip(clip: GardenClip) {
        let group = this.clipGroups.get(clip);
        if (!group)
            return;
        this.clipGroups.delete(clip);
        this._mixer?.remove(group);
        this.animationGroups = this.animationGroups.filter(g => g != group);
        group.dispose();
    }

    /** The animations the file had (or its ranges made), not the clips. */
    private ownGroups(): AnimationGroup[] {
        let clips = new Set(this.clipGroups.values());
        return this.animationGroups.filter(g => !clips.has(g));
    }

    private addClipGroup(clip: GardenClip, group: AnimationGroup) {
        this.clipGroups.set(clip, group);
        // A clip with an animation's name stands in for it.
        let same = this.animationGroups.filter(g => g != group && g.name.toLowerCase() == group.name.toLowerCase());
        for (let old of same) old.stop();
        this.animationGroups = this.animationGroups.filter(g => !same.includes(g) && g != group).concat(group);
        if (this._mixer) this._mixer.add(group);
        group.stop();
    }

    /**
     * Plays the animation `name` once; resolves `true` when it ends (it then holds its last
     * frame unless there is a motion or looping animation to go back to), `false` if there is
     * no such animation, another play or stop took over first, or the model was removed or
     * reloaded. See {@link AnimationMixer.playOnce}.
     *
     * @example
     * ```js
     * const box = document.querySelector("garden-mesh-model");
     * await box.playOnce("Open");
     * await box.playOnce("Close");
     * ```
     */
    playOnce(name: string, options?: Omit<PlayOptions, "loop">): Promise<boolean> {
        return this.mixer?.playOnce(name, options) ?? Promise.resolve(false);
    }

    /** Holds the model at the first or last frame of `name`, at once, with nothing playing. See {@link AnimationMixer.pose}. */
    pose(name: string, at?: "start" | "end"): boolean {
        return this.mixer?.pose(name, at) ?? false;
    }

    /** Stops the animations, fading out over `blend` seconds (default 0.25). */
    stopAnimation(blend?: number) {
        this.mixer?.stop(blend);
    }

    /**
     * A `<garden-material>` child dresses every part of the model that has geometry, or with
     * `part` (names, separated by spaces) only the parts of those names.
     */
    setMaterial(material: Material, part?: string) {
        let names = part?.trim() ? part.trim().split(/\s+/) : null;
        for (let mesh of names ? names.map(name => this.getPart(name)).filter(m => m) : this.loadedMeshes)
            if (mesh.getTotalVertices() > 0)
                mesh.material = material;
    }

    /**
     * The loaded part (a mesh, or an empty node) with this name -- exactly, else in any case --
     * or null, also before the model has loaded. `<garden-particle part>`, `<garden-material part>`
     * and `<garden-animation part>` find their parts with it.
     */
    getPart(name: string): AbstractMesh | null {
        if (!name)
            return null;
        let lower = name.toLowerCase();
        return this.loadedMeshes.find(m => m.name == name && !m.isDisposed())
            ?? this.loadedMeshes.find(m => m.name.toLowerCase() == lower && !m.isDisposed())
            ?? null;
    }

    /** Removed for good: the loaded meshes, skeletons and animations go; added back, it loads again. */
    protected dispose() {
        // getScene() walks parentElement, which is gone by now.
        if (this.motionObserver) this.nearScene?.onBeforeRenderObservable.remove(this.motionObserver);
        this.motionObserver = null;
        if (this.nearObserver) this.nearScene?.onBeforeRenderObservable.remove(this.nearObserver);
        this.nearObserver = null;
        this.disposeLoaded();
        this.loadedKey = null;
        super.dispose();
    }

    private disposeLoaded() {
        // The mixer first: a disposed group fires its end, which isn't a one-shot ending.
        this._mixer?.dispose();
        this._mixer = null;
        this.rootController?.dispose();
        this.rootController = null;
        for (let clip of this.rootClips.values()) clip.dispose();
        this.rootClips.clear();
        this.rootMotionApplied = false;
        for (let group of this.animationGroups) group.dispose();
        this.animationGroups = [];
        this.clipGroups.clear();
        this.clipsBuilt = false;
        this.loadedHolder = null;
        this.playedAnimation = this.playedWeights = undefined;
        for (let mesh of this.loadedMeshes) if (!mesh.isDisposed()) mesh.dispose(false, true);
        this.loadedMeshes = [];
        this.skeleton?.dispose();
        this.skeleton = null;
    }

    private async load() {
        let scene = this.getScene();
        let key = this.loadedKey;
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
            let ext = this.extension?.trim();
            result = await SceneLoader.ImportMeshAsync(names, root, file, scene, progress,
                ext ? (ext.startsWith(".") ? ext : "." + ext).toLowerCase() : undefined);
        } catch (error) {
            console.error(`<garden-mesh-model> couldn't load ${root}${file}`, error);
            this.dispatchEvent(new CustomEvent("garden-model-error", { bubbles: true, detail: { error } }));
            return;
        } finally {
            if (screen && --GardenMeshModel.loading == 0)
                engine.hideLoadingUI();
        }

        // Removed for good (or asked for another model) while loading: this one isn't wanted.
        if (this.loadedKey != key) {
            for (let group of result.animationGroups) group.dispose();
            for (let mesh of result.meshes) if (!mesh.parent) mesh.dispose(false, true);
            for (let skeleton of result.skeletons) skeleton.dispose();
            return;
        }

        if (this.motionObserver) scene.onBeforeRenderObservable.remove(this.motionObserver);
        this.motionObserver = null;
        this.disposeLoaded();
        this.animationGroups = result.animationGroups;
        // A .babylon file keeps its moves as named ranges of the skeleton's own animation.
        this.fromRanges = !this.animationGroups.length;
        if (this.fromRanges)
            this.animationGroups = skeletonRangeClips(result.skeletons);
        this.loadedMeshes = result.meshes;

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

        if (result.skeletons.length > 0)
            this.skeleton = result.skeletons[0];

        // <garden-clip> children: more animations, cut from these or retargeted from other files.
        this.loadedHolder = holder;
        await GardenElement.whenDocumentReady();
        for (let clip of Array.from(this.children).filter(c => c.localName == "garden-clip") as GardenClip[]) {
            let group = await clip.build(this, holder, this.ownGroups());
            if (this.loadedKey != key) {
                group?.dispose();
                return;
            }
            if (group) this.addClipGroup(clip, group);
        }
        this.clipsBuilt = true;

        this.applyAnimations(0);
        this.applyRootMotion();

        if (this.getAttribute("materials") == "standard")
            toStandardMaterials(result.meshes, scene);

        this.setMesh(holder);
        this.applyTransform();

        let anim = (name: string) => this.getAttribute("anim-" + name);
        if (this.mixer && (anim("idle") || anim("walk") || anim("run"))) {
            this.nearScene = scene;
            // "auto": the clip's own speed (its root motion), in the scene's units.
            let num = (name: string, clip: string, fallback: number) => {
                let value = this.getAttribute(name);
                if (value?.trim() == "auto") {
                    holder.computeWorldMatrix(true);
                    let speed = (this.rootMotionOf(clip)?.speed ?? 0) * holder.absoluteScaling.x;
                    return speed > 0 ? speed : fallback;
                }
                return value != null ? Number(value) : fallback;
            };
            this.motionObserver = driveByMotion(this.mixer, scene, holder, {
                idle: anim("idle"), walk: anim("walk"), run: anim("run"),
                walkSpeed: num("anim-walk-speed", anim("walk"), 1.5), runSpeed: num("anim-run-speed", anim("run"), 4),
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
