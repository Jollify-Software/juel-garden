import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
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
 * (degrees), `u-scale`/`v-scale` (repeat count across the mesh face),
 * `sampling` (`nearest` for crisp texels -- pixel art, or a lookup table a shader
 * reads -- `bilinear`, or `trilinear`, Babylon's default), `wrap` (`repeat`, the
 * default, `clamp` or `mirror`; two words for u and v), `mipmaps="false"`,
 * `invert-y="false"` (the image the right way up for a glTF-style UV layout, or a
 * lookup table). `uniform` (instead of `type`) gives it to a shader material's
 * sampler of that name.
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

    @property() sampling: string;
    @property() wrap: string;

    texture: Texture;

    /** Babylon's sampling modes and address modes by name. */
    private static samplingModes: { [name: string]: number } = {
        nearest: Texture.NEAREST_SAMPLINGMODE, bilinear: Texture.BILINEAR_SAMPLINGMODE, trilinear: Texture.TRILINEAR_SAMPLINGMODE,
    };
    private static wrapModes: { [name: string]: number } = {
        repeat: Texture.WRAP_ADDRESSMODE, clamp: Texture.CLAMP_ADDRESSMODE, mirror: Texture.MIRROR_ADDRESSMODE,
    };

    get centerU(): number {
        return this.center?.x ?? 0.5;
    }
    get centerV(): number {
        return this.center?.y ?? 0.5;
    }
    get rotationRadians(): number {
        return (this.angle ?? 0) * Math.PI / 180;
    }

    /** The material slots a `type` names (`diffuse` -> `diffuseTexture`). */
    private static slots = ["diffuse", "bump", "reflection", "emissive", "specular", "opacity", "ambient", "lightmap", "refraction"];

    /** Textures a `<garden-texture>` built: disposing a mesh's own material leaves them alone. */
    static owned = new WeakSet<object>();

    updated() {
        let sampling = GardenTexture.samplingModes[(this.sampling ?? "").trim().toLowerCase()] ?? Texture.TRILINEAR_SAMPLINGMODE;
        let texture = new Texture(this.src, this.getScene(), this.getAttribute("mipmaps") == "false",
            this.getAttribute("invert-y") != "false", sampling);
        GardenTexture.owned.add(texture);
        if (this.wrap) {
            let [u, v = u] = this.wrap.trim().toLowerCase().split(/[\s,]+/).map(w => GardenTexture.wrapModes[w] ?? Texture.WRAP_ADDRESSMODE);
            texture.wrapU = u;
            texture.wrapV = v;
        }
        if (this.uScale)
            texture.uScale = this.uScale;
        if (this.vScale)
            texture.vScale = this.vScale;
        // Rebuilt for a change: every material slot holding the old texture gets this one.
        let old = this.texture;
        this.texture = texture;
        if (old && old != texture) {
            for (let material of this.getScene()?.materials ?? [])
                for (let type of GardenTexture.slots)
                    if (material[type + "Texture"] == old)
                        material[type + "Texture"] = texture;
            old.dispose();
        }
    }
}
