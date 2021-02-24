import { MeshBuilder } from "babylonjs";
import { customElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("juel-lathe")
export class JuelLathe extends GardenMesh {
    updated() {
        let scene = this.getScene();
        this.setMesh(
            MeshBuilder.CreateLathe("fountain", <any>this.buildOptions(), scene)
        );
    }
}