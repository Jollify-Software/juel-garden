import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import { seededRandom } from "../Utils/noise";

/** How {@link leafTexture} draws its leaves. */
export interface LeafOptions {
    /** The leaves' colours, picked at random. Default olive greens, silvery beneath. */
    shades?: string[];
    /** How many leaves on the card. Default 900. */
    count?: number;
    /** Each leaf's length and width in pixels on a 512-pixel card. Default 13–20 by 2.4–3.8 (narrow). */
    length?: [number, number];
    width?: [number, number];
    seed?: number;
}

/**
 * Leaves on a transparent card, drawn in code: sprays of small leaves, densest in the middle
 * and thinning to a ragged edge, for {@link cardTrees}' crowns (or bushes, hedges). Loaded as
 * a PNG with `hasAlpha` (a DynamicTexture's transparent parts aren't cut away by the alpha test).
 *
 * @category Nature
 */
export function leafTexture(scene: Scene, options: LeafOptions = {}): Texture {
    let size = 512;
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");
    let rand = seededRandom(options.seed ?? 5);
    let shades = options.shades ?? ["#5d6a4a", "#6f7c5a", "#7f8c6b", "#93a084", "#a9b39b", "#4f5b3f"];
    let [l0, l1] = options.length ?? [13, 20], [w0, w1] = options.width ?? [2.4, 3.8];
    for (let i = 0; i < (options.count ?? 900); i++) {
        let r = Math.sqrt(rand()) * size * 0.46, a = rand() * Math.PI * 2;
        ctx.save();
        ctx.translate(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r * 0.85);
        ctx.rotate(rand() * Math.PI * 2);
        ctx.fillStyle = shades[Math.floor(rand() * shades.length)];
        ctx.beginPath();
        ctx.ellipse(0, 0, l0 + rand() * (l1 - l0), w0 + rand() * (w1 - w0), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    let texture = new Texture(canvas.toDataURL("image/png"), scene);
    texture.hasAlpha = true;
    return texture;
}

/** A material for leaf cards: cut out by the texture's alpha, lit on both sides. */
export function leafMaterial(scene: Scene, texture: Texture, name = "leaves"): StandardMaterial {
    let m = new StandardMaterial(name, scene);
    m.diffuseTexture = texture;
    // The alpha test reads the texture's alpha only with this on.
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    m.alphaCutOff = 0.4;
    m.backFaceCulling = false;
    m.twoSidedLighting = true;
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    m.maxSimultaneousLights = 8;
    return m;
}

/** How {@link cardTrees} grows its trees. */
export interface CardTreeOptions {
    /** The trunk's material (a bark texture repeating 1 × 3, say), and the crown's ({@link leafMaterial}). */
    bark?: Material;
    leaves?: Material;
    /** How many different shapes. Default 3. */
    variants?: number;
    /** The trunk's height to the fork, and how far the limbs reach out and up. Default 1.3–1.7, 1–1.8 and 1.2–1.8 m. */
    trunk?: [number, number];
    reach?: [number, number];
    rise?: [number, number];
    /** The leaf cards' size. Default 1.7–2.5 m. */
    card?: [number, number];
    seed?: number;
}

/**
 * Low, gnarled trees built in code to stay light (an olive, a scrubby oak): a short twisting
 * trunk forking into two or three leaning limbs, each tipped with crossed leaf cards. A few
 * hundred triangles each, where downloaded tree models can run to hundreds of thousands.
 *
 * Returns `variants` hidden templates (trunk and crown, at y = -100): place the trees as
 * instances, so a whole wood costs a draw call or two per shape.
 *
 * @example
 * ```ts
 * const shapes = cardTrees(scene, { bark: texturedMaterial(scene, "bark", "bark.jpg", "bark_nor.jpg", 1, 3),
 *     leaves: leafMaterial(scene, leafTexture(scene)) });
 * for (const part of [shapes[0].trunk, shapes[0].leaves]) part.createInstance("tree").position.set(4, 0, 9);
 * ```
 *
 * @category Nature
 */
export function cardTrees(scene: Scene, options: CardTreeOptions = {}): { trunk: Mesh, leaves: Mesh }[] {
    let leaves = options.leaves ?? leafMaterial(scene, leafTexture(scene));
    let range = (r: [number, number], rand: () => number) => r[0] + rand() * (r[1] - r[0]);
    let trees: { trunk: Mesh, leaves: Mesh }[] = [];
    for (let v = 0; v < (options.variants ?? 3); v++) {
        let rand = seededRandom((options.seed ?? 100) + v * 37);
        let lean = new Vector3(rand() - 0.5, 0, rand() - 0.5).scale(0.5);
        let fork = new Vector3(lean.x, range(options.trunk ?? [1.3, 1.7], rand), lean.z);
        let trunkPath = [new Vector3(0, -0.2, 0), new Vector3(lean.x * 0.3 + 0.08, fork.y * 0.45, lean.z * 0.3 - 0.06), fork];
        let parts: Mesh[] = [
            MeshBuilder.CreateTube("tree-trunk", { path: trunkPath, radiusFunction: i => [0.34, 0.24, 0.2][i] ?? 0.2, tessellation: 9, cap: Mesh.CAP_START }, scene),
        ];
        let tips: Vector3[] = [];
        let limbs = 2 + (v % 2);
        for (let b = 0; b < limbs; b++) {
            let a = (b / limbs) * Math.PI * 2 + rand();
            let out = range(options.reach ?? [1, 1.8], rand), up = range(options.rise ?? [1.2, 1.8], rand);
            let mid = fork.add(new Vector3(Math.sin(a) * out * 0.5, up * 0.42, Math.cos(a) * out * 0.5));
            let tip = fork.add(new Vector3(Math.sin(a) * out, up, Math.cos(a) * out));
            tips.push(tip);
            parts.push(MeshBuilder.CreateTube("tree-limb", { path: [fork, mid, tip], radiusFunction: i => [0.16, 0.11, 0.05][i] ?? 0.05, tessellation: 7 }, scene));
        }
        let trunk = Mesh.MergeMeshes(parts, true, true);
        if (options.bark) trunk.material = options.bark;
        trunk.isPickable = false;

        let cards: Mesh[] = [];
        for (let c of [...tips, fork.add(new Vector3(0, 1.6, 0))])
            for (let k = 0; k < 4; k++) {
                let card = MeshBuilder.CreatePlane("tree-card", { size: range(options.card ?? [1.7, 2.5], rand) }, scene);
                card.position = c.add(new Vector3((rand() - 0.5) * 0.9, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.9));
                card.rotation.set((rand() - 0.5) * 1.4, rand() * Math.PI, (rand() - 0.5) * 0.6);
                cards.push(card);
            }
        let crown = Mesh.MergeMeshes(cards, true, true);
        crown.material = leaves;
        crown.isPickable = false;
        trunk.position.y = crown.position.y = -100;
        trees.push({ trunk, leaves: crown });
    }
    return trees;
}
