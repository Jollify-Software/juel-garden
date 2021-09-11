import { Material, Mesh, PointerEventTypes, Scene, TransformNode, Vector3 } from "babylonjs";
import { CSG } from "babylonjs";
import { MeshBuilder } from "babylonjs";
import { property } from "lit/decorators";
import { Behaviours } from "./Behaviours/Behaviours";
import { GardenAnimation } from "./Components/Animation";
import { GardenParticle } from "./Components/Particle";
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

    update() {
        if (!this.node)
            return;

        if (this.position)
            this.mesh.position = this.position;
        if (this.rotation)
            this.mesh.rotation = this.rotation;
        if (this.scale)
            this.mesh.scaling = this.scale;

        this.modifyMesh([ "position", "rotation", "scale" ]);
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

    modifyMesh(exclude: string[] = null): void {
        if (this.mesh != null) {

            if (this.parentElement.hasAttribute("parent")) {
                console.log("parent")
                this.mesh.parent = (<GardenElement>this.parentElement).getNode();
            }

            Modifier.modifyMesh(this, this.mesh, exclude);
            Behaviours.applyBehaviours(this, this.mesh);


            setTimeout(() => {
                let scene = this.getScene();
                let animations: GardenAnimation[] = [];
                let particles: GardenParticle[] = [];

                (<HTMLElement[]>Array.prototype.slice.call(this.children))
                    .forEach(el => {
                        if (el.matches('garden-animation')) {
                            animations.push(el as GardenAnimation);
                        } else if (el.matches('garden-particle')) {
                            particles.push(el as GardenParticle);
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