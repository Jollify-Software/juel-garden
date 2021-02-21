import { Material, Mesh, Scene } from "babylonjs";
import { Behaviours } from "./Behaviours/Behaviours";
import { GardenElement } from "./GardenElement";
import { Modifier } from "./Modifiers/Modifier";

export class GardenMesh extends GardenElement {
    mesh: Mesh;

    getPosition() {
        return this.mesh?.position;
    }
    getRotation() {
        return this.mesh?.rotation;
    }
    getScale() {
        return this.mesh?.scaling;
    }

    getMaterial() {
        return this.mesh?.material;
    }
    setMaterial(material: Material) {
        this.mesh.material = material;
    }

    getScene(): Scene {
        if ('getScene' in this.parentElement) {
            return (<any>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    modifyMesh(): void {
        if (this.mesh != null) {
            Modifier.modifyMesh(this, this.mesh);
            Behaviours.applyBehaviours(this, this.mesh);
        }
        if (this.parentElement.hasAttribute("parent")) {
           this.mesh = (<GardenMesh>this.parentElement).mesh;
        }
    }
}