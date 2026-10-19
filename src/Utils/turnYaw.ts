/**
 * Turns a yaw (radians) towards `wanted` by at most `maxStep`, the short way
 * round. Used by the behaviours that turn a mesh to face where it is going.
 *
 * @category Utilities
 */
export function turnYaw(current: number, wanted: number, maxStep: number): number {
    let delta = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
    return current + (Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep);
}
