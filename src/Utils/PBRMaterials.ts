import { Material } from "@babylonjs/core/Materials/material";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";

/** One material made or tuned by {@link toPBRMaterials}. */
export interface PBRSwappedMaterial {
    mesh: AbstractMesh;
    material: PBRMaterial;
    /** The material it replaced (a glTF model's PBR materials are tuned in place: then the same one). */
    source: Material;
}

/** How {@link toPBRMaterials} sets materials up. */
export interface PBRMaterialOptions {
    /**
     * Roughness for surfaces without a roughness map, 0 (mirror) to 1 (chalk): a number, or a
     * function of the source material's name (skin a little shinier than cloth, say). glTF
     * models are often exported at 0.5, which reads as plastic. Default: left as the file has it
     * for PBR sources, 0.9 for others.
     */
    roughness?: number | ((name: string) => number | undefined);
    /** Metalness for surfaces without a metal map. Default 0 (not metal). */
    metallic?: number;
    /** How strongly the scene's image-based lighting lights it. Default 1. */
    environmentIntensity?: number;
    /** The alpha test for textures with alpha (hair strands, leaves). Default 0.4. */
    alphaCutOff?: number;
    /** Default 8 (a carried light, a lamp, the sky and a flash of lightning at once). */
    maxLights?: number;
    /** StandardMaterial sources only: their colours are already linear (glTF's). Default false. */
    linearColours?: boolean;
    /**
     * `false` switches off the meshes' vertex colours (`mesh.useVertexColors`). Modelling tools
     * export white vertex colours nothing uses, and a material compiles a second shader for the
     * meshes that have them (see {@link "Utils/Precompile"!precompile}). Default: left as they are.
     */
    vertexColours?: boolean;
}

/**
 * The photo-real counterpart of {@link "Utils/StandardMaterials"!toStandardMaterials}: gives a model physically based
 * materials that light properly under image-based lighting (`scene.environmentTexture`, for
 * example a `.env` made from an HDR sky) and real lights.
 *
 * - glTF (PBR) materials are kept and tuned in place: a believable roughness where the file
 *   has none (exporters' default 0.5 looks like plastic), metalness off, more lights.
 * - StandardMaterials (code-built props, older models) become PBRMaterials with the same
 *   colour, colour texture, normal map, emissive colour and alpha.
 *
 * Textures with alpha cut out (alpha test) rather than blend, double-sided, as in
 * toStandardMaterials. Returns what it made or tuned, once per mesh, so a game can adjust
 * them by what they were for.
 *
 * @example
 * ```ts
 * scene.environmentTexture = CubeTexture.CreateFromPrefilteredData("sky.env", scene);
 * for (const { material, source } of toPBRMaterials(meshes, scene, { roughness: n => /skin/i.test(n) ? 0.55 : 0.85 }))
 *     if (/hair/i.test(source.name)) material.albedoColor = new Color3(0.2, 0.13, 0.09);
 * ```
 *
 * @category Utilities
 */
export function toPBRMaterials(meshes: AbstractMesh[], scene: Scene, options: PBRMaterialOptions = {}): PBRSwappedMaterial[] {
    let swapped: PBRSwappedMaterial[] = [];
    let made = new Map<Material, PBRMaterial>();
    let roughFor = (name: string, fallback: number | null) => {
        let r = typeof options.roughness == "function" ? options.roughness(name) : options.roughness;
        return r ?? fallback;
    };
    for (let mesh of meshes) {
        if (options.vertexColours === false) mesh.useVertexColors = false;
        let source = mesh.material;
        if (!source) continue;
        let material = made.get(source);
        if (!material) {
            if (source instanceof PBRMaterial) {
                material = source;
                if (!material.metallicTexture) {
                    let r = roughFor(source.name, material.roughness ?? 0.9);
                    material.roughness = r;
                    material.metallic = options.metallic ?? 0;
                }
            } else if (source instanceof StandardMaterial) {
                material = fromStandard(source, scene, options);
                material.roughness = roughFor(source.name, 0.9);
                material.metallic = options.metallic ?? 0;
            } else {
                continue;
            }
            material.maxSimultaneousLights = options.maxLights ?? 8;
            if (options.environmentIntensity != null) material.environmentIntensity = options.environmentIntensity;
            if ((material.albedoTexture as Texture)?.hasAlpha && material.transparencyMode != Material.MATERIAL_ALPHABLEND) {
                material.useAlphaFromAlbedoTexture = true;
                material.transparencyMode = Material.MATERIAL_ALPHATEST;
                material.alphaCutOff = options.alphaCutOff ?? 0.4;
                material.backFaceCulling = false;
                material.twoSidedLighting = true;
            }
            made.set(source, material);
        }
        mesh.material = material;
        swapped.push({ mesh, material, source });
    }
    return swapped;
}

