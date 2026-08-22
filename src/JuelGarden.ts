import { Scene } from "babylonjs";

/**
 * A single shared slot for the active Babylon `Scene`. Not populated by
 * {@link GardenScene} itself today (each `<garden-scene>` keeps its own
 * `.scene` property) -- present for code that needs a scene reference without
 * an element to hand.
 *
 * @category Core
 */
export module JuelGarden {
    export var scene: Scene
}