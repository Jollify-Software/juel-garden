import { MeshBuilder } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

@customElement("juel-ground")
export class JuelGround extends GardenMesh {
    firstUpdated() {
        this.mesh = MeshBuilder.CreateGround("ground", OptionsBuilder.build(this));
        this.modifyMesh();
    }
}