function fromStandard(source: StandardMaterial, scene: Scene, options: PBRMaterialOptions): PBRMaterial {
    let m = new PBRMaterial(`${source.name}-pbr`, scene);
    m.albedoTexture = source.diffuseTexture;
    let c = source.diffuseColor;
    // StandardMaterial colours are gamma-space; PBR's are linear.
    m.albedoColor = source.diffuseTexture || options.linearColours ? c.clone() : c.toLinearSpace();
    m.bumpTexture = source.bumpTexture;
    m.emissiveColor = source.disableLighting ? source.emissiveColor.add(c).toLinearSpace() : source.emissiveColor.toLinearSpace();
    if (source.disableLighting) m.unlit = true;
    m.emissiveTexture = source.emissiveTexture;
    m.alpha = source.alpha;
    m.backFaceCulling = source.backFaceCulling;
    m.twoSidedLighting = source.twoSidedLighting;
    m.transparencyMode = source.transparencyMode;
    m.alphaCutOff = source.alphaCutOff;
    m.useAlphaFromAlbedoTexture = source.useAlphaFromDiffuseTexture;
    m.fogEnabled = source.fogEnabled;
    m.disableDepthWrite = source.disableDepthWrite;
    return m;
}

/** How {@link pbrTexturedMaterial} builds a surface. */
export interface PBRTexturedOptions {
    /** The normal map (OpenGL: green up). */
    normal?: string;
    /** Ambient occlusion in red, roughness in green (and height in blue, unused here). */
    arh?: string;
    /** How many times it repeats across and up. Default 1 and the same. */
    uTiles?: number;
    vTiles?: number;
    /** Roughness without an `arh` map. Default 0.9. */
    roughness?: number;
}

/**
 * A photo-scanned surface as a PBRMaterial: the colour map, the normal map, and a map of
 * ambient occlusion (red) and roughness (green), repeating `uTiles` × `vTiles` -- the PBR
 * counterpart of {@link "Nature/Rocks"!texturedMaterial}, for rocks, walls and bark.
 *
 * @category Nature
 */
export function pbrTexturedMaterial(scene: Scene, name: string, colour: string, options: PBRTexturedOptions = {}): PBRMaterial {
    let m = new PBRMaterial(name, scene);
    let tile = (t: Texture) => {
        t.uScale = options.uTiles ?? 1;
        t.vScale = options.vTiles ?? options.uTiles ?? 1;
        t.anisotropicFilteringLevel = 8;
        return t;
    };
    m.albedoTexture = tile(new Texture(colour, scene));
    if (options.normal) m.bumpTexture = tile(new Texture(options.normal, scene));
    m.metallic = 0;
    m.roughness = options.arh ? 1 : options.roughness ?? 0.9;
    if (options.arh) {
        let arh = tile(new Texture(options.arh, scene));
        arh.gammaSpace = false;
        // Roughness from green; ambient occlusion from red (metalness stays 0).
        m.metallicTexture = arh;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useRoughnessFromMetallicTextureAlpha = false;
        m.useMetallnessFromMetallicTextureBlue = false;
        m.useAmbientOcclusionFromMetallicTextureRed = true;
        m.metallic = 0;
    }
    m.albedoColor = Color3.White();
    m.maxSimultaneousLights = 8;
    return m;
}
