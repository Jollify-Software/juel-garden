import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";

/** One material swapped by {@link toStandardMaterials}. */
export interface SwappedMaterial {
    mesh: AbstractMesh;
    material: StandardMaterial;
    /** The glTF material it replaced (its `name` says what it was for: skin, hair…). */
    source: Material;
}

/**
 * Swaps a model's glTF (PBR) materials for StandardMaterials that light like the rest of a
 * simple scene. PBR materials need an environment map (`scene.environmentTexture`) to look
 * right; without one a model comes out dark and flat. Keeps the base colour and its texture
 * and the normal map; gives a faint specular; and makes textures with alpha (hair strands,
 * eyelashes, leaves) cut out (alpha test) rather than blend, double-sided. Returns what it
 * swapped, so a game can colour them by what they were for (meshes that shared a material
 * share the new one, listed once per mesh).
 *
 * `<garden-mesh-model materials="standard">` does this when the model loads.
 *
 * @category Utilities
 */
export function toStandardMaterials(meshes: AbstractMesh[], scene: Scene,
    options: { specular?: number, alphaCutOff?: number, maxLights?: number, linearColours?: boolean } = {}): SwappedMaterial[] {
    let swapped: SwappedMaterial[] = [];
    let made = new Map<Material, StandardMaterial>();
    for (let mesh of meshes) {
        let source = mesh.material;
        if (!source || source instanceof StandardMaterial) continue;
        let material = made.get(source);
        if (!material) {
            let pbr = source as unknown as { albedoTexture?: Texture, bumpTexture?: Texture, albedoColor?: Color3 };
            material = new StandardMaterial(`${source.name}-standard`, scene);
            material.diffuseTexture = pbr.albedoTexture ?? null;
            // glTF base colours are linear; StandardMaterial's are not (`linearColours` keeps them as they are).
            if (pbr.albedoColor) material.diffuseColor = pbr.albedoTexture || options.linearColours ? pbr.albedoColor.clone() : pbr.albedoColor.toGammaSpace();
            material.bumpTexture = pbr.bumpTexture ?? null;
            let s = options.specular ?? 0.05;
            material.specularColor = new Color3(s, s, s);
            material.maxSimultaneousLights = options.maxLights ?? 8;
            if (material.diffuseTexture?.hasAlpha) {
                material.useAlphaFromDiffuseTexture = true;
                material.transparencyMode = Material.MATERIAL_ALPHATEST;
                material.alphaCutOff = options.alphaCutOff ?? 0.4;
                material.backFaceCulling = false;
            }
            made.set(source, material);
        }
        mesh.material = material;
        swapped.push({ mesh, material, source });
    }
    return swapped;
}
