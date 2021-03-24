import { Mesh, MeshBuilder, PolygonMeshBuilder, Vector2, Vector3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../../GardenMesh";
import earcut from "earcut";
import { ShapeFunctions } from "../../ShapeFunctions";
import { VertexData } from "babylonjs";
import { Utility } from "../../Utility";
import { StairsFunctions, StepType } from "../../ShapeFunctions/Stairs";

@customElement("garden-stairs")
export class GardenStairs extends GardenMesh {
    @property({ type: Number }) width: number = 4;
    @property({ type: Number }) height: number = 4;
    @property({ type: Number }) depth: number = 4;
    @property({ type: Number }) curvature: number;

    updated() {
        let scene = this.getScene();
        let mesh: Mesh;

        if (this.curvature) {
            mesh = StairsFunctions.curved(scene, this.height, this.width, StepType.STEP_HEIGHT, 2, .5, this.curvature);
        } else {
            mesh = StairsFunctions.straight(scene, this.width, this.height, this.depth, StepType.STEP_HEIGHT, 2, .5, true);
            //this.straightStairs();
        }

        if (mesh) {
            this.setMesh(
                mesh
            );
        }
    }

    straightStairs() {
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

    curvedStairs() {
        let scene = this.getScene();       
        let stepHeight = 0.5;

        let numSteps = (this.depth * 2) * stepHeight;
        let stepDepth = this.height / numSteps;
        let positions = ShapeFunctions.curvedStairs(this.height, this.width, "poop", numSteps, stepHeight, this.curvature, 10, false, true)
        .flatMap(x => [ x.x, x.y, x.z]);

        let mesh = new Mesh("stairs", scene);
        var v = new VertexData();
        v.positions = positions;
        v.indices = Utility.range(positions.length / 3);
        v.applyToMesh(mesh);
        
        //stairs.position = new Vector3(this.width/2, 0, 0);
        //var deg = 1.5708
        //stairs.rotation = new Vector3(0, deg * 2, deg);
        this.setMesh(mesh);
    }

    curbStaors() {
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

        const myPath = [];
        for(let i = 0; i < 100; i++) {
            const point = new Vector3(i / 5 - 10, i / 5 - 10, 0);
            myPath.push(point); 
        }
        
        let stairs = MeshBuilder.ExtrudeShape("star", {
            shape: v.map(p => new Vector3(0, p.y, p.x)),
            scale: 0.5,
            rotation: Math.PI / 5,
            path: myPath,
            sideOrientation: Mesh.DOUBLESIDE,
            updatable: true}, scene);
        stairs.position = new Vector3(this.width/2, 0, 0);
        var deg = 1.5708
        stairs.rotation = new Vector3(0, deg * 2, deg);
        this.setMesh(
            stairs
        );
    }

}