import { Mesh, MeshBuilder, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-stairs")
export class GardenStairs extends GardenMesh {
    @property({ type: Number }) width: number;
    @property({ type: Number }) height: number;
    @property({ type: Number }) depth: number;

    updated() {
        let boxes: Mesh[] = [];
        let numSteps = 10;
        let stepHeight = 0.5;
        for (let i=1;i<(this.height / stepHeight);i+=stepHeight) {
            let b = MeshBuilder.CreateBox("b" + i, {
                width: 4,
                height: stepHeight * i,
                depth: 0.1
            });
            let xz = ((stepHeight * i) / 2) - (this.height / 2);
            b.position = new Vector3(0, xz, xz)
            boxes.push(b);
        }
        this.setMesh(
            Mesh.MergeMeshes(boxes)
        )
    }
}