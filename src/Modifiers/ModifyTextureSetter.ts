import { Scene, StandardMaterial, Texture } from "babylonjs";
import { ISetter } from "../ISetter";

export var ModifyTextureSetter: ISetter = function (el: HTMLElement, attr: Attr[]) {
    let value = attr.find(x => x.name == 'texture').value;
    let scene: Scene = (<any>el).getScene();
    let material: StandardMaterial;
    if ('getMaterial' in el) {
        material = (<any>el).getMaterial() as StandardMaterial
        if (!material) {
            material = new StandardMaterial('material', scene);
            (<any>el).setMaterial(material);
        }
        material.diffuseTexture = new Texture(value, scene);
    }
}