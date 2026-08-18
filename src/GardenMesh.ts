import { Material, Mesh, PointerEventTypes, Scene, TransformNode, Vector3 } from "babylonjs";
import { CSG } from "babylonjs";
import { MeshBuilder } from "babylonjs";
import { property } from "lit/decorators";
import { Behaviours } from "./Behaviours/Behaviours";
import { GardenAnimation } from "./Components/Animation";
import { GardenParticle } from "./Components/Particle";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { GardenElement } from "./GardenElement";
import { GardenMaterial } from "./Components/Material";
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
        return this.mesh?.getAbsolutePosition().clone();
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
        let orphans: TransformNode[] = [];
        if (this.mesh) {
            orphans = this.mesh.getChildTransformNodes(true).concat(this.mesh.getChildMeshes(true));
            this.mesh.dispose(true); // doNotRecurse: children are re-parented below, not destroyed
        }

        if (this.hasAttribute("split")) {
            mesh = this.splitMesh(mesh, this.split);
        }
        if (this.hasAttribute("hollow")) {
            mesh = this.hollowMesh(mesh, this.hollow ?? GardenMesh.defaultHollowScale);
        }

        for (let orphan of orphans) {
            orphan.parent = mesh;
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


            setTimeout(async () => {
                let scene = this.getScene();
                let animations: GardenAnimation[] = [];
                let particles: GardenParticle[] = [];

                for (let el of (<HTMLElement[]>Array.prototype.slice.call(this.children))) {
                    if (el.matches('garden-animation')) {
                        animations.push(el as GardenAnimation);
                    } else if (el.matches('garden-particle')) {
                        particles.push(el as GardenParticle);
                    } else if (el.matches('garden-material') && !el.hasAttribute('slot')) {
                        // Meshes with more than one material (e.g. GardenRoof's dome)
                        // read their own slot-tagged <garden-material> children directly,
                        // before the mesh is even built -- this generic path only covers
                        // the common single-material case, applied after the fact. Must
                        // await the element's own build (whenReady) before reading its
                        // .material -- this setTimeout(0) callback can otherwise fire
                        // before <garden-material>'s own async updated() (which itself
                        // waits on document-ready plus any <garden-texture> children) has
                        // produced anything, silently applying `undefined` and leaving the
                        // mesh on Babylon's default grey material.
                        let materialEl = el as GardenMaterial;
                        await materialEl.whenReady;
                        this.setMaterial(materialEl.material);
                    }
                }

                for (var animation of animations) {
                    // Mirrors the garden-particle event switch just below: an explicit
                    // event="load" auto-plays, anything else (e.g. unset, for a
                    // <garden-button target="..."> to trigger) waits to be played on demand.
                    if (animation.event === "load")
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