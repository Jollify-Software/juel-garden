import { MeshBuilder } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

@customElement("garden-ground")
export class GardenGround extends GardenMesh {
    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateGround(this.id ?? "ground", options, scene)
        );
        super.updated();
    }
}