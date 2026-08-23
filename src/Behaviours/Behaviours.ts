import { Mesh } from "babylonjs";
import { GardenElement } from "../GardenElement";
import { IBehaviourTarget } from "../IBehaviourTarget";
import { BehaviourAction } from "./BehaviourAction";
import { BehaviourDrive } from "./BehaviourDrive";
import { BehaviourFlee } from "./BehaviourFlee";
import { BehaviourOrbit } from "./BehaviourOrbit";
import { BehaviourSuspension } from "./BehaviourSuspension";
import { BehaviourTerrain } from "./BehaviourTerrain";
import { BehaviourTrack } from "./BehaviourTrack";
import { BehaviourWander } from "./BehaviourWander";

/**
 * Wires up any behaviour attribute present on an element's tag. Split into
 * two groups:
 *
 * - `generic` -- `track`/`drive`/`suspension`/`wander`/`flee-target`/
 *   `terrain` -- each needs nothing more than {@link IBehaviourTarget}'s
 *   `position`/`rotation`, so these run against a `GardenMesh`'s `Mesh`
 *   *or* one instance of a `<garden-sprite>` group (via
 *   {@link SpriteBehaviourTarget}), through {@link applyToTarget}.
 * - `meshOnly` -- `orbit` (real scene-graph `.parent` reparenting) and
 *   `action` (a Babylon `ActionManager`) -- neither has a sprite
 *   equivalent, so these stay real-`Mesh`-only, wired only from
 *   {@link applyBehaviours} (which `GardenMesh.modifyMesh` calls).
 *
 * `drive` must come before `suspension` in `generic`: Babylon fires
 * `onBeforeRenderObservable` callbacks in registration order, and
 * suspension needs this frame's drive-updated position/heading, not last
 * frame's.
 *
 * See each behaviour's own doc comment for its specific attributes.
 *
 * @category Behaviours
 */
export module Behaviours {
    var generic = {
        'track': BehaviourTrack,
        'drive': BehaviourDrive,
        'suspension': BehaviourSuspension,
        'wander': BehaviourWander,
        'flee-target': BehaviourFlee,
        'terrain': BehaviourTerrain,
    }

    var meshOnly = {
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
