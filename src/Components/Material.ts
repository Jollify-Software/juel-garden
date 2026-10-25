import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { customElement, property } from "lit/decorators.js";
import { Color3Convert } from "../Converters/Color3Convert";
import { GardenElement } from "../GardenElement";
import { isSampler, setUniform, shaderDeclarations, shaderSource, ShaderUniform, uniformNamed, uniformTexture, UniformValue } from "../Utils/shaderSource";
import { GardenTexture } from "./Texture";

/**
 * The vertex shader a `<garden-material>` with only a `fragment` gets: the mesh drawn where it
 * is, with `vUV`, `vNormal` (world) and `vPosition` (world) for the fragment shader to use.
 */
export const DefaultVertexShader = `precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
    vec4 p = vec4(position, 1.0);
    gl_Position = worldViewProjection * p;
    vUV = uv;
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);
    vPosition = (world * p).xyz;
}
`;

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
 * `spec-colour`, `emissive-colour`, `ambient-colour` (how much of the scene's
 * `ambient-colour` it takes), `lighting="false"` (unlit: only its emissive colour
 * shows, a lamp's bulb), `wireframe` (drawn as its edges, a bounding box shown),
 * `back-faces` (both sides drawn, a single sheet seen from behind), `opacity` (0 clear to 1 solid: below 1
 * the material is see-through and both faces draw -- glass, water, a
 * glazed roof), `node` (a node material instead -- the Node Material Editor's
 * output, as a JSON file's URL or `#ID` on Babylon's snippet server: shaders,
 * water, anti-tiling grounds, effects; a `<garden-texture block="name">` child
 * fills its texture block of that name (and then the textures saved in it aren't
 * loaded), and `input-<name>="value"` sets its input block of that name: a
 * number, or 2–4 numbers for a vector or colour).
 *
 * **Shaders** (game effects: a force field, a pulse, a dissolve): `vertex` and `fragment` give
 * GLSL for a Babylon `ShaderMaterial`, each the `#id` of a `<script>` in the page or a URL, or
 * written in a child `<script type="x-shader/x-vertex">` / `"x-shader/x-fragment"`. With only a
 * fragment shader, {@link DefaultVertexShader} draws the mesh and passes `vUV`, `vNormal` and
 * `vPosition`. The attributes and uniforms are read from the source. Babylon fills the matrices
 * (`world`, `worldViewProjection`, `view`, ...); a `uniform float time` gets the seconds since
 * the material was built, every frame. `uniform-<name>="value"` sets any other: a number, numbers
 * for a vector (`"0.2 0.5 1"`) or a `#rrggbb` colour for a `vec3`/`vec4`, an image URL for a
 * `sampler2D` (or a `<garden-texture uniform="name">` child). Changing a `uniform-` attribute
 * sets it at once, without rebuilding; a game changing one every frame calls
 * {@link setUniform} instead. `opacity` below 1 turns on alpha blending (the shader's alpha).
 *
 * @example
 * ```html
 * <garden-room>
 *   <garden-material slot="north" colour="red">
 *     <garden-texture src="wall.jpg"></garden-texture>
 *   </garden-material>
 * </garden-room>
 * <garden-box>
 *   <garden-material uniform-colour="#ff8800">
 *     <script type="x-shader/x-fragment">
 *       precision highp float;
 *       uniform vec3 colour;
 *       uniform float time;
 *       void main() { gl_FragColor = vec4(colour * (0.5 + 0.5 * sin(time)), 1.0); }
 *     </script>
 *   </garden-material>
 * </garden-box>
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
    @property({ attribute: "ambient-colour", converter: colourConverter }) ambientColour: Color3;
    @property({ type: Number }) opacity: number;
    /** A node material instead: a JSON file's URL, or `#ID` for one on Babylon's snippet server. */
    @property({ attribute: "node" }) nodeSource: string;
    /** A shader material's vertex shader: `#id` of a `<script>`, or a URL. */
    @property() vertex: string;
    /** A shader material's fragment shader: `#id` of a `<script>`, or a URL. */
    @property() fragment: string;

    material: StandardMaterial;

    /** A shader material's uniforms, as its source declares them. */
    uniforms: ShaderUniform[] = [];
    /** Values a game gave {@link setUniform}: kept for a rebuild. */
    private uniformValues = new Map<string, UniformValue>();
    private uniformTextures = new Map<string, Texture>();

    /** Materials a `<garden-material>` built: a mesh's rebuild or removal leaves them alone. */
    static owned = new WeakSet<object>();

    /** A shader material sets a changed `uniform-` attribute in place; anything else rebuilds it. */
    protected get handlesChanges() {
        return this.material instanceof ShaderMaterial;
    }

    async updated(changed?: Map<PropertyKey, unknown>) {
        if (this.material instanceof ShaderMaterial && changed?.size) {
            let keys = [...changed.keys()].map(String);
            if (keys.every(key => key.startsWith("uniform-"))) {
                for (let key of keys) {
                    // Newer than what a game set: a rebuild keeps the attribute's value.
                    this.uniformValues.delete(uniformNamed(this.uniforms, key.slice("uniform-".length))?.name);
                    this.applyUniformAttribute(key);
                }
                return;
            }
            this.unbuild();
        }
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
        if (this.vertex || this.fragment || this.querySelector(":scope > script[type^='x-shader/']")) {
            await this.buildShader();
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
        if (this.ambientColour)
            material.ambientColor = this.ambientColour;
        let flag = (name: string) => this.hasAttribute(name) && this.getAttribute(name) != "false";
        if (this.getAttribute("lighting") == "false")
            material.disableLighting = true;
        if (flag("wireframe"))
            material.wireframe = true;
        if (flag("back-faces"))
            material.backFaceCulling = false;
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

    /**
     * `vertex`/`fragment`: a Babylon `ShaderMaterial` from GLSL in the page or at a URL, its
     * attributes and uniforms read from the source; see the class's description.
     */
    private async buildShader() {
        let scene = this.getScene();
        let material: ShaderMaterial;
        try {
            let fragment = await shaderSource(this, "fragment");
            let vertex = await shaderSource(this, "vertex") ?? DefaultVertexShader;
            if (!fragment)
                throw new Error("no fragment shader");
            let declared = shaderDeclarations(vertex, fragment);
            this.uniforms = declared.uniforms;
            material = new ShaderMaterial(this.id || "shader", scene, { vertexSource: vertex, fragmentSource: fragment }, {
                attributes: declared.attributes.length ? declared.attributes : ["position"],
                uniforms: declared.uniforms.filter(u => !isSampler(u.type)).map(u => u.name),
                samplers: declared.uniforms.filter(u => isSampler(u.type)).map(u => u.name),
                needAlphaBlending: this.opacity != null && this.opacity < 1,
            });
        } catch (e) {
            console.warn(`<garden-material> couldn't build its shader: ${e}`);
            this.endBuild();
            return;
        }
        GardenMaterial.owned.add(material);
        if (this.opacity != null && this.opacity < 1)
            material.backFaceCulling = false;
        this.wear(material);

        for (let attr of Array.from(this.attributes))
            if (attr.name.startsWith("uniform-"))
                this.applyUniformAttribute(attr.name);
        for (let t of this.getTextures().filter(t => t.hasAttribute("uniform")))
            this.setUniform(t.getAttribute("uniform"), t.texture, false);
        for (let [name, value] of this.uniformValues)
            this.setUniform(name, value, false);
        // `time`: seconds since it was built, unless the page sets it.
        let time = uniformNamed(this.uniforms, "time");
        if (time?.type == "float" && !this.hasAttribute("uniform-time") && !this.uniformValues.has(time.name)) {
            let start = performance.now();
            this.observe(scene.onBeforeRenderObservable, () => material.setFloat(time.name, (performance.now() - start) / 1000));
        }
        this.endBuild();
    }

    private applyUniformAttribute(attribute: string) {
        if (this.hasAttribute(attribute))
            this.setUniform(attribute.slice("uniform-".length), this.getAttribute(attribute), false);
    }

    /**
     * Sets a shader material's uniform (see the class's description): a number, numbers, a
     * colour or vector, a matrix, or for a sampler a texture or an image URL. The name is the
     * shader's, in any case. Cheap enough for every frame; the value is kept for a rebuild.
     */
    setUniform(name: string, value: UniformValue, keep = true) {
        let uniform = uniformNamed(this.uniforms, name);
        if (keep)
            this.uniformValues.set(uniform?.name ?? name, value);
        let material = this.material as any;
        if (!(material instanceof ShaderMaterial))
            return; // not built yet: applied when it is
        if (!uniform) {
            console.warn(`<garden-material>: the shader has no uniform "${name}"`);
        } else if (isSampler(uniform.type)) {
            let texture = uniformTexture(value, this.getScene(), this.uniformTextures);
            if (texture)
                material.setTexture(uniform.name, texture);
        } else if (!setUniform(material, uniform.name, uniform.type, value)) {
            console.warn(`<garden-material>: "${value}" isn't a value for the ${uniform.type} uniform "${uniform.name}"`);
        }
    }

    protected dispose() {
        for (let texture of this.uniformTextures.values())
            texture.dispose();
        this.uniformTextures.clear();
        super.dispose();
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
