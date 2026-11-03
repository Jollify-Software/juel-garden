import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Scene } from "@babylonjs/core/scene";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";

/**
 * A glow round the bright parts of meshes: Babylon's `GlowLayer` on the scene. By default
 * a mesh glows with its material's emissive colour (and emissive texture); a
 * `<garden-material glow>` makes the meshes wearing it glow with the material itself,
 * which a node material needs (it has no emissive colour of its own), and its
 * `glow-input` names an input block that is 1 while the glow is drawn and 0 otherwise,
 * so one material can draw its glow differently from its surface. See
 * {@link "Components/Material"!GardenMaterial}.
 *
 * Attributes: `intensity` (default 1), `texture-size` (the glow's texture in pixels, a
 * fixed size; unset, a share of the screen), `blur` (Babylon's `blurKernelSize`, default
 * 32: bigger spreads the glow further). One per scene. A change builds the layer again.
 * `element.layer` is the Babylon `GlowLayer`; {@link GardenGlow.layerOf} finds a scene's.
 *
 * @example
 * ```html
 * <garden-glow intensity="1.25" texture-size="1024" blur="64"></garden-glow>
 * ```
 *
 * @category Components
 */
@customElement("garden-glow")
export class GardenGlow extends GardenElement {
    layer: GlowLayer;

    private static layers = new WeakMap<Scene, GlowLayer>();

    /** The scene's glow layer (from a `<garden-glow>`), or null while it has none. */
    static layerOf(scene: Scene): GlowLayer | null {
        return GardenGlow.layers.get(scene) ?? null;
    }

    updated() {
        let scene = this.getScene();
        if (!scene)
            return;
        this.disposeLayer();
        let number = (name: string) => {
            let value = Number(this.getAttribute(name));
            return this.getAttribute(name) && Number.isFinite(value) ? value : undefined;
        };
        let size = number("texture-size");
        this.layer = new GlowLayer(this.id || "glow", scene, {
            mainTextureFixedSize: size > 0 ? size : undefined,
            blurKernelSize: number("blur") ?? 32,
        });
        this.layer.intensity = number("intensity") ?? 1;
        GardenGlow.layers.set(scene, this.layer);
        let layer = this.layer;
        this.whenDisposed(() => {
            if (GardenGlow.layers.get(scene) == layer)
                GardenGlow.layers.delete(scene);
            this.disposeLayer();
        });
    }

    private disposeLayer() {
        this.layer?.dispose();
        this.layer = null;
    }
}
