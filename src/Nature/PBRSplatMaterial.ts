import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { Scene } from "@babylonjs/core/scene";

/** One ground texture for {@link pbrSplatMaterial}: a photo-scanned surface. */
export interface PBRSplatLayer {
    /** The colour (albedo) texture's URL. */
    colour: string;
    /** Its normal map's URL (OpenGL convention: green up). */
    normal: string;
    /**
     * Optional: one map with ambient occlusion in red, roughness in green and height
     * (displacement) in blue. Without it the layer is evenly rough (`roughness`) and flat.
     */
    arh?: string;
    /** How many times it repeats across the ground. */
    tiles: number;
    /** Its roughness without an `arh` map. Default 0.9. */
    roughness?: number;
}

/** How {@link pbrSplatMaterial} renders. Turn the costly parts off for phones and tablets. */
export interface PBRSplatOptions {
    /** Name of the material. Default "pbr-splat". */
    name?: string;
    /**
     * Breaks up the tiling: each layer is sampled twice, at two scales and turned, and the two
     * blended by noise over tens of metres. Twice the texture reads. Default true.
     */
    antiTile?: boolean;
    /** Parallax from the height maps, in a tile's width (0 for none). Default 0.025. */
    parallax?: number;
    /** Where layers meet, the higher one wins (sand fills cracks, stones stand out of sand). Default true. */
    heightBlend?: boolean;
    /** Brightness that varies over tens of metres (0 for none), and its size in UV units. Default 0.25 and 9. */
    macro?: number;
    macroScale?: number;
    /** How strongly the ambient occlusion darkens the ground, 0 to 1. Default 0.8. */
    occlusion?: number;
}

const SAMPLERS = ["splatD1", "splatD2", "splatD3", "splatN2", "splatN3", "splatA1", "splatA2", "splatA3"];

class PBRSplatPlugin extends MaterialPluginBase {
    private textures: (Texture | null)[] = [];
    private all: Texture[] = [];
    private tiles: number[];
    private rough: number[];
    private hasArh: boolean;

    constructor(material: PBRMaterial, scene: Scene, layers: PBRSplatLayer[], private o: Required<PBRSplatOptions>) {
        super(material, "PBRGroundSplat", 200, { PBRSPLAT: false, PBRSPLAT_ARH: false, PBRSPLAT_ANTITILE: false, PBRSPLAT_PARALLAX: false, PBRSPLAT_HEIGHTBLEND: false });
        let load = (url: string | undefined, srgb: boolean) => {
            if (!url) return null;
            let t = new Texture(url, scene, false, true);
            t.anisotropicFilteringLevel = 8;
            t.gammaSpace = srgb;
            this.all.push(t);
            return t;
        };
        // splatD1..3, splatN2..3 (layer 1's normal map is the material's own bump texture), splatA1..3.
        let d = layers.map(l => load(l.colour, true));
        let n = layers.slice(1).map(l => load(l.normal, false));
        this.hasArh = layers.every(l => !!l.arh);
        let a = layers.map(l => this.hasArh ? load(l.arh, false) : null);
        this.textures = [...d, ...n, ...a];
        this.tiles = layers.map(l => l.tiles);
        this.rough = layers.map(l => l.roughness ?? 0.9);
        this._enable(true);
    }

    getClassName() { return "PBRGroundSplatPlugin"; }

    prepareDefines(defines: Record<string, unknown>) {
        defines.PBRSPLAT = true;
        defines.PBRSPLAT_ARH = this.hasArh;
        defines.PBRSPLAT_ANTITILE = this.o.antiTile;
        defines.PBRSPLAT_PARALLAX = this.hasArh && this.o.parallax > 0;
        defines.PBRSPLAT_HEIGHTBLEND = this.hasArh && this.o.heightBlend;
    }

    isReadyForSubMesh() { return this.all.every(t => t.isReady()); }

    getSamplers(samplers: string[]) { samplers.push(...SAMPLERS); }

