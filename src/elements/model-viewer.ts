/**
 * `import "juel-garden/elements/model-viewer"`: registers `<garden-model-viewer>` and the elements
 * it builds inside itself (`<garden-scene>`, `<garden-camera>`, `<garden-light>`,
 * `<garden-mesh-model>`), for an app that shows a model in a page and should not ship the rest of
 * juel-garden. The global-script equivalent is `dist/juel-garden-viewer.js`.
 * @example
 * ```ts
 * import "juel-garden/elements/model-viewer";
 * document.body.insertAdjacentHTML("beforeend", `<garden-model-viewer src="box.glb"></garden-model-viewer>`);
 * ```
 * @module elements/model-viewer
 */
import "./scene";
import "./camera";
import "./light";
import "./mesh-model";
export * from "../Components/ModelViewer";
