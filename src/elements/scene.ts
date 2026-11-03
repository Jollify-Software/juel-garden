/**
 * `import "juel-garden/elements/scene"`: registers `<garden-scene>` alone, with the scene
 * features it and the viewer's elements use through the scene, for an app whose bundler should
 * keep only the elements a page imports. `import "juel-garden"` registers every element (and
 * imports every scene feature, `src/SideEffects.ts`); both can be imported in one app.
 * @example
 * ```ts
 * import "juel-garden/elements/scene";
 * // <garden-scene embedded style="height: 300px"></garden-scene>
 * ```
 * @module elements/scene
 */
import "@babylonjs/core/Animations/animatable";             // animation groups, scene.beginAnimation
import "@babylonjs/core/Loading/loadingScreen";             // engine.displayLoadingUI
import "@babylonjs/core/Collisions/collisionCoordinator";  // camera collisions
import "@babylonjs/core/Culling/ray";                       // picking
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent"; // <garden-light shadows>
import "@babylonjs/core/Rendering/boundingBoxRenderer";
export * from "../Components/Scene";
