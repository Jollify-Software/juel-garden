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
this.setMesh(skybox);
    }
}