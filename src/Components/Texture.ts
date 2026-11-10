import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
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
 * (degrees), `u-scale`/`v-scale` (repeat count across the mesh face), `size` (the picture's
 * real size in metres, across and up, `"1.5 1"`, one number for both: the repeat is worked out
 * from the mesh that wears it, so bricks are the same size on a short wall and a long one,
 * whatever the mesh's own UV layout; it wins over `u-scale`/`v-scale`),
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
    // Degrees to turn the picture on a plain mesh, about its middle. Separate from `rotation`,
    // which only a dome reads (it bakes that into its own UVs): `turn` leaves a dome alone, and unset
    // changes nothing. For a face whose mesh lays the picture sideways: Babylon's box does on its x faces.
    @property({ type: Number }) turn: number;
    // The picture's real size in metres, across and up: see the class comment and fitToSize.
    @property() size: string;

    @property() sampling: string;
    @property() wrap: string;

    texture: Texture;
    private sizing?: { scene: Scene; observer: Observer<Scene> };

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
        if (this.turn)
            texture.wAng = this.turn * Math.PI / 180;
        this.fitToSize(texture);
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

    /** `size` as metres across and up, or null when unset or not one or two numbers above 0. */
    static parseSize(size: string | null | undefined): { across: number; up: number } | null {
        let parts = (size ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (parts.length < 1 || parts.length > 2 || parts.some(n => !isFinite(n) || n <= 0))
            return null;
        return { across: parts[0], up: parts[parts.length - 1] };
    }

    /**
     * Metres per unit of UV along u and along v, over the triangles of `subMesh` (all of `mesh`'s
     * when none), in world space: a box face's UVs run 0..1 over the face, a polygon wall's run one
     * per metre, a swept wall's 0..1 along its whole path. The area-weighted median, not the mean:
     * a wall's thin top and ends (and a dome's steep rim) lay the picture very differently from the
     * faces people look at, and they mustn't pull the answer. Null when the mesh has no UVs or no
     * triangle with any area.
     */
    static metresPerUv(mesh: AbstractMesh, subMesh?: SubMesh): { u: number; v: number } | null {
        let positions = mesh.getVerticesData(VertexBuffer.PositionKind), uvs = mesh.getVerticesData(VertexBuffer.UVKind), indices = mesh.getIndices();
        if (!positions || !uvs || !indices)
            return null;
        let world = mesh.computeWorldMatrix(true);
        let at = (i: number) => Vector3.TransformCoordinates(new Vector3(positions![i * 3], positions![i * 3 + 1], positions![i * 3 + 2]), world);
        let start = subMesh?.indexStart ?? 0, end = start + (subMesh?.indexCount ?? indices.length);
        let faces: { u: number; v: number; w: number }[] = [];
        for (let t = start; t + 2 < end; t += 3) {
            let [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
            let p0 = at(a), e1 = at(b).subtract(p0), e2 = at(c).subtract(p0);
            let du1 = uvs[b * 2] - uvs[a * 2], dv1 = uvs[b * 2 + 1] - uvs[a * 2 + 1];
            let du2 = uvs[c * 2] - uvs[a * 2], dv2 = uvs[c * 2 + 1] - uvs[a * 2 + 1];
            let det = du1 * dv2 - du2 * dv1, w = Vector3.Cross(e1, e2).length() / 2;
            if (Math.abs(det) < 1e-9 || w < 1e-9)
                continue;
            // How far the surface moves for one unit of u, and of v (the inverse of the UV Jacobian).
            let dPdu = e1.scale(dv2).subtract(e2.scale(dv1)).scale(1 / det);
            let dPdv = e2.scale(du1).subtract(e1.scale(du2)).scale(1 / det);
            faces.push({ u: dPdu.length(), v: dPdv.length(), w });
        }
        if (!faces.length)
            return null;
        let median = (key: "u" | "v") => {
            let sorted = [...faces].sort((a, b) => a[key] - b[key]), half = sorted.reduce((sum, f) => sum + f.w, 0) / 2, run = 0;
            for (let f of sorted)
                if ((run += f.w) >= half)
                    return f[key];
            return sorted[sorted.length - 1][key];
        };
        return { u: median("u"), v: median("v") };
    }

    /**
     * With `size`, sets the repeat from the first mesh found wearing `texture` (or the submesh whose
     * material does, in a multi-material room), measured as {@link metresPerUv}: a box face 4 m wide
     * with a 1.5 m picture repeats it 4 / 1.5 times; a polygon wall, laid in metres, 1 / 1.5 times per
     * unit. Babylon scales the mesh's own u and v before it turns the picture, so with `turn` a
     * quarter (90 or 270), the picture's across runs along v and its up along u. Looked for each
     * frame until a mesh has it, for at most 600 frames (a room builds after its texture).
     */
    private fitToSize(texture: Texture) {
        if (this.sizing) {
            this.sizing.scene.onBeforeRenderObservable.remove(this.sizing.observer);
            this.sizing = undefined;
        }
        let size = GardenTexture.parseSize(this.size), scene = this.getScene();
        if (!size || !scene)
            return;
        let quarter = Math.round(((this.turn ?? 0) % 180 + 180) % 180) == 90;
        let wears = (material: any) => !!material && GardenTexture.slots.some(type => material[type + "Texture"] == texture);
        let frames = 0;
        let observer = scene.onBeforeRenderObservable.add(() => {
            let found: { u: number; v: number } | null = null;
            for (let mesh of scene.meshes) {
                let material: any = mesh.material;
                if (!material || mesh.isDisposed())
                    continue;
                if (material.subMaterials)
                    for (let sub of mesh.subMeshes ?? []) {
                        if (wears(material.subMaterials[sub.materialIndex]) && (found = GardenTexture.metresPerUv(mesh, sub)))
                            break;
                    }
                else if (wears(material))
                    found = GardenTexture.metresPerUv(mesh);
                if (found)
                    break;
            }
            if (found) {
                texture.uScale = found.u / (quarter ? size!.up : size!.across);
                texture.vScale = found.v / (quarter ? size!.across : size!.up);
            }
            if (found || ++frames >= 600) {
                scene.onBeforeRenderObservable.remove(observer);
                if (this.sizing?.observer == observer)
                    this.sizing = undefined;
            }
        });
        this.sizing = { scene, observer };
    }
}
