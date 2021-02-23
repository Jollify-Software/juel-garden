import { MeshBuilder } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";
import earcut from "earcut";

@customElement("juel-polygon")
export class JuelExtrude extends GardenMesh {
    @property({ type: Boolean }) extrude = false;

    createMesh() {
        if (this.extrude == true) {
            this.mesh = MeshBuilder.ExtrudePolygon(
                this.id ?? "extrude",
                <any>this.buildOptions(),
                this.getScene(),
                earcut
            );
        }
    }
}