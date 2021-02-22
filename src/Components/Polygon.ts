import { MeshBuilder } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";
import earcut from "earcut";

@customElement("juel-polygon")
export class JuelExtrude extends GardenMesh {
    @property({ type: Boolean }) extrude = false;

    update() {
        if (this.extrude == true) {
            if (this.mesh)
                this.mesh.dispose(); // TODO: We need replace, dispose will remove children

            this.mesh = MeshBuilder.ExtrudePolygon(
                this.id ?? "extrude",
                <any>this.buildOptions(),
                this.getScene(),
                earcut
            );
            this.modifyMesh();
        }
    }
}