import { Mesh, SceneLoader } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";
import { JuelAnimation } from "./Animation";

@customElement("juel-mesh-model")
export class JuelMeshModel extends GardenSkeletonMesh {
    @property() meshNames: string;
    @property() root: string;
    @property() filename: string;

    createMesh() {
        let scene = this.getScene();
        SceneLoader.ImportMeshAsync(this.meshNames, this.root, this.filename, scene).then((result) => {
            this.mesh = result.meshes[0] as Mesh;
            this.modifyMesh();
            if (result.skeletons.length > 0) {
                this.skeleton = result.skeletons[0];
            }
        });
    }
}