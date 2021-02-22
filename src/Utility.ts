import { JuelScene } from "./Components/Scene";
import { toJSON } from 'cssjson';;

export module Utility {
    export var capitalize = (s) => {
        if (typeof s !== 'string') return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
    export var applyRules = (sceneEl: JuelScene) => {
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
}