import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { PoseLayer } from "./PoseLayer";

/**
 * A wave, for {@link waveLayer}. The bones and turns default to the Unreal-style rig that
 * Quaternius's Universal Animation Library and Universal Base Characters use (`upperarm_r`,
 * `lowerarm_r`, `index_01_r`…; found by measuring where the hand goes). For another rig, give
 * its bone names and turns.
 */
export interface WaveOptions {
    /** Which hand waves: `"r"` (default) or `"l"`. */
    side?: "l" | "r";
    /** The upper arm's and forearm's bone names (default `upperarm_<side>`, `lowerarm_<side>`). */
    upper?: string;
    lower?: string;
    /** The finger bones opened from a fist (default the Unreal rig's `index_01_r`… for the side). */
    fingers?: RegExp;
    /** The upper arm raised, the forearm bent up, and its sway from side to side (radians, local x/y/z). */
    arm?: Vector3;
    fore?: Vector3;
    swing?: Vector3;
    /** Sways a second (radians per second of the sway's sine). Default 7. */
    speed?: number;
    /** Where in its sway it starts (so a crowd doesn't wave in step). Default random. */
    phase?: number;
}

/**
 * A wave over whatever the model is doing (an idle, a walk): the arm raised, the forearm up and
 * swaying, the hand open. A {@link PoseLayer} that starts lowered (`target` 0): set `target` to
 * 1 to wave and 0 to stop, and it fades in and out.
 *
 * @example
 * ```ts
 * const wave = waveLayer(scene, model.skeleton, { side: "l" });
 * wave.target = 1;
 * ```
 *
 * @category Characters
 */
export function waveLayer(scene: Scene, skeleton: Skeleton, options: WaveOptions = {}): PoseLayer {
    let side = options.side ?? "r";
    let mirror = side == "l" ? -1 : 1;
    let arm = options.arm ?? new Vector3(0, 0, -1.9 * mirror);
    let fore = options.fore ?? new Vector3(0, 0, side == "l" ? 1.0 : -1.2);
    let swing = options.swing ?? new Vector3(0, 0, 0.45);
    let speed = options.speed ?? 7;
    let phase = options.phase ?? Math.random() * 6;
    let sway = () => fore.add(swing.scale(Math.sin(performance.now() / 1000 * speed + phase)));
    return new PoseLayer(scene, skeleton, { weight: 0, target: 0 })
        .turn(options.upper ?? `upperarm_${side}`, arm)
        .turn(options.lower ?? `lowerarm_${side}`, sway)
        .rest(options.fingers ?? new RegExp(`^(index|middle|ring|pinky|thumb)_0[1-3]_${side}$`));
}
