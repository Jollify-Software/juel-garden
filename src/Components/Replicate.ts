
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Creates cheap Babylon mesh *instances* (not clones -- shared geometry, GPU
 * instancing) of one or more existing elements' meshes at a set of
 * positions/rotations, for repeating a shape many times efficiently (e.g. a
 * field of identical rocks).
 *
 * Attributes: `instances` (ids of the source elements, indexed by position in
 * `positions`' `name:` prefix), `positions` (keyed `Vector3` list, e.g.
 * `"0: 1 0 1, 0: 3 0 1"` -- each entry's name is the index into `instances`),
 * `rotations` (keyed rotation list, same convention).
 *
 * @category Components
 */
@customElement("garden-replicate")
export class GardenReplicate extends GardenElement {

    @property({ type: Array }) instances: string[];
    @property() positions: string;
    @property() rotations: string;

    updated() {
        let els: GardenMesh[] = [];
        for (var id of this.instances) {
            els.push(
                document.getElementById(id) as GardenMesh
            );
        }
        let posRay = Vector3Convert.keyedArray(this.positions)
        let rotRay = Vector3Convert.keyedRotationArray(this.rotations);
        Promise.all(
            els.map(x => x.updateComplete)
        ).then(() => {
            let meshes = els.map(x => x.mesh);
            for (var i = 0; i < posRay.length; i++) {
                let pos = posRay[i];
                let rot = rotRay[i];
                let mesh = meshes[parseInt(pos.name)].createInstance(`mesh-instance-${i}`);
                mesh.position = pos.value;
                mesh.rotation = rot.value;
            }
        });
    }
}