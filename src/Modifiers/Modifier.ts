import { Mesh } from "babylonjs";
import { ModifyRotationSetter } from "./ModifyRotationSetter";
import { ModifyVector3Setter } from "./ModifyVector3Setter";

export module Modifier {
    var map = {
        'position': ModifyVector3Setter('position'),
        'rotation': ModifyRotationSetter,
        'scale': ModifyVector3Setter('scale', 'scaling')
    }

    export var modifyMesh = function(el: HTMLElement, mesh: Mesh) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};

        for (let key in map) {
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