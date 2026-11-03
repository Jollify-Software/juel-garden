// The viewer bundle (`npm run build:viewer` -> dist/juel-garden-viewer.js): only what
// <garden-model-viewer> needs -- <garden-scene>, <garden-camera>, <garden-light> and
// <garden-mesh-model> (with the glTF, OBJ and STL loaders and the decoders; not the .babylon
// loader, ~330 KB) -- for a page that shows a model and nothing else. A page that uses any
// other <garden-*> element loads juel-garden.js instead. Unlike juel-garden.js there is no window.BABYLON; the classes are
// window.JuelGarden, as there. Tools/build-viewer.mjs builds it.

// The scene features they use through the scene are imported by src/elements/scene.ts (the full
// bundle imports all of src/SideEffects.ts instead).
export * from "./src/GardenElement";
export * from "./src/GardenMesh";
export * from "./src/GardenSkeletonMesh";
export * from "./src/AnimationMixer";
export * from "./src/elements/scene";
export * from "./src/elements/camera";
export * from "./src/elements/light";
export * from "./src/elements/mesh-model";
export * from "./src/elements/model-viewer";
