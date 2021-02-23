import { Material, Mesh, Scene } from "babylonjs";
import { Behaviours } from "./Behaviours/Behaviours";
import { JuelAnimation } from "./Components/Animation";
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
    update() {
        if (this.mesh)
            this.mesh.dispose(); // TODO: We need replace, dispose will remove children

        this.createMesh()
        this.modifyMesh();
    }

    createMesh() {

    }

    modifyMesh(): void {
        if (this.mesh != null) {
            
            if (this.parentElement.hasAttribute("parent")) {
                this.mesh.parent = (<GardenMesh>this.parentElement).mesh;
             }
             
            Modifier.modifyMesh(this, this.mesh);
            Behaviours.applyBehaviours(this, this.mesh);

            
            setTimeout(() => {
                let loadAnimations = (<HTMLElement[]>Array.prototype.slice.call(this.children))
                    .filter(el => el.matches('juel-animation[event="load"]')) as JuelAnimation[];
                console.log(loadAnimations)
                for (var animation of loadAnimations) {
                    animation.play(this);
                }
            });
        }
    }
}