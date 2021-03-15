import { GizmoManager, Mesh } from "babylonjs";
import { Node } from "babylonjs/node";
import bind from "bind-decorator";
import { customElement, property } from "lit-element";
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

        this.manager.gizmos.positionGizmo.onDragEndObservable
            .add(this.positionOnDragEnd);
        this.manager.gizmos.rotationGizmo.onDragEndObservable
            .add(this.positionOnDragEnd);
        this.manager.gizmos.scaleGizmo.onDragEndObservable
            .add(this.positionOnDragEnd);
    }

    enablePosition() {
        this.manager.positionGizmoEnabled = true;
        this.manager.rotationGizmoEnabled = false;
        this.manager.scaleGizmoEnabled = false;
        this.manager.boundingBoxGizmoEnabled = false;
    }

    enableRotation() {
        this.manager.positionGizmoEnabled = false;
        this.manager.rotationGizmoEnabled = true;
        this.manager.scaleGizmoEnabled = false;
        this.manager.boundingBoxGizmoEnabled = false;
    }

    enableScale() {
        this.manager.positionGizmoEnabled = false;
        this.manager.rotationGizmoEnabled = false;
        this.manager.scaleGizmoEnabled = true;
        this.manager.boundingBoxGizmoEnabled = false;
    }

    enablePBoundingBox() {
        this.manager.positionGizmoEnabled = false;
        this.manager.rotationGizmoEnabled = false;
        this.manager.scaleGizmoEnabled = false;
        this.manager.boundingBoxGizmoEnabled = true;
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
    positionOnDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("positiondragend", {
            detail: e
        });
        this.dispatchEvent(evt);
    }

    @bind
    rotationOnDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("rotationdragend", {
            detail: e
        });
        this.dispatchEvent(evt);
    }

    @bind
    scaleOnDragEnd(e) {
        this.ondragEnd();
        let evt = new CustomEvent("scaledragend", {
            detail: e
        });
        this.dispatchEvent(evt);
    }
}
