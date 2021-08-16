import { GizmoManager, Mesh } from "babylonjs";
import { AbstractMesh } from "babylonjs/Meshes/abstractMesh";
import { Node } from "babylonjs/node";
import bind from "bind-decorator";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-gizmo")
export class GardenGizmo extends GardenElement {
    @property({ converter: (str) => str?.split(' ') }) elements: string[];
    @property({ type: Number }) thickness = 4;
    @property({ converter: (str) => str?.split(' ') }) gizmos: string[];

    manager: GizmoManager;

    updated() {
        let meshes: Mesh[] = []
        let nodes: Node[] = [];
        if (this.elements) {
            for (let sel of this.elements) {
                let el = document.querySelector(sel) as GardenElement;
                if ('mesh' in el) {
                    meshes.push((<GardenMesh>el).mesh);
                } else {
                    nodes.push(el.node);
                }
            }
        }
        this.manager = new GizmoManager(this.getScene(), this.thickness);
        if (meshes) {
            this.manager.attachableMeshes = meshes;
        }
        if (nodes) {
            this.manager.attachableNodes = nodes;
        }
    }

    enablePosition() {
        this.manager.positionGizmoEnabled = true;
        this.clearRotationEvents();
        this.manager.rotationGizmoEnabled = false;
        this.clearScaleEvents();
        this.manager.scaleGizmoEnabled = false;
        this.clearBoundingBoxEvents();
        this.manager.boundingBoxGizmoEnabled = false;

        if (this.manager.gizmos.positionGizmo) {
            this.manager.gizmos.positionGizmo.onDragEndObservable
                .add(this.positionDragEnd);
        }
    }

    clearPositionEvents() {
        if (this.manager.gizmos.positionGizmo) {
            this.manager.gizmos.positionGizmo.onDragEndObservable.clear();
        }
    }

    enableRotation() {
        this.clearPositionEvents();
        this.manager.positionGizmoEnabled = false;
        this.manager.rotationGizmoEnabled = true;
        this.clearScaleEvents();
        this.manager.scaleGizmoEnabled = false;
        this.clearBoundingBoxEvents();
        this.manager.boundingBoxGizmoEnabled = false;

        if (this.manager.gizmos.rotationGizmo) {
            this.manager.gizmos.rotationGizmo.onDragEndObservable
                .add(this.rotationDragEnd);
        }
    }

    clearRotationEvents() {
        if (this.manager.gizmos.rotationGizmo) {
            this.manager.gizmos.rotationGizmo.onDragEndObservable.clear();
        }
    }

    enableScale() {
        this.clearPositionEvents();
        this.manager.positionGizmoEnabled = false;
        this.clearRotationEvents();
        this.manager.rotationGizmoEnabled = false;
        this.manager.scaleGizmoEnabled = true;
        this.clearBoundingBoxEvents();
        this.manager.boundingBoxGizmoEnabled = false;

        if (this.manager.gizmos.scaleGizmo) {
            this.manager.gizmos.scaleGizmo.onDragEndObservable
                .add(this.positionDragEnd);
        }
    }

    clearScaleEvents() {
        if (this.manager.gizmos.scaleGizmo) {
            this.manager.gizmos.scaleGizmo.onDragEndObservable.clear();
        }
    }

    enableBoundingBox() {
        this.clearPositionEvents();
        this.manager.positionGizmoEnabled = false;
        this.clearRotationEvents();
        this.manager.rotationGizmoEnabled = false;
        this.clearScaleEvents();
        this.manager.scaleGizmoEnabled = false;
        this.manager.boundingBoxGizmoEnabled = true;

        if (this.manager.gizmos.boundingBoxGizmo) {
            this.manager.gizmos.boundingBoxGizmo.onRotationSphereDragEndObservable
            .add(this.rotationDragEnd);
        this.manager.gizmos.boundingBoxGizmo.onScaleBoxDragEndObservable
            .add(this.scaleDragEnd);
        }
    }

    clearBoundingBoxEvents() {
        if (this.manager.gizmos.boundingBoxGizmo) {
            this.manager.gizmos.boundingBoxGizmo.onRotationSphereDragEndObservable
            .clear();
        this.manager.gizmos.boundingBoxGizmo.onScaleBoxDragEndObservable
            .clear();
        }
    }

    addElement(el: GardenElement) {
        if ('mesh' in el)
            this.manager.attachToMesh((<GardenMesh>el).mesh);
        else
            this.manager.attachToNode(el.node);
    }

    ondragEnd() {
        let evt = new CustomEvent("dragend");
        this.dispatchEvent(evt);
    }

    @bind
    positionDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("position-dragend", {
            detail: this.manager.attachableMeshes.map((x: AbstractMesh) => {
                return {
                    "name": x.name,
                    "vector": x.position
                };
            })
        });
        this.dispatchEvent(evt);
    }

    @bind
    rotationDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("rotation-dragend", {
            detail: this.manager.attachableMeshes.map((x: AbstractMesh) => {
                return {
                    "name": x.name,
                    "vector": x.rotation
                };
            })
        });
        this.dispatchEvent(evt);
    }

    @bind
    scaleDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("scale-dragend", {
            detail: this.manager.attachableMeshes.map((x: AbstractMesh) => {
                return {
                    "name": x.name,
                    "vector": x.scaling
                };
            })
        });
        this.dispatchEvent(evt);
    }
}
