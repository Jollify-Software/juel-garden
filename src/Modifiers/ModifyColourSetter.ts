import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Material } from "@babylonjs/core/Materials/material";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3Convert } from "../Converters/Color3Convert";
import { ISetter } from "../ISetter";

/**
 * {@link ISetter} factory for a mesh's material colour (`colour`,
 * `spec-colour`, `emissive-colour`) -- parses `#hex`, `"r g b"`, or a named
 * colour (see {@link Color3Convert}), creating a `StandardMaterial` on the
 * mesh first if it doesn't have one yet.
 *
 * @category Modifiers
 */
export var ModifyColourSetter = (prefix: string = "diffuse", attribute?: string): ISetter => {
    return function (el: HTMLElement, attr: Attr[], options: object) {
        // `attribute` names the one this setter is registered for when it isn't the
        // default (`diffuse-colour` is a diffuse setter, but not the `colour` attribute).
        let at = attribute ?? (prefix == "diffuse" ? "colour" : `${prefix}-colour`);
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
                // StandardMaterial calls it `specularColor`, not `specColor`: a plain
                // `${prefix}Color` set a property nothing reads, so `spec-colour` did nothing.
                material[prefix == "spec" ? "specularColor" : `${prefix}Color`] = colour;
            }
        }
    }
}