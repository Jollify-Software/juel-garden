import { CSG } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * A CSG (constructive solid geometry) operation between this element's parent
 * mesh and another mesh by id -- `subtract`/`subtractTo`/`intersect`, via
 * Babylon's `CSG`.
 *
 * Attributes: `subtract` (id of a mesh to subtract from the parent, result
 * replaces this element's own mesh), `subtractto` (id of a mesh to subtract
 * *this* element's parent from, mutating that other element instead),
 * `intersect` (id of a mesh to intersect with the parent).
 *
 * The operand may appear anywhere in the document (before or after this
 * element): the operation waits for the document to finish parsing and for
 * both meshes to be built. An id that names no mesh logs a warning.
 *
 * @category Components
 */
@customElement("garden-boolean")
export class GardenBoolean extends GardenMesh {
    @property() subtract: string;
    @property() subtractTo: string;
    @property() intersect: string;

    updated() {
        setTimeout(async () => {
        if ('mesh' in this.parentElement) {
            // The operand named by id may come later in the markup than this
            // element, so it may not be parsed (or built) yet: wait for the
            // document, then for the parent and the operand to finish building.
            await GardenElement.whenDocumentReady();
            let operandId = this.subtract || this.subtractTo || this.intersect;
            let otherMesh = operandId ? document.getElementById(operandId) as GardenMesh : null;
            if (operandId && !otherMesh?.mesh) {
                await otherMesh?.whenReady;
            }
            if (operandId && !otherMesh?.mesh) {
                console.warn(`garden-boolean: no mesh with id "${operandId}"`);
                return;
            }
            await (<GardenMesh>this.parentElement).whenReady;
            let scene = this.getScene();
            let csg = CSG.FromMesh((<GardenMesh>this.parentElement).mesh);

            if (this.subtract) {
                this.setMesh(csg.subtract(
                   CSG.FromMesh(otherMesh.mesh)
                ).toMesh(this.id ?? "csg", null, scene));
            } else if (this.subtractTo) {
                let otherCsg = CSG.FromMesh(otherMesh.mesh);
                otherMesh.setMesh(otherCsg.subtract(
                   csg
                ).toMesh(otherMesh.id ?? "csg", null, scene));
            } else if (this.intersect) {
                this.setMesh(csg.intersect(
                   CSG.FromMesh(otherMesh.mesh)
                ).toMesh(this.id ?? "csg", null, scene));
            }

            this.modifyMesh()
        }
    });
    }
}