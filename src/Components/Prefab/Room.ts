import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-room")
export class GardenRoom extends GardenMesh {
    @property({ type: Number }) width: number = 4;
    @property({ type: Number }) height: number = 2;
    @property({ type: Number }) depth: number = 8;
    @property({ type: Number }) thickness: number = 0.2;
    
    updated() {
        let scene = this.getScene();
        let hh = this.height / 2;
        let ht = this.thickness / 2;
        let dt = this.thickness * 2;

        let floor = MeshBuilder.CreateBox("floor", {
            width: this.width,
            height: this.thickness,
            depth: this.depth
        }, scene);
        let mat2 = new StandardMaterial("mat", scene);
        mat2.diffuseColor = Color3.Black();
        floor.material = mat2;

        let wallN = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene)
        wallN.position = new Vector3(0, hh, (this.depth / 2) - (this.thickness / 2));
        let mat1 = new StandardMaterial("mat", scene);
        mat1.diffuseColor = Color3.Green();
        wallN.material = mat1;

        let wallE = MeshBuilder.CreateBox("wall-north", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene)
        wallE.position = new Vector3((this.width / 2) - (this.thickness / 2), hh, 0);
        let mat = new StandardMaterial("mat", scene);
        mat.diffuseColor = Color3.Red();
        wallE.material = mat;

        let wallS = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene)
        wallS.position = new Vector3(0, hh, -(this.depth / 2) + (this.thickness / 2));
        let mat4 = new StandardMaterial("mat", scene);
        mat4.diffuseColor = Color3.Blue();
        wallS.material = mat4;

        let wallW = MeshBuilder.CreateBox("wall-north", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene)
        wallW.position = new Vector3(-(this.width / 2) + (this.thickness / 2), hh, 0);
        let mat3 = new StandardMaterial("mat", scene);
        mat3.diffuseColor = Color3.Yellow();
        wallW.material = mat3;

        this.setMesh(
            Mesh.MergeMeshes([ floor, wallN, wallE, wallS, wallW ], true, true, undefined, false, true)
        )
    }
}