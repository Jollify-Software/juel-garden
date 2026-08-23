import { Vector3 } from "babylonjs";

/**
 * The minimal shape a generic Behaviour (`track`/`drive`/`suspension`/
 * `wander`/`flee-target`/`terrain` -- anything that only ever reads/writes
 * position and rotation) needs from whatever it's moving. A Babylon `Mesh`
 * already satisfies this as-is, so a {@link GardenMesh} needs no adapter at
 * all; {@link SpriteBehaviourTarget} adapts a single `<garden-sprite>`
 * instance to it instead. Behaviours needing more than this (`orbit`'s
 * scene-graph parenting, `action`'s `ActionManager`) stay typed against
 * `Mesh` directly rather than this interface -- see {@link Behaviours}.
 *
 * @category Core
 */
export interface IBehaviourTarget {
    position: Vector3;
    rotation: Vector3;
}
