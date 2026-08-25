import { MeshBuilder, StandardMaterial, CubeTexture, Texture, Color3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * A skybox: a large inward-facing cube with a cubemap reflection texture.
 *
 * Attributes: `root` (the cubemap's base URL/filename prefix, as Babylon's
 * `CubeTexture` expects it), `size` (plus the common {@link GardenMesh} set,
 * though colour/texture attributes are not used here -- the skybox always
 * uses `root`).
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