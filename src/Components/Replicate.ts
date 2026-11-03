
import { customElement, property } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Creates cheap Babylon mesh *instances* (not clones -- shared geometry, GPU
 * instancing) of one or more existing elements' meshes at a set of
 * positions/rotations, for repeating a shape many times efficiently (e.g. a
 * field of identical rocks).
 *
 * Attributes: `instances` (ids of the source elements, space-separated or a JSON
 * array, indexed by position in
 * `positions`' `name:` prefix), `positions` (keyed `Vector3` list, e.g.
 * `"0: 1 0 1, 0: 3 0 1"` -- each entry's name is the index into `instances`),
 * `rotations` (keyed rotation list, same convention; optional). Without `instances` or
 * `positions` it makes nothing (with a console warning).
 *
 * The sources may appear anywhere in the document (before or after this
 * element): it waits for the document to finish parsing and for each source
 * mesh to be built. An id that names no element logs a warning.
 *
 * @category Components
 */
@customElement("garden-replicate")
export class GardenReplicate extends GardenElement {

    /** The source ids: `"rock"`, `"house semi"`, or as JSON, `'["house","semi"]'`. */
    @property({ converter: (value: string) => value?.trim().startsWith("[") ? JSON.parse(value) : (value ?? "").split(/[\s,]+/).filter(Boolean) })
    instances: string[];
    @property() positions: string;
    @property() rotations: string;

    async updated() {
        // The source elements may come later in the markup than this one, so they may
        // not be parsed (or built) yet: wait for the document, then for each of them.
        await GardenElement.whenDocumentReady();
        if (!this.instances?.length || !this.positions?.trim()) {
            console.warn("garden-replicate: needs `instances` and `positions`, so nothing is made");
            return;
        }
        let els: GardenMesh[] = [];
        for (var id of this.instances) {
            let el = document.getElementById(id) as GardenMesh;
            if (!el) {
                console.warn(`garden-replicate: no element with id "${id}"`);
                return;
            }
            els.push(el);
        }
        let posRay = Vector3Convert.keyedArray(this.positions)
        let rotRay = this.rotations?.trim() ? Vector3Convert.keyedRotationArray(this.rotations) : [];
        Promise.all(
            els.map(x => x.whenReady)
        ).then(() => {
            let meshes = els.map(x => x.mesh);
            for (var i = 0; i < posRay.length; i++) {
                let pos = posRay[i];
                let rot = rotRay[i];
                let mesh = meshes[parseInt(pos.name)].createInstance(`mesh-instance-${i}`);
                mesh.position = pos.value;
                if (rot) mesh.rotation = rot.value;
            }
        });
    }
}