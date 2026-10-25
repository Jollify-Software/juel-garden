import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector2, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";

/**
 * GLSL for a shader material or a post-process, written in the page: helpers shared by
 * `<garden-material vertex fragment>` and `<garden-post-process>`.
 *
 * @category Utils
 */

/** A uniform a shader declares: its name and GLSL type (`float`, `vec3`, `sampler2D`...). */
export interface ShaderUniform {
    name: string;
    type: string;
}

/** What a shader's source declares, read from it so the page needn't list it again. */
export interface ShaderDeclarations {
    attributes: string[];
    uniforms: ShaderUniform[];
}

/**
 * A shader's source for `which` (`"vertex"` or `"fragment"`): the element's attribute of that
 * name -- `#id` of a `<script>` in the page, or a URL -- else a child
 * `<script type="x-shader/x-vertex">` (or `x-fragment`). Null when there is none.
 */
export async function shaderSource(el: Element, which: "vertex" | "fragment"): Promise<string | null> {
    let value = el.getAttribute(which)?.trim();
    if (!value) {
        let script = Array.from(el.children).find(c => c.localName == "script" && c.getAttribute("type") == `x-shader/x-${which}`);
        return script ? script.textContent : null;
    }
    if (value.startsWith("#")) {
        let script = document.getElementById(value.slice(1));
        if (!script)
            throw new Error(`no element "${value}" for the ${which} shader`);
        return script.textContent;
    }
    let response = await fetch(value);
    if (!response.ok)
        throw new Error(`${which} shader "${value}": ${response.status}`);
    return response.text();
}

/** The attributes (vertex inputs) and uniforms a shader declares, comments ignored. */
export function shaderDeclarations(...sources: string[]): ShaderDeclarations {
    let attributes = new Set<string>();
    let uniforms = new Map<string, string>();
    for (let source of sources) {
        if (!source)
            continue;
        let code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        for (let m of code.matchAll(/\battribute\s+(?:(?:highp|mediump|lowp)\s+)?\w+\s+([\w\s,]+);/g))
            for (let name of m[1].split(","))
                attributes.add(name.trim());
        for (let m of code.matchAll(/\buniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+([\w\s,\[\]]+);/g))
            for (let name of m[2].split(","))
                uniforms.set(name.replace(/\[.*$/, "").trim(), m[1]);
    }
    return {
        attributes: [...attributes].filter(Boolean),
        uniforms: [...uniforms].filter(([name]) => name).map(([name, type]) => ({ name, type })),
    };
}

/** True for a GLSL sampler type: given to the shader as a texture, not a value. */
export function isSampler(type: string): boolean {
    return /^sampler/.test(type);
}

/**
 * Something that takes uniform values: Babylon's `ShaderMaterial` and `Effect` both have
 * these setters.
 */
export interface UniformTarget {
    setFloat(name: string, value: number): any;
    setInt(name: string, value: number): any;
    setVector2(name: string, value: Vector2): any;
    setVector3(name: string, value: Vector3): any;
    setVector4(name: string, value: Vector4): any;
    setMatrix(name: string, value: Matrix): any;
    setFloatArray?(name: string, value: number[] | Float32Array): any;
    setArray?(name: string, value: number[]): any;
    setFloats?(name: string, value: number[]): any;
}

/**
 * A uniform's value from markup or a game: a number, `"0.2 0.4 1"`, `"#ff8800"`, a number
 * array, a Babylon colour or vector. Gives the numbers, or null for something that isn't
 * one (a texture's URL).
 */
export function uniformNumbers(value: any): number[] | null {
    if (value == null)
        return null;
    if (typeof value == "number" || typeof value == "boolean")
        return [Number(value)];
    if (Array.isArray(value) || ArrayBuffer.isView(value))
        return Array.from(value as ArrayLike<number>, Number);
    if (typeof value == "object") {
        if ("r" in value)
            return "a" in value ? [value.r, value.g, value.b, value.a] : [value.r, value.g, value.b];
        if ("x" in value)
            return "w" in value ? [value.x, value.y, value.z, value.w] : "z" in value ? [value.x, value.y, value.z] : [value.x, value.y];
        if (typeof value.toArray == "function")
            return Array.from(value.toArray() as ArrayLike<number>);
        return null;
    }
    let text = String(value).trim();
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text)) {
        let c = Color4.FromHexString(text.length == 7 ? text + "ff" : text);
        return [c.r, c.g, c.b, c.a];
    }
    let parts = text.split(/[\s,]+/).map(Number);
    return parts.length && parts.every(Number.isFinite) ? parts : null;
}

/**
 * Sets one uniform on `target` from `value` by its declared GLSL `type` (a `vec3` takes three
 * numbers or a colour; a `float` the first number). Samplers aren't values: see
 * {@link uniformTexture}. Returns false if the value doesn't fit.
 */
export function setUniform(target: UniformTarget, name: string, type: string, value: any): boolean {
    let n = uniformNumbers(value);
    if (!n || !n.length)
        return false;
    let at = (i: number) => n[i] ?? 0;
    switch (type) {
        case "float": target.setFloat(name, at(0)); break;
        case "int": case "uint": case "bool": target.setInt(name, Math.round(at(0))); break;
        case "vec2": case "ivec2": target.setVector2(name, new Vector2(at(0), at(1))); break;
        case "vec3": case "ivec3": target.setVector3(name, new Vector3(at(0), at(1), at(2))); break;
        // A hex colour without alpha is opaque.
        case "vec4": case "ivec4": target.setVector4(name, new Vector4(at(0), at(1), at(2), n.length == 3 ? 1 : at(3))); break;
        case "mat4": if (n.length < 16) return false; target.setMatrix(name, Matrix.FromArray(n)); break;
        default:
            // An array (`float weights[4]`) or a type this doesn't know: the numbers as they are.
            if (target.setFloatArray) target.setFloatArray(name, n);
            else if (target.setFloats) target.setFloats(name, n);
            else if (target.setArray) target.setArray(name, n);
            else return false;
    }
    return true;
}

/** A sampler uniform's texture from a value: a Babylon texture, or an image URL loaded once. */
export function uniformTexture(value: any, scene: Scene, cache: Map<string, Texture>): any {
    if (value && typeof value == "object" && "getInternalTexture" in value)
        return value;
    let url = String(value ?? "").trim();
    if (!url)
        return null;
    let texture = cache.get(url);
    if (!texture) {
        texture = new Texture(url, scene);
        cache.set(url, texture);
    }
    return texture;
}

/**
 * The uniform a name means: exactly, else ignoring case, dashes and underscores -- HTML
 * lowercases attribute names, so `uniform-main-colour` (or `uniform-maincolour`) is `mainColour`.
 */
export function uniformNamed(uniforms: ShaderUniform[], name: string): ShaderUniform | undefined {
    let loose = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
    return uniforms.find(u => u.name == name) ?? uniforms.find(u => loose(u.name) == loose(name));
}

/** What a game can give `setUniform()`: numbers, a colour or vector, a matrix, a texture or its URL. */
export type UniformValue = number | number[] | string | Color3 | Color4 | Vector2 | Vector3 | Vector4 | Matrix | Texture;
