import { MeshBuilder, StandardMaterial, CubeTexture, Texture, Color3, Tools } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A skybox: a large inward-facing cube with a cubemap reflection texture.
 *
 * Attributes: `root` (the cubemap's base URL/filename prefix, as Babylon's
 * `CubeTexture` expects it), `size` (plus the common {@link GardenMesh} set,
 * though colour/texture attributes are not used here -- the skybox always
 * uses `root`), `scroll-speed` (degrees/second -- continuously spins the
 * cubemap around Y via `CubeTexture.rotationY`, the property Babylon itself
 * exposes for rotating a reflection/panorama in place. Since the skybox mesh
 * is centred on the camera (`infiniteDistance`), this reads as the whole
 * starfield/backdrop sliding past a stationary viewer -- a cheap way to fake
 * forward motion through a scene with nothing else to judge speed against,
 * e.g. a starship "flying" through space).
 *
 * @example
 * ```html
 * <garden-sky root="https://playground.babylonjs.com/textures/skybox" size="150"></garden-sky>
 * ```
 *
 * @category Components
 */
@customElement("garden-sky")
export class GardenSky extends GardenMesh {
    @property() root: string;
    @property({ type: Number, attribute: "scroll-speed" }) scrollSpeed: number;

    updated() {
        let scene = this.getScene();

        const skybox = MeshBuilder.CreateBox("skyBox", this.buildOptions(), scene);
const skyboxMaterial = new StandardMaterial("skyBox", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.reflectionTexture = new CubeTexture(this.root, scene);
skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
skyboxMaterial.specularColor = new Color3(0, 0, 0);
skybox.material = skyboxMaterial;

if (this.scrollSpeed) {
    let reflection = <CubeTexture>skyboxMaterial.reflectionTexture;
    let engine = scene.getEngine();
    let radiansPerSecond = Tools.ToRadians(this.scrollSpeed);
    scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        reflection.rotationY -= radiansPerSecond * dt;
    });
}
// Without this, the skybox is just a normal fixed-size cube at the origin -- any
// camera that ends up further from the origin than the box's own half-size (a
// camera `radius`/`position` bigger than half of `size`, easy to hit on a large
// scene) sits outside it entirely, seeing a bizarre close-up sliver of its
// exterior wall instead of being enclosed by it. This is Babylon's standard
// skybox recipe: render it as if infinitely far away, always surrounding
// whatever camera is active regardless of that camera's actual position.
skybox.infiniteDistance = true;
this.setMesh(skybox);
    }
}