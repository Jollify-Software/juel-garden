import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-room")
export class GardenRoom extends GardenMesh {
    @property({ type: Number }) width: number = 4;
    @property({ type: Number }) height: number = 2;
    @property({ type: Number }) depth: number = 8;
    
    updated() {
        let scene = this.getScene();

        let floor = MeshBuilder.CreateBox("floor", {
            width: this.width,
            height: 0.2,
            depth: this.depth
        }, scene);
        let mat2 = new StandardMaterial("mat", scene);
        mat2.diffuseColor = Color3.Black();
        floor.material = mat2;

        let wallN = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height,
            depth: 0.2
        }, scene)
        wallN.position = new Vector3(0, (this.height / 2), (this.depth / 2) + 0.1);
        let mat1 = new StandardMaterial("mat", scene);
        mat1.diffuseColor = Color3.Green();
        wallN.material = mat1;

        let wallE = MeshBuilder.CreateBox("wall-north", {
            width: 0.2,
            height: this.height,
            depth: this.depth
        }, scene)
        wallE.position = new Vector3((this.width / 2) + 0.1, (this.height / 2), 0);
        let mat = new StandardMaterial("mat", scene);
        mat.diffuseColor = Color3.Red();
        wallE.material = mat;

        let wallS = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height,
            depth: 0.2
        }, scene)
        wallS.position = new Vector3(0, (this.height / 2), -(this.depth / 2) - 0.1);
        let mat4 = new StandardMaterial("mat", scene);
        mat4.diffuseColor = Color3.Blue();
        wallS.material = mat4;

        let wallW = MeshBuilder.CreateBox("wall-north", {
            width: 0.2,
            height: this.height,
            depth: this.depth
        }, scene)
        wallW.position = new Vector3(-(this.width / 2) - 0.1, (this.height / 2), 0);
        let mat3 = new StandardMaterial("mat", scene);
        mat3.diffuseColor = Color3.Yellow();
        wallW.material = mat3;

        this.setMesh(
            Mesh.MergeMeshes([ floor, wallN, wallE, wallS, wallW ], true, true, undefined, false, true)
        )
    }
}