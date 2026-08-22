import { Mesh } from "babylonjs";
import { BehaviourAction } from "./BehaviourAction";
import { BehaviourDrive } from "./BehaviourDrive";
import { BehaviourOrbit } from "./BehaviourOrbit";
import { BehaviourSuspension } from "./BehaviourSuspension";
import { BehaviourTrack } from "./BehaviourTrack";

export module Behaviours {
    var map = {
        'track': BehaviourTrack,
        'orbit': BehaviourOrbit,
        'action': BehaviourAction,
        // 'drive' must come before 'suspension': Babylon fires onBeforeRenderObservable
        // callbacks in registration order, and suspension needs this frame's
        // drive-updated position/heading, not last frame's.
        'drive': BehaviourDrive,
        'suspension': BehaviourSuspension
    }

    export var applyBehaviours = function(el: HTMLElement, mesh: Mesh) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};

        for (let key in map) {
            let attr = collection.find(x => x.name == key);
            if (attr) {
                map[key](el, mesh, collection);
            }
        }
    }
}