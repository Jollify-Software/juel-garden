import { MeshBuilder } from "babylonjs";
import { customElement, LitElement } from "lit-element";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

@customElement("juel-ground")
export class JuelGround extends GardenMesh {
    updated() {
        this.setMesh(
            MeshBuilder.CreateGround("ground", OptionsBuilder.build(this))
        );
    }
}