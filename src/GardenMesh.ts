import { Material, Mesh, PointerEventTypes, Scene, TransformNode, Vector3 } from "babylonjs";
import { Behaviours } from "./Behaviours/Behaviours";
import { JuelAnimation } from "./Components/Animation";
import { JuelParticle } from "./Components/Particle";
import { GardenElement } from "./GardenElement";
import { Modifier } from "./Modifiers/Modifier";

export abstract class GardenMesh extends GardenElement {
    mesh: Mesh;

    getNode(): TransformNode {
        return this.mesh;
    }

    getPosition() {
        return this.mesh?.position;
    }
    getRotation() {
        return this.mesh?.rotation;
    }
    getScale() {
        return this.mesh?.scaling;
    }

    setPosition(position: Vector3) {
        this.mesh.position = position;
    }
    setRotation(rotation: Vector3) {
        this.mesh.rotation = rotation;
    }
    setScale(scale: Vector3) {
        this.mesh.scaling = scale;
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

    setMesh(mesh: Mesh) {
        if (this.mesh)
            this.mesh.dispose(); // TODO: We need replace, dispose will remove children

        (<any>mesh).element = this;
        this.mesh = mesh;
        this.modifyMesh();

        if (this.hasAttribute("collisions"))
            this.mesh.checkCollisions = true;
    }

    modifyMesh(): void {
        if (this.mesh != null) {

            if (this.parentElement.hasAttribute("parent")) {
                this.mesh.parent = (<GardenElement>this.parentElement).getNode();
            }

            Modifier.modifyMesh(this, this.mesh);
            Behaviours.applyBehaviours(this, this.mesh);


            setTimeout(() => {
                let scene = this.getScene();
                let animations: JuelAnimation[] = [];
                let particles: JuelParticle[] = [];

                (<HTMLElement[]>Array.prototype.slice.call(this.children))
                    .forEach(el => {
                        if (el.matches('juel-animation')) {
                            animations.push(el as JuelAnimation);
                        } else if (el.matches('juel-particle')) {
                            particles.push(el as JuelParticle);
                        }
                    });

                for (var animation of animations) {
                    animation.play(this);
                }

                for (var p of particles) {
                    switch (p.event) {
                        case "load":
                            p.play();
                            break;
                        case "pointerdown":
                            scene.onPointerObservable.add((pointerInfo) => {            
                                switch (pointerInfo.type) {
                                    case PointerEventTypes.POINTERDOWN:
                                        if(pointerInfo.pickInfo.hit &&
                                            pointerInfo.pickInfo.pickedMesh == this.mesh) {
                                            p.toggle();
                                        }
                                    break;
                                }
                            });
                        default:
                            break;
                    }
                }
            });
        }
    }
}