import { Scene, StandardMaterial, Texture } from "babylonjs";
import { HtmlTexture } from "../HtmlTexture";
import { ISetter } from "../ISetter";

export var ModifyTextureSetter = (prefix: string = "diffuse"): ISetter => {
    return function (el: HTMLElement, attr: Attr[]) {
        let at = prefix == "diffuse" ? "texture" : `${prefix}-texture`;
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
                let htmlTexture = new HtmlTexture(el);
                material[`${prefix}Texture`] = htmlTexture.texture;
            } else {
                material[`${prefix}Texture`] = new Texture(value, scene);
            }
        }
    }
}