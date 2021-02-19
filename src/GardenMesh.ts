import { Mesh } from "babylonjs";
import { GardenElement } from "./GardenElement";
import { Modifier } from "./Modifiers/Modifier";

export class GardenMesh extends GardenElement {
    mesh: Mesh;

    modifyMesh(): void {
        Modifier.modifyMesh(this, this.mesh);
    }
}