import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { StillWater } from "../Nature/StillWater";
import { resolveElements } from "../Utils/resolveElements";

/**
 * A still pool or lake: {@link StillWater} in markup. A dark disc with slow ripples and a soft
 * sheen, lying flat at `position` (its centre; the surface's height is `position`'s y).
 *
 * Attributes: `position`, `radius` (default 5), `colour` (`#rrggbb`, default a dark blue-black),
 * `ripples` (0 flat … 1, default 0.25), `mirror` (how strong the mirror is, 0 … 1, default 0.4),
 * `reflect` (turns the mirror on: bare, it reflects every mesh in the scene but the water once the
 * page has loaded; with a value, only the meshes of the elements that selector names, such as
 * `reflect="#tower, .tree"`. Leave it off on a tablet until it's needed: setting it from code
 * (`element.setAttribute("reflect", "")`) turns the mirror on then; changing it mirrors what the
 * new selector names, and removing it turns the mirror off).
 *
 * The {@link StillWater} is `element.water`; `getNode()` is its mesh.
 *
 * @example
 * ```html
 * <garden-water position="20 -1.2 40" radius="9" ripples="0.3" reflect="#tower"></garden-water>
 * ```
 *
 * @category Components
 */
@customElement("garden-water")
export class GardenWater extends GardenElement {
    @property({ type: Number }) radius: number;
    @property() colour: string;
    @property({ type: Number }) ripples: number;
    @property({ type: Number }) mirror: number;
    @property() reflect: string;

    /** The water itself. */
    water: StillWater;

    private _builtKey: string;
    private _reflecting = false;
    /** The `reflect` the current mirror was made for. */
    private _reflectedWith: string;

    update(changed?: Map<PropertyKey, unknown>) {
        this.liveUpdate(changed);
    }

    getNode() {
        return this.water?.mesh;
    }

    async updated() {
        let scene = this.getScene();
        if (!scene) return;
        let key = [this.position, this.radius, this.colour, this.ripples, this.mirror].join("|");
        if (!this.water || key != this._builtKey) {
            this._builtKey = key;
            this.water?.dispose();
            this.water = new StillWater(scene, {
                position: this.position ?? Vector3.Zero(),
                radius: this.radius > 0 ? this.radius : 5,
                colour: this.colour,
                ripples: this.ripples,
                mirror: this.mirror,
            });
            (<any>this.water.mesh).element = this;
            this.node = this.water.mesh;
        }
        // One mirror build at a time: a second would replace the first's whenReady, which then
        // never resolves. The running build picks up a newer `reflect` or a rebuilt water instead.
        if (this._reflecting) return;
        // `reflect` removed: the mirror goes. Unchanged since the mirror was made: nothing to do.
        if (!this.hasAttribute("reflect")) {
            this.water.unreflect();
            return;
        }
        if (this.water.material.reflectionTexture && this.reflect == this._reflectedWith) return;

        this._reflecting = true;
        this.beginBuild();
        try {
            await GardenElement.whenDocumentReady();
            let water: StillWater, selector: string, only: (mesh: AbstractMesh) => boolean;
            do {
                water = this.water;
                selector = this.reflect;
                only = await this.mirrorFilter(selector);
            } while (this.hasAttribute("reflect") && (water != this.water || selector != this.reflect));
            if (water && this.hasAttribute("reflect")) {
                water.unreflect();
                water.reflect(only);
                this._reflectedWith = selector;
            } else
                water?.unreflect();
        } finally {
            this._reflecting = false;
            this.endBuild();
        }
    }

    /** Waits for what `selector` names (bare: the scene's other elements), then says which meshes to mirror. */
    private async mirrorFilter(selector: string): Promise<(mesh: AbstractMesh) => boolean> {
        // Another water's mesh is there as soon as it's built; only its own mirror waits. So don't
        // wait for it: two waters reflecting each other (or both bare) would wait for ever.
        let ready = (el: GardenElement) => el instanceof GardenWater ? undefined : el.whenReady;
        if (!selector) {
            // Everything: wait for the scene's other elements (models load asynchronously).
            let sceneEl = this.getSceneEl();
            let others = sceneEl ? Array.from(sceneEl.querySelectorAll("*")).filter((el): el is GardenElement => el != this && el instanceof GardenElement) : [];
            await Promise.all(others.map(ready));
            return undefined;
        }
        let elements = resolveElements(selector).filter((el): el is GardenElement => el instanceof GardenElement);
        await Promise.all(elements.map(ready));
        let named = new Set<AbstractMesh>();
        for (let el of elements) {
            let node = el.getNode();
            if (!node) continue;
            if (node instanceof AbstractMesh) named.add(node);
            node.getChildMeshes(false).forEach(m => named.add(m));
        }
        return m => named.has(m);
    }

    protected dispose() {
        this.water?.dispose();
        this.water = null;
        super.dispose();
    }
}
