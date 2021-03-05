import { Mesh, MeshBuilder, PolygonMeshBuilder, Vector2, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../../GardenMesh";
import earcut from "earcut";

@customElement("garden-stairs")
export class GardenStairs extends GardenMesh {
    @property({ type: Number }) width: number = 4;
    @property({ type: Number }) height: number = 4;
    @property({ type: Number }) depth: number = 4;

    updated() {
        let scene = this.getScene();
        
        let stepHeight = 0.5;

        let numSteps = (this.depth * 2) * stepHeight;
        let stepDepth = this.height / numSteps;

        let v: Vector2[] = [];
        let p = new Vector2(this.height, this.depth/ (numSteps * stepHeight));
        v.push(new Vector2(p.x, p.y));
        for (let i=0;i<numSteps;i++) {
            p = p.add(new Vector2(0, stepHeight));
            v.push(new Vector2(p.x, p.y));
            p = p.add(new Vector2(-stepDepth, 0));
            v.push(new Vector2(p.x, p.y));
        }
        v.push(new Vector2(0, 0));
        v.push(new Vector2(this.height, 0));
        const sb = new PolygonMeshBuilder("stairs", v, scene, earcut);
        let stairs = sb.build(false, this.width);
        stairs.position = new Vector3(this.width/2, 0, 0);
        var deg = 1.5708
        stairs.rotation = new Vector3(0, deg * 2, deg);
        this.setMesh(
            stairs
        );
    }
}