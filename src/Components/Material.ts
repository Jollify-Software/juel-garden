import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { customElement, property } from "lit/decorators.js";
import { Color3Convert } from "../Converters/Color3Convert";
import { GardenElement } from "../GardenElement";
import { GardenTexture } from "./Texture";

const colourConverter = {
    fromAttribute(value: string): Color3 {
        if (!value) return null;
        return value.startsWith('#') ? Color3.FromHexString(value) : Color3Convert.fromString(value);
    }
};

/**
 * A material, declared as a child element instead of a flat attribute soup on its
 * parent -- e.g. <garden-room><garden-material colour="red"><garden-texture src="wall.jpg">
 * </garden-texture></garden-material></garden-room>. Builds a StandardMaterial from its
 * own colour attributes plus any <garden-texture> children (keyed by their `type`,
 * defaulting to "diffuse"), and exposes it as `.material` for a parent to pick up.
 *
 * Doesn't push itself onto its parent -- GardenMesh pulls in a single unslotted
 * <garden-material> child generically (see GardenMesh.modifyMesh), the same way it
 * already pulls in <garden-particle>/<garden-animation> children. A mesh with more than
 * one material (like GardenRoof's dome, with separate outside/inside shells) instead
 * reads specific `slot`-tagged children itself, before building -- see GardenRoof.
 *
 * Attributes: `slot` (which named material slot this fills, on elements like
 * `<garden-roof>`/`<garden-room>` that have more than one), `colour`,
 * `spec-colour`, `emissive-colour`, `opacity` (0 clear to 1 solid: below 1
 * the material is see-through and both faces draw -- glass, water, a
 * glazed roof), `node` (a node material instead -- the Node Material Editor's
 * output, as a JSON file's URL or `#ID` on Babylon's snippet server: shaders,
 * water, anti-tiling grounds, effects; a `<garden-texture block="name">` child
 * fills its texture block of that name (and then the textures saved in it aren't
 * loaded), and `input-<name>="value"` sets its input block of that name: a
 * number, or 2–4 numbers for a vector or colour).
 *
 * @example
 * ```html
 * <garden-room>
 *   <garden-material slot="north" colour="red">
 *     <garden-texture src="wall.jpg"></garden-texture>
 *   </garden-material>
 * </garden-room>
 * ```
 *
 * @category Components
 */
@customElement("garden-material")
export class GardenMaterial extends GardenElement {
    @property() slot: string;
    @property({ converter: colourConverter }) colour: Color3;
    @property({ attribute: "spec-colour", converter: colourConverter }) specColour: Color3;
    @property({ attribute: "emissive-colour", converter: colourConverter }) emissiveColour: Color3;
    @property({ type: Number }) opacity: number;
    /** A node material instead: a JSON file's URL, or `#ID` for one on Babylon's snippet server. */
    @property({ attribute: "node" }) nodeSource: string;

    material: StandardMaterial;

    /** Materials a `<garden-material>` built: a mesh's rebuild or removal leaves them alone. */
    static owned = new WeakSet<object>();

    async updated() {
        // beginBuild()/endBuild() make `whenReady` a real signal even though this build is
        // synchronous -- a parent (e.g. GardenRoof's dome, which needs each material *before*
        // building its own mesh) can't otherwise tell "not built yet" from "no work to do",
        // since whenReady defaults to an already-resolved promise until the first build runs.
        this.beginBuild();
        // Needed before reading any <garden-texture> child's built `.texture` below -- see
        // GardenElement.whenDocumentReady for why a child's own updated() isn't otherwise
        // guaranteed to have run yet.
        await GardenMaterial.whenDocumentReady();

        if (this.nodeSource) {
            await this.buildNode();
            return;
        }

        let material = new StandardMaterial("material", this.getScene());
        GardenMaterial.owned.add(material);
        if (this.colour)
            material.diffuseColor = this.colour;
        if (this.specColour)
            material.specularColor = this.specColour;
        if (this.emissiveColour)
            material.emissiveColor = this.emissiveColour;
        if (this.opacity != null && this.opacity < 1) {
            material.alpha = Math.max(0, this.opacity);
            // See-through: the far side shows, so draw back faces too.
            material.backFaceCulling = false;
        }

        for (let textureEl of this.getTextures())
            material[`${textureEl.type ?? "diffuse"}Texture`] = textureEl.texture;

        this.wear(material);
        this.endBuild();
    }

