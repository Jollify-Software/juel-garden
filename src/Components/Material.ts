import { Color3, StandardMaterial } from "babylonjs";
import { customElement, property } from "lit/decorators";
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
 */
@customElement("garden-material")
export class GardenMaterial extends GardenElement {
    @property() slot: string;
    @property({ converter: colourConverter }) colour: Color3;
    @property({ attribute: "spec-colour", converter: colourConverter }) specColour: Color3;
    @property({ attribute: "emissive-colour", converter: colourConverter }) emissiveColour: Color3;

    material: StandardMaterial;

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

        let material = new StandardMaterial("material", this.getScene());
        if (this.colour)
            material.diffuseColor = this.colour;
        if (this.specColour)
            material.specularColor = this.specColour;
        if (this.emissiveColour)
            material.emissiveColor = this.emissiveColour;

        for (let textureEl of this.getTextures())
            material[`${textureEl.type ?? "diffuse"}Texture`] = textureEl.texture;

        this.material = material;
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
