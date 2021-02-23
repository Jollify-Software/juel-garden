import { MeshBuilder } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-height-map")
export class JuelHeightMap extends GardenMesh {
    @property() url: string;
    updated() {
        this.setMesh(
            MeshBuilder.CreateGroundFromHeightMap("largeGround", this.url, 
            this.buildOptions(), this.getScene())
        );
    }
}