import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { Scene } from "@babylonjs/core/scene";

/** One ground texture for {@link splatMaterial}. */
export interface SplatLayer {
    /** The colour texture's URL. */
    colour: string;
    /** Its normal map's URL. */
    normal: string;
    /** How many times it repeats across the ground. */
    tiles: number;
}

const SAMPLERS = ["splatD1", "splatN1", "splatD2", "splatN2", "splatD3", "splatN3"];

class SplatPlugin extends MaterialPluginBase {
    private textures: Texture[] = [];
    private tiles: number[];

    constructor(material: StandardMaterial, scene: Scene, layers: SplatLayer[]) {
        super(material, "GroundSplat", 200, { GROUNDSPLAT: false });
        for (let l of layers)
            for (let url of [l.colour, l.normal]) {
                let t = new Texture(url, scene);
                t.anisotropicFilteringLevel = 8;
                this.textures.push(t);
            }
        this.tiles = layers.map(l => l.tiles);
        this._enable(true);
    }

    getClassName() { return "GroundSplatPlugin"; }

    prepareDefines(defines: Record<string, unknown>) { defines.GROUNDSPLAT = true; }

    isReadyForSubMesh() { return this.textures.every(t => t.isReady()); }

    getSamplers(samplers: string[]) { samplers.push(...SAMPLERS); }

    getUniforms() {
        return { ubo: [{ name: "splatTile", size: 3, type: "vec3" }], fragment: "uniform vec3 splatTile;" };
    }

    bindForSubMesh(ubo: UniformBuffer) {
        ubo.updateFloat3("splatTile", this.tiles[0], this.tiles[1], this.tiles[2]);
        SAMPLERS.forEach((name, i) => ubo.setTexture(name, this.textures[i]));
    }

    getActiveTextures(active: Texture[]) { active.push(...this.textures); }

    getCustomCode(shaderType: string): Record<string, string> {
        if (shaderType != "fragment") return null;
        return {
            CUSTOM_FRAGMENT_DEFINITIONS: `
                uniform sampler2D splatD1; uniform sampler2D splatN1;
                uniform sampler2D splatD2; uniform sampler2D splatN2;
                uniform sampler2D splatD3; uniform sampler2D splatN3;
                vec3 splatWeights(vec2 uv) {
                    vec3 w = texture2D(diffuseSampler, uv).rgb;
                    return w / max(w.r + w.g + w.b, 0.001);
                }
                vec4 splatNormal(vec2 uv) {
                    vec3 w = splatWeights(uv);
                    return vec4(w.r * texture2D(splatN1, uv * splatTile.x).xyz
                              + w.g * texture2D(splatN2, uv * splatTile.y).xyz
                              + w.b * texture2D(splatN3, uv * splatTile.z).xyz, 1.0);
                }`,
            CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
                {
                    vec3 w = splatWeights(vDiffuseUV);
                    baseColor.rgb = w.r * texture2D(splatD1, vDiffuseUV * splatTile.x).rgb
                                  + w.g * texture2D(splatD2, vDiffuseUV * splatTile.y).rgb
                                  + w.b * texture2D(splatD3, vDiffuseUV * splatTile.z).rgb;
                }`,
            // The bump code samples one normal map: sample the blended layers instead.
            "!texture2D\\(bumpSampler,vBumpUV\\+uvOffset\\)": "splatNormal(vBumpUV+uvOffset)",
        };
    }
}

/**
 * A ground material blending three textures, each with its own normal map (so cracks and
 * ripples catch the light), by a mix map: its red, green and blue say how much of layers 1, 2
 * and 3 go where, across the ground's 0..1 UVs (draw one with {@link imageFromFunction}).
 *
 * It's Babylon's own StandardMaterial with a material plugin, not `@babylonjs/materials`'
 * TerrainMaterial (whose `.js` imports can give a bundler a second copy of Babylon), so fog,
 * every light and vertex colours keep working. The mix map is the material's
 * `diffuseTexture`; its `bumpTexture` only switches Babylon's bump code on.
 *
 * @example
 * ```ts
 * ground.material = splatMaterial(scene, mixUrl, [
 *     { colour: "mud.jpg", normal: "mud_nor.jpg", tiles: 64 },
 *     { colour: "sand.jpg", normal: "sand_nor.jpg", tiles: 45 },
 *     { colour: "grass.jpg", normal: "grass_nor.jpg", tiles: 80 }]);
 * ```
 *
 * @category Nature
 */
export function splatMaterial(scene: Scene, mixUrl: string, layers: [SplatLayer, SplatLayer, SplatLayer], name = "splat"): StandardMaterial {
    let m = new StandardMaterial(name, scene);
    m.diffuseTexture = new Texture(mixUrl, scene);
    m.bumpTexture = new Texture(layers[0].normal, scene);
    new SplatPlugin(m, scene, layers);
    return m;
}