    /** Rebuilt for a change: whatever wore the old material wears this one. */
    private wear(material: any) {
        let old = this.material;
        this.material = material;
        if (old && old != material) {
            for (let mesh of old.getBindedMeshes())
                mesh.material = material;
            old.dispose(false, false); // the textures belong to their <garden-texture>s
        }
    }

    /**
     * `node`: a node material (Babylon's Node Material Editor's output) from a JSON
     * file or the snippet server, instead of the standard one. Its texture blocks load
     * the textures saved in it; `<garden-texture>` children and the colours don't apply.
     */
    private async buildNode() {
        let scene = this.getScene();
        let material: NodeMaterial;
        try {
            // Textures given as children replace the ones saved in it: don't load those.
            let blockTextures = this.getTextures().filter(t => t.hasAttribute("block"));
            let ignore = NodeMaterial.IgnoreTexturesAtLoadTime;
            NodeMaterial.IgnoreTexturesAtLoadTime = blockTextures.length > 0;
            try {
                if (this.nodeSource.startsWith("#")) {
                    material = await NodeMaterial.ParseFromSnippetAsync(this.nodeSource.slice(1), scene);
                } else {
                    let response = await fetch(this.nodeSource);
                    let json = await response.json();
                    let rootUrl = this.nodeSource.substring(0, this.nodeSource.lastIndexOf("/") + 1);
                    material = NodeMaterial.Parse(json, scene, rootUrl);
                }
            } finally {
                NodeMaterial.IgnoreTexturesAtLoadTime = ignore;
            }
            for (let t of blockTextures) {
                let block: any = material.getBlockByName(t.getAttribute("block"));
                if (block && "texture" in block) block.texture = t.texture;
                else console.warn(`<garden-material node>: no texture block "${t.getAttribute("block")}"`);
            }
            setNodeInputs(this, material, "<garden-material node>");
            material.build();
        } catch (e) {
            console.warn(`<garden-material> couldn't load the node material "${this.nodeSource}": ${e}`);
            this.endBuild();
            return;
        }
        GardenMaterial.owned.add(material);
        if (this.opacity != null && this.opacity < 1) {
            material.alpha = Math.max(0, this.opacity);
            material.backFaceCulling = false;
        }
        this.wear(material);
        this.endBuild();
    }

    /** Direct <garden-texture> children only -- not any nested inside a further child. */
    getTextures(): GardenTexture[] {
        return (<Element[]>Array.prototype.slice.call(this.children))
            .filter((el): el is GardenTexture => el.matches('garden-texture'));
    }

    getTexture(type: string = "diffuse"): GardenTexture | null {
        return this.getTextures().find(el => (el.type ?? "diffuse") === type) ?? null;
    }
}

/**
 * Sets a node material's or node geometry's input blocks from the element's
 * `input-<name>` attributes (the block's name, case as in the editor): one number,
 * or 2–4 for a vector or a colour, matched to the block's current value.
 */
export function setNodeInputs(el: HTMLElement, graph: { getBlockByName(name: string): any }, who: string) {
    for (let attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith("input-"))
            continue;
        let name = attr.name.slice("input-".length);
        // HTML lowercases attribute names: find the block whatever its case.
        let block = graph.getBlockByName(name)
            ?? (<any>graph).attachedBlocks?.find((b: any) => b.name?.toLowerCase() == name)
            ?? (<any>graph).getBlocks?.()?.find?.((b: any) => b.name?.toLowerCase() == name);
        if (!block || !("value" in block)) {
            console.warn(`${who}: no input block "${name}"`);
            continue;
        }
        let n = attr.value.trim().split(/[\s,]+/).map(Number);
        let current = block.value;
        if (n.length == 1 || typeof current == "number")
            block.value = n[0];
        else if (current?.clone && current.constructor) {
            let v = current.clone();
            ["x", "y", "z", "w"].forEach((k, i) => { if (k in v && i < n.length) v[k] = n[i]; });
            ["r", "g", "b", "a"].forEach((k, i) => { if (k in v && i < n.length) v[k] = n[i]; });
            block.value = v;
        }
    }
}
