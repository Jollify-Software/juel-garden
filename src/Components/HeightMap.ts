import { MeshBuilder } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-height-map")
export class GardenHeightMap extends GardenMesh {
    @property() url: string;
    updated() {
        this.setMesh(
            MeshBuilder.CreateGroundFromHeightMap("largeGround", this.url, 
            this.buildOptions(), this.getScene())
        );
    }
}