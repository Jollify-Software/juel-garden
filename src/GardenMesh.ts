import { Material, Mesh, PointerEventTypes, Scene, TransformNode, Vector3 } from "babylonjs";
import { CSG } from "babylonjs";
import { MeshBuilder } from "babylonjs";
import { property } from "lit-element";
import { Behaviours } from "./Behaviours/Behaviours";
import { JuelAnimation } from "./Components/Animation";
import { JuelParticle } from "./Components/Particle";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { GardenElement } from "./GardenElement";
import { Modifier } from "./Modifiers/Modifier";

export abstract class GardenMesh extends GardenElement {
    static defaultHollowScale = new Vector3(.75, .75, .75);

    @property({ converter: Vector3Convert.fromString }) hollow: Vector3;
    @property() split: string;

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

        if (this.hasAttribute("split")) {
            mesh = this.splitMesh(mesh, this.split);
        }
        if (this.hasAttribute("hollow")) {
            mesh = this.hollowMesh(mesh, this.hollow ?? GardenMesh.defaultHollowScale);
        }

        (<any>mesh).element = this;
        this.mesh = mesh;
        this.modifyMesh();

        if (this.hasAttribute("collisions"))
            this.mesh.checkCollisions = true;
    }

    hollowMesh(mesh: Mesh, hollowScale: Vector3) {
        console.log(hollowScale)
        let clone = mesh.clone("hollowClone");
        clone.scaling = hollowScale;
        let toReturn = CSG.FromMesh(mesh)
            .subtract(CSG.FromMesh(clone))
                .toMesh(mesh.id, mesh.material, this.getScene());
        clone.dispose();
        mesh.dispose();
        return toReturn;
    }

    splitMesh(mesh: Mesh, splitty: string) {
        let bounds = mesh.getBoundingInfo();
        let vectorsWorld = bounds.boundingBox.vectorsWorld; 
        let width = Number(vectorsWorld[1].x-(vectorsWorld[0].x));
        let height = Number(vectorsWorld[1].y-(vectorsWorld[0].y));
        let depth = Number(vectorsWorld[1].z-(vectorsWorld[0].z));
        let splittyMesh: Mesh;
        switch (splitty) {
            default:
            case 'half':
                splittyMesh = MeshBuilder.CreateBox("splittyMesh", {
                    width: width,
                    height: height,
                    depth: depth
                });
                splittyMesh.position.y = -(height/2);
                break;
        
        }
        let toReturn = CSG.FromMesh(mesh)
            .subtract(CSG.FromMesh(splittyMesh))
            .toMesh(mesh.id, mesh.material, this.getScene(), true);
        mesh.dispose();
        splittyMesh.dispose();
        return toReturn;
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