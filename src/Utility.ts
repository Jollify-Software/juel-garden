import { GardenScene } from "./Components/Scene";
import { toJSON } from 'cssjson';
import { Mesh, Tools, TransformNode } from "babylonjs";
import { GardenElement } from "./GardenElement";

export module Utility {
    export var getFloat = (s: string, rotation = false) => {
        if (s.indexOf('(') >= 0) {
            return (new Function('Math', `return ${s}`))(Math) as number;
        } else {
            return rotation ? Tools.ToRadians(parseFloat(s)) : parseFloat(s);
        }
    }
    export var capitalize = (s) => {
        if (typeof s !== 'string') return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    export var getPropertyValue = (obj: object, property: string) => {
        if (property.indexOf('.') > 0) {
            var splitty = property.split('.');
            for (var p of splitty) {
                if (p in obj) {
                    console.log(p)
                    obj = obj[p];
                } else {
                    return null;
                }
            }
                return obj;
        } else {
            if (property in obj) {
                return obj[property];
            } else {
                return null;
            }
        }
    }
    export var applyRules = (sceneEl: GardenScene) => {
        let styles = document.getElementById("garden-styles") as HTMLStyleElement;
        if (styles) {
            let toUpdate: GardenElement[] = [];
            let props = toJSON(styles.textContent);
            if ('children' in props) {
                for (var selector in props.children) {
                    console.log(selector)
                    let obj = props.children[selector];
                    if ('attributes' in obj) {
                        let attributes = obj.attributes;
                        let elements = sceneEl.querySelectorAll(selector);
                        for (let el of elements) {
                        if (el && 'update' in el) {
                            for (var attr in attributes) {
                                (<any>el).setAttribute(attr, attributes[attr]);
                            }
                            if (!toUpdate.some(x => x == el)) {
                                toUpdate.push(el as GardenElement);
                            }
                        }
                    }
                    }
                }
            }
            if (toUpdate) {
                toUpdate.forEach(el => {
                    el.update();
                })
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