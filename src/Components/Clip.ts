import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { AnimatorAvatar, IRetargetOptions } from "@babylonjs/core/Animations/animatorAvatar";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { customElement, property } from "lit/decorators.js";
import { skeletonClip } from "../AnimationMixer";
import { GardenElement } from "../GardenElement";
import type { GardenMeshModel } from "./MeshModel";

/**
 * One more named animation for the `<garden-mesh-model>` it is in, played by its `name`
 * like the model's own (`play`, `weights`, `play()`):
 *
 * - **cut by frame** from the model's own animation: a `.babylon` or GLB that keeps all its
 *   moves in one long take (`from="90" to="118"`);
 * - **retargeted** from another file (`src`): an animation made for another character with
 *   the same bone names (Mixamo's animations onto any Mixamo character), moved onto this
 *   model's skeleton with Babylon's `AnimatorAvatar`. A game can keep one file per move and
 *   share them across its characters.
 *
 * Attributes:
 * - `name` -- what the model calls it (required).
 * - `from`, `to` -- the frames to keep. Without `src`, cut from the model's own animation
 *   (`group` names which, default the first; a `.babylon` file's bone animations if it has none).
 * - `src` -- a glTF/GLB (or `.babylon`) whose animation is retargeted onto the model; `group`
 *   picks it by name (default the first), `extension` as on the model.
 * - Retargeting, as Babylon's `IRetargetOptions`: `ground-reference` (a foot bone, e.g.
 *   `mixamorig:LeftToe_End`), `fix-ground-reference` (keep the feet on the ground),
 *   `fix-root-position="false"` (don't scale the root's motion to the model's size),
 *   `root-node` (the hips, if not the first bone), `map="from:to, ..."` (bone names that differ).
 *
 * Changing any of them later builds the clip again; removing it takes it from the model.
 * `element.group` is the Babylon `AnimationGroup`.
 *
 * @example
 * ```html
 * <garden-mesh-model src="ch14.glb" play="dance">
 *   <garden-clip name="dance" src="hip-hop-dancing.glb" ground-reference="mixamorig:LeftToe_End"></garden-clip>
 * </garden-mesh-model>
 * <garden-mesh-model src="dummy.babylon" play="idle">
 *   <garden-clip name="idle" from="0" to="89"></garden-clip>
 *   <garden-clip name="walk" from="90" to="118"></garden-clip>
 * </garden-mesh-model>
 * ```
 *
 * @category Components
 */
@customElement("garden-clip")
export class GardenClip extends GardenElement {
    @property() name: string;
    @property() src: string;
    @property() group: string;
    @property({ type: Number }) from: number;
    @property({ type: Number }) to: number;

    /** The animation group it made, once its model has loaded. */
    animationGroup: AnimationGroup;

    /** The model it was built for (its parent then; it may be gone by the time it's disposed). */
    private model: GardenMeshModel;

    /** Its model builds it as it loads; a change afterwards builds it again. */
    protected get handlesChanges() {
        return true;
    }

    updated() {
        // No node of its own: it only describes an animation.
        let model = this.parentElement as GardenMeshModel;
        if (model?.localName == "garden-mesh-model" && model.clipsBuilt)
            model.rebuildClip(this);
    }

    protected dispose() {
        this.model?.removeClip(this);
        this.model = null;
        super.dispose();
    }

    /**
     * Makes the animation group for `model`, whose loaded meshes hang under `holder`, from
     * `own` (the model's own animations). Null (with a warning) if it can't.
     */
    async build(model: GardenMeshModel, holder: TransformNode, own: AnimationGroup[]): Promise<AnimationGroup> {
        this.model = model;
        let name = this.name?.trim();
        if (!name) {
            console.warn("<garden-clip> needs a name.");
            return null;
        }
        let cut = this.from != null && this.to != null && !isNaN(this.from) && !isNaN(this.to);
        let group: AnimationGroup = null;
        if (this.src) {
            group = await this.retarget(name, holder);
            if (group && cut)
                AnimationGroup.ClipFramesInPlace(group, this.from, this.to);
        } else if (cut) {
            // A .babylon file's ranges are cuts of one take: without `group`, cut from the whole take.
            let source = this.group || !model.fromRanges ? this.pick(own) : null;
            if (source)
                group = AnimationGroup.ClipFrames(source, this.from, this.to, name);
            else if (model.skeleton)
                group = skeletonClip(name, model.skeleton, this.from, this.to);
            else
                console.warn(`<garden-clip name="${name}">: the model has no animation to cut it from.`);
        } else {
            console.warn(`<garden-clip name="${name}"> needs a src, or from and to.`);
        }
        if (group)
            group.name = name;
        this.animationGroup = group;
        return group;
    }

    /** The group named by `group` (any case), or the first. */
    private pick(groups: AnimationGroup[]): AnimationGroup {
        let wanted = this.group?.toLowerCase();
        let found = wanted ? groups.find(g => g.name.toLowerCase() == wanted) : groups[0];
        if (wanted && !found)
            console.warn(`<garden-clip>: no animation "${this.group}"; there are: ${groups.map(g => g.name).join(", ")}`);
        return found ?? null;
    }

    /** Loads `src` beside the scene (not into it), and moves its animation onto the model's bones. */
    private async retarget(name: string, holder: TransformNode): Promise<AnimationGroup> {
        let scene = holder.getScene();
        let url = this.src;
        let slash = url.split(/[?#]/)[0].lastIndexOf("/");
        let [root, file] = /^(data|blob):/.test(url) || slash < 0 ? ["", url] : [url.substring(0, slash + 1), url.substring(slash + 1)];
        let ext = this.getAttribute("extension")?.trim();
        let container;
        try {
            container = await SceneLoader.LoadAssetContainerAsync(root, file, scene, null,
                ext ? (ext.startsWith(".") ? ext : "." + ext).toLowerCase() : undefined);
        } catch (error) {
            console.error(`<garden-clip> couldn't load ${url}`, error);
            return null;
        }
        try {
            let source = this.pick(container.animationGroups);
            if (!source) {
                console.warn(`<garden-clip name="${name}">: ${url} has no animation.`);
                return null;
            }
            let options: IRetargetOptions = {
                animationGroupName: name,
                fixRootPosition: this.getAttribute("fix-root-position") != "false",
                fixGroundReference: this.flag("fix-ground-reference"),
                fixAnimations: this.flag("fix-animations"),
            };
            let ground = this.getAttribute("ground-reference");
            if (ground) options.groundReferenceNodeName = ground;
            let rootNode = this.getAttribute("root-node");
            if (rootNode) options.rootNodeName = rootNode;
            let map = this.getAttribute("map");
            if (map) {
                options.mapNodeNames = new Map(map.split(",").map(pair => pair.split(":").map(s => s.trim()) as [string, string])
                    .filter(([a, b]) => a && b));
            }
            // The holder's own name stays; resources stay with the model.
            let avatar = new AnimatorAvatar(name, holder, false, false);
            // Bones the clip has and the model hasn't (finger tips) are just left out.
            avatar.showWarnings = false;
            let group = avatar.retargetAnimationGroup(source, options);
            avatar.dispose();
            return group;
        } finally {
            container.dispose();
        }
    }

    private flag(name: string): boolean {
        return this.hasAttribute(name) && this.getAttribute(name) != "false";
    }
}
