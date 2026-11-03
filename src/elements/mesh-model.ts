/**
 * `import "juel-garden/elements/mesh-model"`: registers `<garden-mesh-model>` (and `<garden-scene>`, which it
 * lives in), for an app whose bundler should keep only the elements a page imports.
 * @example
 * ```ts
 * import "juel-garden/elements/camera";
 * import "juel-garden/elements/light";
 * import "juel-garden/elements/mesh-model";
 * // <garden-scene embedded> <garden-camera type="arc"></garden-camera> <garden-light></garden-light>
 * //   <garden-mesh-model src="box.glb" animation="none"></garden-mesh-model> </garden-scene>
 * ```
 * @module elements/mesh-model
 */
import "./scene";
export * from "../Components/MeshModel";
