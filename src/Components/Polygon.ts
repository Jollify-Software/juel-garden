import { MeshBuilder } from "babylonjs";
import { GardenMesh } from "../GardenMesh";
import earcut from "earcut";
import { customElement, property } from "lit/decorators";

@customElement("garden-polygon")
export class GardenExtrude extends GardenMesh {
    @property({ type: Boolean }) extrude = false;

    updated() {
        if (this.extrude == true) {
            this.setMesh(
                MeshBuilder.ExtrudePolygon(
                this.id ?? "extrude",
                <any>this.buildOptions(),
                this.getScene(),
                earcut
            )
            );
        }
    }
}