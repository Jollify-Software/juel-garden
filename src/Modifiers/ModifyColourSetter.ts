import { Color3, Material, Scene, StandardMaterial, Vector3 } from "babylonjs";
import { Color3Convert } from "../Converters/Color3Convert";
import { ISetter } from "../ISetter";

export var ModifyColourSetter = (prefix: string = "diffuse"): ISetter => {
    return function (el: HTMLElement, attr: Attr[], options: object) {
        let at = prefix == "diffuse" ? "colour" : `${prefix}-colour`;
        let value = attr.find(x => x.name == at).value;
        let colour: Color3 = null;
        if (value.startsWith('#')) {
            colour = Color3.FromHexString(value);
        } else if (value.indexOf(' ') > 0) {
            colour = Color3Convert.fromString(value);
        } else {
            colour = Color3Convert.fromName(value);
        }

        if (colour) {
            let scene: Scene = (<any>el).getScene();
            let material: StandardMaterial;
            if ('getMaterial' in el) {
                material = (<any>el).getMaterial() as StandardMaterial
                if (!material) {
                    material = new StandardMaterial('material', scene);
                    (<any>el).setMaterial(material);
                }
                material[`${prefix}Color`] = colour;
            }
        }
    }
}