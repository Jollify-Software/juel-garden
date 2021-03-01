import { Scene, StandardMaterial, Texture } from "babylonjs";
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
            material[`${prefix}Texture`] = new Texture(value, scene);
        }
    }
}