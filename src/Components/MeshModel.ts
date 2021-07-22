import { Mesh, SceneLoader } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";
import { GardenAnimation } from "./Animation";

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