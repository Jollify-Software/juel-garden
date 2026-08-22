import { Mesh, SceneLoader } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";
import { GardenAnimation } from "./Animation";

/**
 * Imports an external 3D model file (glTF, .babylon, OBJ, ...) via Babylon's
 * `SceneLoader.ImportMeshAsync`. A {@link GardenSkeletonMesh}, so an imported
 * rig's skeleton is picked up automatically for `<garden-animation type="skeleton">`.
 *
 * Attributes: `root` (base URL), `filename`, `meshnames` (which meshes to
 * import, empty/`"*"` for all).
 *
 * @example
 * ```html
 * <garden-mesh-model root="https://models.example.com/" filename="car.glb"></garden-mesh-model>
 * ```
 *
 * @category Components
 */
@customElement("garden-mesh-model")
export class GardenMeshModel extends GardenSkeletonMesh {
    @property() meshNames: string;
    @property() root: string;
    @property() filename: string;

    updated() {
        let scene = this.getScene();
        SceneLoader.ImportMeshAsync(this.meshNames, this.root, this.filename, scene).then((result) => {
            this.setMesh(
                result.meshes[0] as Mesh
            );
            if (result.skeletons.length > 0) {
                this.skeleton = result.skeletons[0];
            }
        });
    }
}