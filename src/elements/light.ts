/**
 * `import "juel-garden/elements/light"`: registers `<garden-light>` (and `<garden-scene>`, which it
 * lives in), for an app whose bundler should keep only the elements a page imports.
 * @example
 * ```ts
 * import "juel-garden/elements/light";
 * // <garden-scene embedded><garden-light intensity="0.8"></garden-light></garden-scene>
 * ```
 * @module elements/light
 */
import "./scene";
export * from "../Components/Light";
