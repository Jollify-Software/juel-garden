import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HtmlTexture } from "../HtmlTexture";
import type { GardenMesh } from "../GardenMesh";
import { ISetter } from "../ISetter";

/**
 * {@link ISetter} factory for a mesh's material texture (`texture`,
 * `bump-texture`, `reflection-texture`, ...) -- `texture="html"` renders the
 * element's own light-DOM content instead, via {@link HtmlTexture}.
 *
 * @category Modifiers
 */
export var ModifyTextureSetter = (prefix: string = "diffuse", attribute?: string): ISetter => {
    return function (el: HTMLElement, attr: Attr[]) {
        // `attribute` names the one this setter is registered for when it isn't the
        // default (`diffuse-texture` is a diffuse setter, but not the `texture` attribute).
        let at = attribute ?? (prefix == "diffuse" ? "texture" : `${prefix}-texture`);
        let value = attr.find(x => x.name == at).value;
        let scene: Scene = (<any>el).getScene();
        let material: StandardMaterial;
        if ('getMaterial' in el) {
            material = (<any>el).getMaterial() as StandardMaterial
            if (!material) {
                material = new StandardMaterial('material', scene);
                (<any>el).setMaterial(material);
            }
            if (value == "html") {
                let htmlTexture = new HtmlTexture(<GardenMesh><unknown>el, prefix);
                material[`${prefix}Texture`] = htmlTexture.texture;
            } else {
                material[`${prefix}Texture`] = new Texture(value, scene);
            }
        }
    }
}