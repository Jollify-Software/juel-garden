import { Texture, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";

/**
 * A single texture slot on a <garden-material> parent, e.g.
 * <garden-material slot="inside"><garden-texture src="fresco.jpg" center="0.5 0.4" rotation="90"></garden-texture></garden-material>.
 * Builds a plain Babylon Texture from its own attributes -- it doesn't touch any mesh
 * or material itself, `<garden-material>` reads `.texture` (keyed by `.type`) once this
 * element is built. `center`/`rotation` are exposed as raw values (not applied to the
 * Texture automatically) for a parent mesh that needs to bake them into custom UVs
 * itself -- see GardenRoof's dome, which can't rely on Babylon's default per-mesh UVs.
 *
 * Attributes: `type` (which slot on the parent `<garden-material>` this fills,
 * default `"diffuse"`), `src`, `center` (a `Vector2`-ish offset), `rotation`
 * (degrees), `u-scale`/`v-scale` (repeat count across the mesh face).
 *
 * @category Components
 */
@customElement("garden-texture")
export class GardenTexture extends GardenElement {
    @property() type: string;
    @property() src: string;
    @property({ converter: Vector3Convert.fromString }) center: Vector3;
    // Named `angle` (not `rotation`) -- GardenElement already declares `rotation: Vector3`
    // for positioning this element's own (unused, textures have no node) transform.
    @property({ attribute: "rotation", type: Number }) angle: number;
    // How many times the image repeats across its mesh face, e.g. a small brick-tile
    // photo meant to repeat several times over a wall rather than stretch once across
    // it. Left at Babylon's own default (1, no repeat) when unset.
    @property({ type: Number, attribute: "u-scale" }) uScale: number;
    @property({ type: Number, attribute: "v-scale" }) vScale: number;

    texture: Texture;

    get centerU(): number {
        return this.center?.x ?? 0.5;
    }
    get centerV(): number {
        return this.center?.y ?? 0.5;
    }
    get rotationRadians(): number {
        return (this.angle ?? 0) * Math.PI / 180;
    }

    updated() {
        let texture = new Texture(this.src, this.getScene());
        if (this.uScale)
            texture.uScale = this.uScale;
        if (this.vScale)
            texture.vScale = this.vScale;
        this.texture = texture;
    }
}