    getUniforms() {
        return {
            ubo: [
                { name: "splatTile", size: 3, type: "vec3" },
                { name: "splatRough", size: 3, type: "vec3" },
                { name: "splatParams", size: 4, type: "vec4" },
            ],
            fragment: "uniform vec3 splatTile; uniform vec3 splatRough; uniform vec4 splatParams;",
        };
    }

    bindForSubMesh(ubo: UniformBuffer) {
        ubo.updateFloat3("splatTile", this.tiles[0], this.tiles[1], this.tiles[2]);
        ubo.updateFloat3("splatRough", this.rough[0], this.rough[1], this.rough[2]);
        ubo.updateFloat4("splatParams", this.o.parallax, this.o.macro, this.o.macroScale, this.o.occlusion);
        SAMPLERS.forEach((name, i) => { if (this.textures[i]) ubo.setTexture(name, this.textures[i]); });
    }

    getActiveTextures(active: Texture[]) { active.push(...this.all); }

    hasTexture(texture: Texture) { return this.all.includes(texture); }

    dispose(forceDisposeTextures?: boolean) {
        if (forceDisposeTextures) for (let t of this.all) t.dispose();
    }

    getCustomCode(shaderType: string): Record<string, string> {
        if (shaderType != "fragment") return null;
        return {
            CUSTOM_FRAGMENT_DEFINITIONS: `
                uniform sampler2D splatD1; uniform sampler2D splatD2; uniform sampler2D splatD3;
                uniform sampler2D splatN2; uniform sampler2D splatN3;
                #ifdef PBRSPLAT_ARH
                uniform sampler2D splatA1; uniform sampler2D splatA2; uniform sampler2D splatA3;
                #endif
                // WebGL 2 samples only what a pixel needs (branches, with explicit gradients so
                // the mip level is right inside them); WebGL 1 samples everything.
                #ifdef WEBGL2
                #define SPLAT_TEX(s, uv, g) textureGrad(s, uv, g.xy, g.zw)
                #define SPLAT_IF(c) if (c)
                #else
                #define SPLAT_TEX(s, uv, g) texture2D(s, uv)
                #define SPLAT_IF(c)
                #endif
                vec3 gSplatAlbedo; vec4 gSplatNormal; float gSplatRough; float gSplatAO;
                float splatHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float splatNoise(vec2 p) {
                    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(splatHash(i), splatHash(i + vec2(1.0, 0.0)), u.x), mix(splatHash(i + vec2(0.0, 1.0)), splatHash(i + vec2(1.0, 1.0)), u.x), u.y);
                }
                // One layer's colour, normal and (AO, roughness, height) at uv (gradients g), and
                // (anti-tiling) at a second, larger, turned place, mixed by k.
                void splatLayer(sampler2D D, sampler2D N, sampler2D A, bool hasA, vec2 uv, vec4 g, float k, inout vec3 c, inout vec3 n, inout vec3 a) {
                    vec3 c1 = vec3(0.0); vec3 n1 = vec3(0.5, 0.5, 1.0); vec3 a1 = vec3(1.0, 0.0, 0.5);
                    SPLAT_IF(k < 0.999) {
                        c1 = toLinearSpace(SPLAT_TEX(D, uv, g).rgb);
                        n1 = SPLAT_TEX(N, uv, g).xyz;
                        if (hasA) a1 = SPLAT_TEX(A, uv, g).rgb;
                    }
                    #ifdef PBRSPLAT_ANTITILE
                    SPLAT_IF(k > 0.001) {
                        mat2 r = mat2(0.8, -0.6, 0.6, 0.8) * 0.47;
                        vec2 uv2 = r * uv + vec2(0.37, 0.71);
                        vec4 g2 = vec4(r * g.xy, r * g.zw);
                        vec3 c2 = toLinearSpace(SPLAT_TEX(D, uv2, g2).rgb);
                        vec3 n2 = SPLAT_TEX(N, uv2, g2).xyz;
                        vec3 a2 = hasA ? SPLAT_TEX(A, uv2, g2).rgb : a1;
                        c1 = mix(c1, c2, k); n1 = mix(n1, n2, k); a1 = mix(a1, a2, k);
                    }
                    #endif
                    c = c1; n = n1; a = a1;
                }
                vec2 splatParallax(sampler2D A, vec2 uv, vec4 g, vec2 view) {
                    #ifdef PBRSPLAT_PARALLAX
                    float h = SPLAT_TEX(A, uv, g).b;
                    return uv + view * (h - 0.5) * splatParams.x;
                    #else
                    return uv;
                    #endif
                }
                vec4 splatNormalSample() { return gSplatNormal; }`,
            CUSTOM_FRAGMENT_MAIN_BEGIN: `
                {
                    vec2 uv = vAlbedoUV;
                    vec3 w = texture2D(albedoSampler, uv).rgb;
                    w /= max(w.r + w.g + w.b, 0.001);
                    vec4 g0 = vec4(dFdx(uv), dFdy(uv));
                    vec2 view = vec2(0.0);
                    #ifdef PBRSPLAT_PARALLAX
                    {
                        vec3 V = normalize(vEyePosition.xyz - vPositionW);
                        mat3 sTBN = cotangent_frame(normalize(vNormalW), vPositionW, uv, vec2(1.0, 1.0));
                        vec3 vt = transposeMat3(sTBN) * V;
                        view = vt.xy / max(vt.z, 0.25);
                    }
                    #endif
                    // Anti-tiling: where the second, larger and turned sample shows (noise over tens of
                    // metres); mostly all one or the other, so most pixels read one sample.
                    float k = 0.0;
                    #ifdef PBRSPLAT_ANTITILE
                    k = smoothstep(0.35, 0.65, splatNoise(uv * 23.0) * 0.7 + splatNoise(uv * 61.0) * 0.3);
                    #endif
                    vec3 c1 = vec3(0.0), c2 = vec3(0.0), c3 = vec3(0.0);
                    vec3 n1 = vec3(0.5, 0.5, 1.0), n2 = n1, n3 = n1;
                    vec3 a1 = vec3(1.0, splatRough.x, 0.5), a2 = vec3(1.0, splatRough.y, 0.5), a3 = vec3(1.0, splatRough.z, 0.5);
                    // Only the layers present here.
                    #ifdef PBRSPLAT_ARH
                    SPLAT_IF(w.r > 0.002) { vec2 l = splatParallax(splatA1, uv * splatTile.x, g0 * splatTile.x, view); splatLayer(splatD1, bumpSampler, splatA1, true, l, g0 * splatTile.x, k, c1, n1, a1); }
                    SPLAT_IF(w.g > 0.002) { vec2 l = splatParallax(splatA2, uv * splatTile.y, g0 * splatTile.y, view); splatLayer(splatD2, splatN2, splatA2, true, l, g0 * splatTile.y, k, c2, n2, a2); }
                    SPLAT_IF(w.b > 0.002) { vec2 l = splatParallax(splatA3, uv * splatTile.z, g0 * splatTile.z, view); splatLayer(splatD3, splatN3, splatA3, true, l, g0 * splatTile.z, k, c3, n3, a3); }
                    #else
                    SPLAT_IF(w.r > 0.002) splatLayer(splatD1, bumpSampler, splatD1, false, uv * splatTile.x, g0 * splatTile.x, k, c1, n1, a1);
                    SPLAT_IF(w.g > 0.002) splatLayer(splatD2, splatN2, splatD2, false, uv * splatTile.y, g0 * splatTile.y, k, c2, n2, a2);
                    SPLAT_IF(w.b > 0.002) splatLayer(splatD3, splatN3, splatD3, false, uv * splatTile.z, g0 * splatTile.z, k, c3, n3, a3);
                    a1.g = splatRough.x; a2.g = splatRough.y; a3.g = splatRough.z;
                    #endif
                    #ifdef PBRSPLAT_HEIGHTBLEND
                    // Height blending: the higher surface shows where two layers meet.
                    vec3 hw = w + vec3(a1.b, a2.b, a3.b) * 0.6;
                    float top = max(hw.r, max(hw.g, hw.b)) - 0.25;
                    w = max(hw - vec3(top), vec3(0.0)) * step(0.002, w);
                    w /= max(w.r + w.g + w.b, 0.001);
                    #endif
                    gSplatAlbedo = w.r * c1 + w.g * c2 + w.b * c3;
                    gSplatNormal = vec4(w.r * n1 + w.g * n2 + w.b * n3, 1.0);
                    vec3 arh = w.r * a1 + w.g * a2 + w.b * a3;
                    gSplatAO = mix(1.0, arh.r, splatParams.w);
                    gSplatRough = arh.g;
                    // Large-scale variation in brightness and warmth, so the ground isn't one even colour.
                    float m = splatNoise(uv * splatParams.z) * 0.65 + splatNoise(uv * splatParams.z * 3.7) * 0.35;
                    gSplatAlbedo *= 1.0 + (m - 0.5) * 2.0 * splatParams.y * vec3(1.0, 0.94, 0.86);
                }`,
            CUSTOM_FRAGMENT_UPDATE_ALBEDO: `
                surfaceAlbedo = vAlbedoColor.rgb * gSplatAlbedo * gSplatAO;
                #if defined(VERTEXCOLOR)
                surfaceAlbedo *= vColor.rgb;
                #endif`,
            CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: `metallicRoughness.g = gSplatRough;`,
            // The bump code samples one normal map: use the blended layers instead.
            "!texture2D\\(bumpSampler,vBumpUV\\+uvOffset\\)": "splatNormalSample()",
        };
    }
}

