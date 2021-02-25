import { Mesh } from "babylonjs";
import { BehaviourOrbit } from "./BehaviourOrbit";
import { BehaviourTrack } from "./BehaviourTrack";

export module Behaviours {
    var map = {
        'track': BehaviourTrack,
        'orbit': BehaviourOrbit
    }

    export var applyBehaviours = function(el: HTMLElement, mesh: Mesh) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};

        for (let key in map) {
            let attr = collection.find(x => x.name == key);
            if (attr) {
                map[key](el, collection);
            }
        }
    }
}