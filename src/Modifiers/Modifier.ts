import { Mesh } from "babylonjs";
import { ModifyPositionSetter } from "./ModifyPositionSetter";
import { ModifyRotationSetter } from "./ModifyRotationSetter";
import { ModifyScaleSetter } from "./ModifyScaleSetter";

export module Modifier {
    var map = {
        'position': ModifyPositionSetter,
        'rotation': ModifyRotationSetter,
        'scale': ModifyScaleSetter
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