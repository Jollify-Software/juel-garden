import { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { cardTrees, leafMaterial, leafTexture } from "../Nature/Trees";
import { seededRandom } from "../Utils/noise";

/**
 * A wood of low, gnarled trees: {@link cardTrees} shapes placed as instances over an area (a draw
 * call or two per shape however many trees), each turned and sized a little differently, kept
 * `spacing` apart.
 *
 * Attributes: `count` (default 8), `width` and `depth` (the area, centred on `position`; default
 * 20 by 20, or the whole of `ground`), `ground` (a selector for a `<garden-ground>` or
 * `<garden-height-map>`: the trees stand on it), `seed`, `variants` (how many different shapes,
 * default 3), `size` (the smallest and largest scale, default `0.85 1.15`), `spacing` (the least
 * distance between trunks, default 2.5 m; fewer than `count` trees if the area is too full),
 * `bark-colour` (default a grey-brown), `bark-texture` and `bark-bump-texture` (a bark texture
 * and its normal map, repeating once round and three times up each trunk), `leaf-colours` (the
 * leaves' shades, picked at random: `#rrggbb` values separated by spaces; default olive greens).
 *
 * The trees are `element.trees` (each an instance of a trunk and of a crown), under
 * `getNode()`; the shapes they instance are `element.shapes`.
 *
 * @example
 * ```html
 * <garden-trees ground="#hills" count="30" seed="4" spacing="4"
 *     bark-texture="bark.jpg" bark-bump-texture="bark-normal.jpg"></garden-trees>
 * <garden-trees position="10 0 -6" width="8" depth="8" count="5" leaf-colours="#3e5a2a #557a38 #6d8f4a"></garden-trees>
 * ```
 *
 * @category Components
 */
@customElement("garden-trees")
export class GardenTrees extends GardenElement {
    /** The bark's colour when nothing else gives it one. */
    static DEFAULT_BARK = "#5e5248";

    @property({ type: Number }) count: number;
    @property({ type: Number }) width: number;
    @property({ type: Number }) depth: number;
    @property() ground: string;
    @property({ type: Number }) seed: number;
    @property({ type: Number }) variants: number;
    @property() size: string;
    @property({ type: Number }) spacing: number;

    /** The shapes the trees instance (hidden templates). */
    shapes: { trunk: Mesh, leaves: Mesh }[] = [];
    /** Each tree: an instance of a shape's trunk and of its crown. */
    trees: { trunk: InstancedMesh, leaves: InstancedMesh }[] = [];

    protected unbuild() {
        this.disposeTrees();
        super.unbuild();
    }

    protected dispose() {
        this.disposeTrees();
        super.dispose();
    }

    /** Planted on the ground where it is, so under a new parent it's planted again. */
    protected moved() {
        this.disposeTrees();
        this.updated();
    }

    /** The trees, their templates, and the bark and leaf materials (shared by the variants: each once). */
    private disposeTrees() {
        this.node?.dispose();
        this.node = null;
        let materials = new Set<Material>();
        for (let shape of this.shapes)
            for (let mesh of [shape.trunk, shape.leaves]) {
                if (mesh.material) materials.add(mesh.material);
                mesh.dispose(false, false);
            }
        for (let material of materials)
            material.dispose(false, true);
        this.shapes = [];
        this.trees = [];
    }

    async updated() {
        let scene = this.getScene();
        if (!scene || this.node) return;
        this.beginBuild();
        try {
            let ground: Mesh & { getHeightAtCoordinates?(x: number, z: number): number } = null;
            if (this.ground) {
                await GardenElement.whenDocumentReady();
                let [groundEl] = await GardenElement.resolveReady<GardenMesh>(this.ground);
                ground = groundEl?.mesh;
                if (!ground)
                    console.warn(`<garden-trees ground="${this.ground}"> names no ground; planting on the flat.`);
            }
            let box = ground?.getBoundingInfo().boundingBox;
            let centre = this.position?.clone()
                ?? (box ? new Vector3(box.centerWorld.x, 0, box.centerWorld.z) : Vector3.Zero());
            let width = this.width > 0 ? this.width : box ? box.maximumWorld.x - box.minimumWorld.x : 20;
            let depth = this.depth > 0 ? this.depth : box ? box.maximumWorld.z - box.minimumWorld.z : 20;
            let [small, large] = (this.size ?? "0.85 1.15").trim().split(/[\s,]+/).map(Number);
            if (!(small > 0)) small = 1;
            if (!(large >= small)) large = small;
            let count = this.count >= 0 ? Math.floor(this.count) : 8;
            let spacing = this.spacing >= 0 ? this.spacing : 2.5;
            let seed = this.seed ?? 1;
            let heightAt = (x: number, z: number) => {
                let y = ground?.getHeightAtCoordinates?.(x, z);
                return Number.isFinite(y) ? y : (ground ? box.maximumWorld.y : centre.y);
            };

            this.shapes = cardTrees(scene, {
                variants: this.variants > 0 ? Math.floor(this.variants) : 3,
                seed: 100 + seed * 13,
                bark: this.barkMaterial(),
                leaves: leafMaterial(scene, leafTexture(scene, {
                    seed: seed + 4,
                    shades: this.leafColours(),
                })),
            });
            for (let shape of this.shapes) {
                (<any>shape.trunk).element = (<any>shape.leaves).element = this;
                // The templates stay out of sight (and out of the mirror's and the shadows' way).
                shape.trunk.isVisible = shape.leaves.isVisible = false;
            }

            let node = this.node = new TransformNode(this.id || "trees", scene);
            (<any>node).element = this;
            node.position.copyFrom(centre);
            let rand = seededRandom(seed * 7907 + 3);
            let placed: Vector3[] = [];
            for (let tries = 0; placed.length < count && tries < count * 30; tries++) {
                let x = centre.x + (rand() - 0.5) * width, z = centre.z + (rand() - 0.5) * depth;
                if (placed.some(p => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
                let at = new Vector3(x, heightAt(x, z), z);
                placed.push(at);
                let shape = this.shapes[placed.length % this.shapes.length];
                let s = small + rand() * (large - small), turn = rand() * Math.PI * 2;
                let tree = { trunk: shape.trunk.createInstance("tree-trunk"), leaves: shape.leaves.createInstance("tree-leaves") };
                for (let part of [tree.trunk, tree.leaves]) {
                    part.parent = node;
                    part.position.copyFrom(at.subtract(centre));
                    part.rotation.y = turn;
                    part.scaling.setAll(s);
                    part.isVisible = true;
                    part.isPickable = false;
                    (<any>part).element = this;
                }
                this.trees.push(tree);
            }
        } finally {
            this.endBuild();
        }
    }

    /** `leaf-colours` as a list, or undefined for the default shades. */
    private leafColours(): string[] {
        let shades = (this.getAttribute("leaf-colours") ?? "").trim().split(/[\s,]+/).filter(c => c.startsWith("#"));
        return shades.length ? shades : undefined;
    }

    private barkMaterial(): StandardMaterial {
        let scene = this.getScene();
        let m = new StandardMaterial("bark", scene);
        m.diffuseColor = Color3.FromHexString(this.getAttribute("bark-colour") ?? GardenTrees.DEFAULT_BARK);
        m.specularColor = new Color3(0.03, 0.03, 0.03);
        m.maxSimultaneousLights = 8;
        let colour = this.getAttribute("bark-texture"), normal = this.getAttribute("bark-bump-texture");
        if (colour) {
            m.diffuseTexture = new Texture(colour, scene);
            m.diffuseColor = Color3.White();
        }
        if (normal) m.bumpTexture = new Texture(normal, scene);
        for (let t of [m.diffuseTexture, m.bumpTexture])
            if (t) (<Texture>t).vScale = 3;
        return m;
    }
}
