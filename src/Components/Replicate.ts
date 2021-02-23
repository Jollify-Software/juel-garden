import { customElement, property } from "lit-element";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-replicate")
export class JuelReplicate extends GardenElement {

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