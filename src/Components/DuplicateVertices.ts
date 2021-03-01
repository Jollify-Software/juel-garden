import { Mesh, VertexBuffer } from "babylonjs";
import { customElement } from "lit-element";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-duplicate-vertices")
export class GardenDuplicateVertices extends GardenElement {
    updated() {
        let scene = this.getScene();
        let mesh = (<GardenMesh>this.parentElement).mesh;
        let ins = Mesh.CreateSphere("sphere1", 32, 25, scene); // mesh.createInstance("copy");
        ins.isVisible = false;

        var v = mesh.getVerticesData(VertexBuffer.PositionKind);
        var fv = ins.getVerticesData(VertexBuffer.PositionKind);
        
        var t = 0.0;
        this.getScene().registerBeforeRender(function () {
    
            for (var i = 0; i < mesh.getTotalVertices(); i++) {
                var fx = fv[i * 3 + 0]; var fy = fv[i * 3 + 1]; var fz = fv[i * 3 + 2];
    
                v[i * 3 + 0] = fx + 0.33 * Math.sin(t * 2.15 + fy) + Math.cos(t * 1.45 + fz) + 1.5;
                v[i * 3 + 1] = fy + 0.36 * Math.cos(t * 1.15 + fz) + Math.sin(t * 1.45 + fx) + 1.5;
                v[i * 3 + 2] = fz + 0.39 * Math.sin(t * 1.15 + fx) + Math.cos(t * 1.45 + fy) + 1.5;
            }
            mesh.setVerticesData(VertexBuffer.PositionKind, v);
    
            t += 0.1;
        });
    }
}