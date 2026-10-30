/**
 * `import "juel-garden/elements/camera"`: registers `<garden-camera>` (and `<garden-scene>`, which it
 * lives in), for an app whose bundler should keep only the elements a page imports.
 * @example
 * ```ts
 * import "juel-garden/elements/camera";
 * // <garden-scene embedded><garden-camera type="arc" radius="1" near="0.01"></garden-camera></garden-scene>
 * ```
 * @module elements/camera
 */
import "./scene";
export * from "../Components/Camera";
