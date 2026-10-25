import { Camera } from "@babylonjs/core/Cameras/camera";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { resolveElements } from "../Utils/resolveElements";
import { isSampler, setUniform, shaderDeclarations, shaderSource, ShaderUniform, uniformNamed, uniformTexture, UniformValue } from "../Utils/shaderSource";
import type { GardenCamera } from "./Camera";

/** Babylon's sampling modes by name, for `sampling`. */
const samplingModes: { [name: string]: number } = {
    nearest: Texture.NEAREST_SAMPLINGMODE,
    bilinear: Texture.BILINEAR_SAMPLINGMODE,
    trilinear: Texture.TRILINEAR_SAMPLINGMODE,
};

let shaderCount = 0;

/**
 * A screen effect of the page's own: a fragment shader run over the camera's whole picture
 * after the scene is drawn (Babylon's `PostProcess`) -- a red flash when the player is hit,
 * a wobble under water, a night-vision tint.
 *
 * The GLSL comes from `fragment` (the `#id` of a `<script>` in the page, or a URL) or a child
 * `<script type="x-shader/x-fragment">`. It reads the picture as `uniform sampler2D
 * textureSampler` at `varying vec2 vUV`, as any Babylon post-process does. Its other uniforms
 * are read from the source: `uniform vec2 screenSize` gets the effect's size in pixels and
 * `uniform float time` the seconds since it was built, every frame; `uniform-<name>="value"`
 * sets the rest (numbers, a `#rrggbb` colour, or an image URL for another `sampler2D`), and a
 * game changing one every frame calls {@link setUniform}. Changing a `uniform-` attribute
 * applies at once; any other change builds the effect again.
 *
 * Attributes: `ratio` (the effect's size against the canvas, default 1: `0.25` works on a
 * quarter-size picture, cheaper and blockier), `sampling` (`nearest` (Babylon's default),
 * `bilinear` or `trilinear`: how the picture is read when the sizes differ), `camera` (the
 * `<garden-camera>`s it applies to, a selector; default the main camera -- the first without
 * a `viewport` -- so a HUD or picture-in-picture camera is left alone), `disabled` (built but
 * off: a game sets and removes it). Several apply in the order they're built.
 * `element.postProcesses` are Babylon's, one per camera. (A Babylon effect of its own, like
 * FXAA or bloom, is `<garden-pipeline>`'s.)
 *
 * @example
 * ```html
 * <garden-post-process uniform-threshold="0.3" ratio="0.25">
 *   <script type="x-shader/x-fragment">
 *     precision highp float;
 *     varying vec2 vUV;
 *     uniform sampler2D textureSampler;
 *     uniform float threshold;
 *     void main() {
 *       vec4 c = texture2D(textureSampler, vUV);
 *       gl_FragColor = c.r < threshold ? c : vec4(0.);
 *     }
 *   </script>
 * </garden-post-process>
 * ```
 *
 * @category Components
 */
@customElement("garden-post-process")
export class GardenPostProcess extends GardenElement {
    /** The fragment shader: `#id` of a `<script>`, or a URL. */
    @property() fragment: string;
    @property({ type: Number }) ratio: number;
    @property() sampling: string;
    @property() camera: string;

    postProcesses: PostProcess[] = [];

    /** The uniforms the shader declares. */
    uniforms: ShaderUniform[] = [];
    /** Values from `uniform-` attributes, and from {@link setUniform} (newer, until the attribute changes), applied every frame. */
    private attributeValues = new Map<string, UniformValue>();
    private values = new Map<string, UniformValue>();
    private textures = new Map<string, Texture>();
    private built = false;

    /** Its `updated()` takes `uniform-` changes in place and rebuilds for the rest. */
    protected get handlesChanges() {
        return true;
    }

