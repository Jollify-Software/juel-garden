import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ModifyColourSetter } from "./ModifyColourSetter";
import { ModifyFloatSetter } from "./ModifyFloatSetter";
import { ModifyRotationSetter } from "./ModifyRotationSetter";
import { ModifyTextureSetter } from "./ModifyTextureSetter";
import { ModifyVector3Setter } from "./ModifyVector3Setter";

/**
 * Applies the visual/material attributes every {@link GardenMesh} shares
 * (`position`, `rotation`, `scale`, `colour` and friends, `texture` and
 * friends) onto a built Babylon mesh, dispatching each attribute to its
 * {@link ISetter}. Called by {@link GardenMesh.modifyMesh}.
 *
 * @category Modifiers
 */
export module Modifier {
    var map = {
        'position': ModifyVector3Setter('position'),
        'rotation': ModifyRotationSetter,
        'scale': ModifyVector3Setter('scale', 'scaling'),
        'colour': ModifyColourSetter(),
        'spec-colour': ModifyColourSetter("spec"),
        'emissive-colour': ModifyColourSetter("emissive"),
        'diffuse-colour': ModifyColourSetter("diffuse", "diffuse-colour"),
        'texture': ModifyTextureSetter(),
        'diffuse-texture': ModifyTextureSetter("diffuse", "diffuse-texture"),
        'texture-uscale': ModifyFloatSetter('texture-uscale', 'mat.diffuseTexture-uScale'),
        'texture-vscale': ModifyFloatSetter('texture-vscale', 'mat.diffuseTexture-vScale'),

        'bump-texture': ModifyTextureSetter("bump"),
        'bump-texture-uscale': ModifyFloatSetter('bump-texture-uscale', 'mat.bumpTexture-uScale'),
        'bump-texture-vscale': ModifyFloatSetter('bump-texture-vscale', 'mat.bumpTexture-vScale'),

        'reflection-texture': ModifyTextureSetter("reflection"),
        'reflection-texture-level': ModifyFloatSetter('reflection-texture-level', 'mat.reflectionTexture-level'),
        'reflection-texture-coordinates': ModifyFloatSetter('reflection-texture-coordinates', 'mat.reflectionTexture-coordinatesMode'),
    }

    export var modifyMesh = function(el: HTMLElement, mesh: Mesh, exclude: string[] = null) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};

        for (let key in map) {
            if (exclude && exclude.indexOf(key) >= 0) {
                continue;
            }
            let attr = collection.find(x => x.name == key);
            if (attr) {
                map[key](el, collection, options);
            }
        }
        for (let key in options) {
            mesh[key] = options[key];
        }
    }
}