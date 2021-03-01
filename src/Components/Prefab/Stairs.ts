import { Mesh, MeshBuilder, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-stairs")
export class GardenStairs extends GardenMesh {
    @property({ type: Number }) width: number;
    @property({ type: Number }) height: number = 40;
    @property({ type: Number }) depth: number;

    updated() {
        let boxes: Mesh[] = [];
        let numSteps = 10;
        for (let i=0;i<(this.height / numSteps);i++) {
            let b = MeshBuilder.CreateBox("b" + i, {
                width: 4,
                height: (1 + i),
                depth: 1
            });
            b.position = new Vector3(0, 0 + i, 0 + i)
            boxes.push(b);
        }
        this.setMesh(
            Mesh.MergeMeshes(boxes)
        )
    }
}