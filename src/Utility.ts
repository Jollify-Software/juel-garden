import { GardenScene } from "./Components/Scene";
import { toJSON } from 'cssjson'; import { Mesh, TransformNode } from "babylonjs";
;

export module Utility {
    export var capitalize = (s) => {
        if (typeof s !== 'string') return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
    export var applyRules = (sceneEl: GardenScene) => {
        let styles = document.getElementById("rules") as HTMLStyleElement;
        if (styles) {
            let props = toJSON(styles.textContent);
            if ('children' in props) {
                for (var selector in props.children) {
                    let obj = props.children[selector];
                    if ('attributes' in obj) {
                        let attributes = obj.attributes;
                        let el = sceneEl.querySelector(selector);
                        if (el && 'update' in el) {
                            for (var attr in attributes) {
                                (<any>el).setAttribute(attr, attributes[attr]);
                            }
                            (<any>el).update();
                        }
                    }
                }
            }
        }
    }
    export var range = (start, stop?, step?) => {
        if (typeof stop == 'undefined') {
            // one param defined
            stop = start;
            start = 0;
        }
    
        if (typeof step == 'undefined') {
            step = 1;
        }
    
        if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
            return [];
        }
    
        var result = [];
        for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
            result.push(i);
        }
        return result;
    }    
    export var nodeFromMesh = (mesh: Mesh, node: TransformNode = null) => {
        if (!node)
            node = new TransformNode("node", mesh.getScene());

        node.position = mesh.position;
        node.rotation = mesh.rotation;
        node.scaling = mesh.scaling;
        return node;
    }
}