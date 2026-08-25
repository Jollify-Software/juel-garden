import { Mesh, VertexBuffer } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Experimental: continuously perturbs the parent mesh's vertex positions
 * every frame with a fixed sine/cosine wobble, for a jelly/liquid-like
 * animated surface effect. No configurable attributes yet -- the wobble
 * amplitude/speed are hardcoded.
 *
 * @category Components
 */
@customElement("garden-duplicate-vertices")
export class GardenDuplicateVertices extends GardenElement {
    updated() {
        let scene = this.getScene();
        let mesh = (<GardenMesh>this.parentElement).mesh;
        // The reference sphere's per-vertex positions (fx/fy/fz below) become the
        // deformed mesh's actual coordinates, replacing its own -- a hardcoded
        // diameter here previously always produced a diameter-25 result regardless
        // of the real mesh's size (a diameter-2.5 sphere came out 10x too big).
        // boundingSphere.radius is the radius of the sphere that circumscribes the
        // bounding *box* (overshoots an actual sphere mesh's true radius by sqrt(3))
        // -- the box's own half-extent is the mesh's real radius. Segment count is
        // still hardcoded to 32, matching this component's typical use -- a mismatch
        // there would misalign vertex indices between the two meshes.
        let diameter = mesh.getBoundingInfo().boundingBox.extendSize.x * 2;
        let ins = Mesh.CreateSphere("sphere1", 32, diameter, scene); // mesh.createInstance("copy");
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