/**
 * A photo-real ground: Babylon's PBRMaterial blending three photo-scanned surfaces (each a
 * colour map, a normal map and optionally a map of ambient occlusion, roughness and height, as
 * Poly Haven and other scan libraries supply them) by a mix map, as {@link splatMaterial} does
 * for StandardMaterial: its red, green and blue say how much of layers 1, 2 and 3 go where,
 * across the ground's 0..1 UVs.
 *
 * Over the plain blend it adds, each optional (see {@link PBRSplatOptions}): **anti-tiling**
 * (each layer sampled at two scales, turned, mixed by noise, so no repeat shows to the horizon),
 * **parallax** from the height maps, **height blending** where layers meet (sand settles in
 * cracks), ambient occlusion, per-pixel roughness and large-scale variation in brightness.
 *
 * Being PBR, it wants image-based lighting (`scene.environmentTexture`) and lights whose
 * intensities suit PBR. It uses ten texture units with `arh` maps: leave room for shadows (a
 * WebGL fragment shader has 16).
 *
 * @example
 * ```ts
 * ground.material = pbrSplatMaterial(scene, mixUrl, [
 *     { colour: "mud_diff.jpg", normal: "mud_nor.jpg", arh: "mud_arh.jpg", tiles: 64 },
 *     { colour: "sand_diff.jpg", normal: "sand_nor.jpg", arh: "sand_arh.jpg", tiles: 45 },
 *     { colour: "grass_diff.jpg", normal: "grass_nor.jpg", arh: "grass_arh.jpg", tiles: 80 }],
 *     { antiTile: !phone, parallax: phone ? 0 : 0.03 });
 * ```
 *
 * @category Nature
 */
export function pbrSplatMaterial(scene: Scene, mixUrl: string, layers: [PBRSplatLayer, PBRSplatLayer, PBRSplatLayer], options: PBRSplatOptions = {}): PBRMaterial {
    let o: Required<PBRSplatOptions> = {
        name: "pbr-splat", antiTile: true, parallax: 0.025, heightBlend: true, macro: 0.25, macroScale: 9, occlusion: 0.8,
        ...options,
    };
    let m = new PBRMaterial(o.name, scene);
    // The mix map is the albedo texture (read raw, not as colour); the first layer's normal map
    // is the bump texture, which switches Babylon's bump code on.
    let mix = new Texture(mixUrl, scene);
    mix.gammaSpace = false;
    m.albedoTexture = mix;
    m.bumpTexture = new Texture(layers[0].normal, scene);
    m.bumpTexture.anisotropicFilteringLevel = 8;
    m.metallic = 0;
    m.roughness = 1;
    m.maxSimultaneousLights = 8;
    new PBRSplatPlugin(m, scene, layers, o);
    return m;
}
