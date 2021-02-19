import { Mesh, Scene } from "babylonjs";
import { GardenElement } from "./GardenElement";
import { Modifier } from "./Modifiers/Modifier";

export class GardenMesh extends GardenElement {
    mesh: Mesh;

    getPosition() {
        return this.mesh.position;
    }
    getRotation() {
        return this.mesh.rotation;
    }
    getScale() {
        return this.mesh.scaling;
    }

    getScene(): Scene {
        if ('getScene' in this.parentElement) {
            return (<any>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    modifyMesh(): void {
        Modifier.modifyMesh(this, this.mesh);
    }
}