    async updated(changed?: Map<PropertyKey, unknown>) {
        let scene = this.getScene();
        if (!scene)
            return;
        if (this.built && changed?.size) {
            let keys = [...changed.keys()].map(String);
            if (keys.every(key => key.startsWith("uniform-") || key == "disabled")) {
                // A changed attribute is newer than what a game set.
                for (let key of keys.filter(key => key.startsWith("uniform-")))
                    this.values.delete(uniformNamed(this.uniforms, key.slice("uniform-".length))?.name);
                this.readAttributes();
                this.applyDisabled();
                return;
            }
        }
        this.beginBuild();
        this.disposePostProcesses();
        this.built = true;
        try {
            await GardenElement.whenDocumentReady();
            let cameras = await this.cameras();
            let fragment = await shaderSource(this, "fragment");
            if (!fragment)
                throw new Error("no fragment shader");
            this.uniforms = shaderDeclarations(fragment).uniforms;
            // Values a game set before this build, under the shader's own names.
            for (let [name, value] of [...this.values]) {
                let uniform = uniformNamed(this.uniforms, name);
                if (uniform && uniform.name != name) {
                    this.values.delete(name);
                    this.values.set(uniform.name, value);
                }
            }
            this.readAttributes();
            // Babylon finds a post-process's shader by name in its store.
            let name = `gardenPostProcess${++shaderCount}`;
            Effect.ShadersStore[name + "FragmentShader"] = fragment;
            let uniforms = this.uniforms.filter(u => !isSampler(u.type)).map(u => u.name);
            let samplers = this.uniforms.filter(u => isSampler(u.type) && u.name != "textureSampler").map(u => u.name);
            let sampling = samplingModes[(this.sampling ?? "").toLowerCase()] ?? Texture.NEAREST_SAMPLINGMODE;
            let start = performance.now();
            for (let camera of cameras) {
                let pp = new PostProcess(this.id || "post-process", name, uniforms, samplers, this.ratio > 0 ? this.ratio : 1,
                    camera, sampling, scene.getEngine(), false);
                pp.onApplyObservable.add(effect => this.apply(effect, pp, (performance.now() - start) / 1000));
                this.postProcesses.push(pp);
            }
            this.applyDisabled();
        } catch (e) {
            console.warn(`<garden-post-process> couldn't build: ${e}`);
        } finally {
            this.endBuild();
        }
    }

    /** The cameras it applies to: `camera`, else the main one (the first without a viewport). */
    private async cameras(): Promise<Camera[]> {
        let sceneEl = this.getSceneEl();
        let els = this.camera
            ? resolveElements<GardenCamera>(this.camera)
            : (Array.from(sceneEl?.querySelectorAll("garden-camera") ?? []) as GardenCamera[]).filter(el => !el.hasAttribute("viewport")).slice(0, 1);
        await Promise.all(els.map(el => el.updateComplete));
        let cameras = els.map(el => el.camera).filter(Boolean);
        if (!cameras.length && this.getScene().activeCamera)
            cameras.push(this.getScene().activeCamera);
        return cameras;
    }

    /** `uniform-` attributes into the values set every frame. */
    private readAttributes() {
        this.attributeValues.clear();
        for (let attr of Array.from(this.attributes)) {
            if (!attr.name.startsWith("uniform-"))
                continue;
            let name = attr.name.slice("uniform-".length), uniform = uniformNamed(this.uniforms, name);
            if (uniform)
                this.attributeValues.set(uniform.name, attr.value);
            else
                console.warn(`<garden-post-process>: the shader has no uniform "${name}"`);
        }
    }

    private apply(effect: Effect, pp: PostProcess, seconds: number) {
        for (let uniform of this.uniforms) {
            let value = this.values.get(uniform.name) ?? this.attributeValues.get(uniform.name);
            if (value === undefined) {
                if (uniform.name == "screenSize" && uniform.type == "vec2")
                    effect.setFloat2("screenSize", pp.width, pp.height);
                else if (uniform.name == "time" && uniform.type == "float")
                    effect.setFloat("time", seconds);
                continue;
            }
            if (isSampler(uniform.type)) {
                if (uniform.name != "textureSampler") {
                    let texture = uniformTexture(value, this.getScene(), this.textures);
                    if (texture)
                        effect.setTexture(uniform.name, texture);
                }
            } else {
                setUniform(effect, uniform.name, uniform.type, value);
            }
        }
    }

    /**
     * Sets a uniform (see the class's description): a number, numbers, a colour or vector, or
     * for a sampler a texture or an image URL. Applied from the next frame on.
     */
    setUniform(name: string, value: UniformValue) {
        let uniform = uniformNamed(this.uniforms, name);
        // Before the build the uniforms aren't known: kept by this name, found then.
        if (!uniform && this.uniforms.length)
            console.warn(`<garden-post-process>: the shader has no uniform "${name}"`);
        this.values.set(uniform?.name ?? name, value);
    }

    /** Where each post-process was in its camera's chain when `disabled` took it out. */
    private detachedAt = new Map<PostProcess, number>();

    /** `disabled`: out of its camera's chain, and back in at the same place without it. */
    private applyDisabled() {
        let off = this.hasAttribute("disabled");
        for (let pp of this.postProcesses) {
            let camera = pp.getCamera();
            if (!camera)
                continue;
            if (off && !this.detachedAt.has(pp)) {
                this.detachedAt.set(pp, camera._postProcesses.indexOf(pp));
                camera.detachPostProcess(pp);
            } else if (!off && this.detachedAt.has(pp)) {
                camera.attachPostProcess(pp, this.detachedAt.get(pp));
                this.detachedAt.delete(pp);
            }
        }
    }

    private disposePostProcesses() {
        for (let pp of this.postProcesses)
            pp.dispose();
        this.postProcesses = [];
        this.detachedAt.clear();
    }

    protected dispose() {
        this.disposePostProcesses();
        for (let texture of this.textures.values())
            texture.dispose();
        this.textures.clear();
        this.built = false;
        super.dispose();
    }
}
