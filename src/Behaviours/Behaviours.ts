import { Mesh } from "babylonjs";
import { GardenElement } from "../GardenElement";
import { IBehaviourTarget } from "../IBehaviourTarget";
import { BehaviourAction } from "./BehaviourAction";
import { BehaviourDrive } from "./BehaviourDrive";
import { BehaviourFlee } from "./BehaviourFlee";
import { BehaviourFollow } from "./BehaviourFollow";
import { BehaviourOrbit } from "./BehaviourOrbit";
import { BehaviourSuspension } from "./BehaviourSuspension";
import { BehaviourTerrain } from "./BehaviourTerrain";
import { BehaviourTrack } from "./BehaviourTrack";
import { BehaviourWait } from "./BehaviourWait";
import { BehaviourWalk } from "./BehaviourWalk";
import { BehaviourWander } from "./BehaviourWander";

/**
 * Wires up any behaviour attribute present on an element's tag. Split into
 * two groups:
 *
 * - `generic` -- `track`/`drive`/`walk`/`follow`/`suspension`/`wander`/`flee-target`/
 *   `terrain` -- each needs nothing more than {@link IBehaviourTarget}'s
 *   `position`/`rotation`, so these run against a `GardenMesh`'s `Mesh`
 *   *or* one instance of a `<garden-sprite>` group (via
 *   {@link SpriteBehaviourTarget}), through {@link applyToTarget}.
 * - `meshOnly` -- `follow-wait` (see {@link BehaviourWait}), `orbit` (real
 *   scene-graph `.parent` reparenting) and `action` (a Babylon
 *   `ActionManager`) -- none has a sprite
 *   equivalent, so these stay real-`Mesh`-only, wired only from
 *   {@link applyBehaviours} (which `GardenMesh.modifyMesh` calls).
 *
 * `drive` and `walk` must come before `suspension`/`terrain` in `generic`: Babylon fires
 * `onBeforeRenderObservable` callbacks in registration order, and
 * suspension and terrain need this frame's moved position/heading, not
 * last frame's.
 *
 * See each behaviour's own doc comment for its specific attributes.
 *
 * @category Behaviours
 */
export module Behaviours {
    var generic = {
        'track': BehaviourTrack,
        'drive': BehaviourDrive,
        'walk': BehaviourWalk,
        'follow': BehaviourFollow,
        'suspension': BehaviourSuspension,
        'wander': BehaviourWander,
        'flee-target': BehaviourFlee,
        'terrain': BehaviourTerrain,
    }

    var meshOnly = {
        // First: it sets `waiting`, which track/wander/follow read this same frame.
        'follow-wait': BehaviourWait,
        'orbit': BehaviourOrbit,
        'action': BehaviourAction,
    }

    /** The `GardenMesh` entry point -- every behaviour, generic and mesh-only alike. */
    export var applyBehaviours = function (el: GardenElement, mesh: Mesh) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];

        for (let key in meshOnly) {
            let attr = collection.find(x => x.name == key);
            if (attr) {
                meshOnly[key](el, mesh, collection);
            }
        }

        applyToTarget(el, mesh, collection);
    }

    /**
     * The generic entry point -- just the position/rotation-only
     * behaviours, against any {@link IBehaviourTarget}. Called once per
     * placed sprite by {@link GardenSprite}, and by {@link applyBehaviours}
     * above (a `Mesh` already satisfies the interface as-is).
     */
    export var applyToTarget = function (el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
        for (let key in generic) {
            let a = attr.find(x => x.name == key);
            if (a) {
                generic[key](el, target, attr);
            }
        }
    }
}
