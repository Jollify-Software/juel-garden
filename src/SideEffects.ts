// Babylon's ES modules register some scene features only when their module is
// imported ("side effects"). The library imports each class it uses from its
// own module; these are the features it uses through the scene instead. Without
// them an app bundling juel-garden from npm (rather than the global bundle,
// which carries all of Babylon) fails with "X needs to be imported".
import "@babylonjs/core/Animations/animatable";             // scene.beginAnimation
import "@babylonjs/core/Loading/loadingScreen";             // engine.displayLoadingUI
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent"; // scene.enablePhysics
import "@babylonjs/core/Particles/particleSystemComponent"; // particle systems in the scene
import "@babylonjs/core/Sprites/spriteSceneComponent";      // sprite picking
import "@babylonjs/core/Collisions/collisionCoordinator";  // moveWithCollisions, camera collisions
import "@babylonjs/core/Culling/ray";                       // picking
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent"; // shadows
import "@babylonjs/core/Rendering/outlineRenderer";         // <garden-link> hover outline
import "@babylonjs/core/Rendering/boundingBoxRenderer";
import "@babylonjs/core/Helpers/sceneHelpers";              // createDefaultXRExperienceAsync, default env
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/core/Materials/Textures/Procedurals/noiseProceduralTexture"; // effect="fire" (ParticleHelper presets)
import "@babylonjs/core/Loading/Plugins/babylonFileLoader";    // <garden-mesh-model src="*.babylon">
