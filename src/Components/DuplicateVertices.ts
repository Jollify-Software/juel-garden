import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Experimental: continuously perturbs the parent mesh's vertex positions
 * every frame with a fixed sine/cosine wobble, for a jelly/liquid-like
 * animated surface effect. No configurable attributes yet -- the wobble
 * amplitude/speed are hardcoded.
 *
 * Its per-frame loop runs while the element is in the page: removed, the loop
 * stops and its hidden reference sphere is disposed. When the parent mesh is
 * built again (its own `colour` changes), the wobble moves to the new mesh.
 *
 * @example
 * ```html
 * <garden-sphere segments="32" diameter="2.5">
 *     <garden-duplicate-vertices></garden-duplicate-vertices>
 * </garden-sphere>
 * ```
 *
 * @category Components
 */
@customElement("garden-duplicate-vertices")
export class GardenDuplicateVertices extends GardenElement {
    updated() {
        let scene = this.getScene();
        let parent = <GardenMesh>this.parentElement;
        let mesh: Mesh, ins: Mesh, v: number[] | Float32Array, fv: number[] | Float32Array;
        // Takes the parent's current mesh: its own change (a new `colour`) builds a new one.
        let attach = () => {
            ins?.dispose();
            mesh = parent.mesh;
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
            ins = Mesh.CreateSphere("sphere1", 32, diameter, scene); // mesh.createInstance("copy");
            ins.isVisible = false;

            v = mesh.getVerticesData(VertexBuffer.PositionKind);
            fv = ins.getVerticesData(VertexBuffer.PositionKind);
        };
        attach();
        // Removed (or rebuilt), the loop stops and the hidden reference sphere goes with it.
        this.whenDisposed(() => ins.dispose());

        var t = 0.0;
        this.observe(scene.onBeforeRenderObservable, () => {
            // Between the parent's old mesh going and its new one arriving, skip the frame.
            if (!parent.mesh || parent.mesh.isDisposed())
                return;
            if (parent.mesh != mesh)
                attach();

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