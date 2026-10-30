import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Node } from "@babylonjs/core/node";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Editor-style drag gizmos (position/rotation/scale/bounding-box handles) for
 * one or more meshes/nodes, via Babylon's `GizmoManager`. Dispatches
 * `position-dragend`/`rotation-dragend`/`scale-dragend`/`dragend` DOM events
 * with the affected elements' resulting values, so a host page can persist
 * edits made in-scene.
 *
 * Attributes: `elements` (space-separated selectors of the meshes/nodes to
 * attach), `thickness`, `gizmos`.
 *
 * The elements may appear anywhere in the document (before or after this
 * element): it waits for the document to finish parsing and for each of them
 * to be built. A selector that matches no garden element logs a warning.
 *
 * @category Components
 */
@customElement("garden-gizmo")
export class GardenGizmo extends GardenElement {
    @property({ converter: (str) => str?.split(' ') }) elements: string[];
    @property({ type: Number }) thickness = 4;
    @property({ converter: (str) => str?.split(' ') }) gizmos: string[];

    manager: GizmoManager;

    async updated() {
        // The elements may come later in the markup than this one, so they may not be
        // parsed (or built) yet: wait for the document, then for each of them.
        await GardenElement.whenDocumentReady();
        let meshes: Mesh[] = []
        let nodes: Node[] = [];
        if (this.elements) {
            for (let sel of this.elements) {
                let el = document.querySelector(sel) as GardenElement;
                if (!(el instanceof GardenElement)) {
                    console.warn(`garden-gizmo: no garden element matches "${sel}"`);
                    continue;
                }
                await el.whenReady;
                if ('mesh' in el) {
                    meshes.push((<GardenMesh>el).mesh);
                } else {
                    nodes.push(el.node);
                }
            }
        }
        // Removed for good while it waited for its elements.
        if (!this.isConnected)
            return;
        // A rebuild for a changed attribute: the old manager goes (its handles and pointer
        // observers stayed otherwise, one more set on each change), and the gizmo that was
        // on comes back on the new one.
        let old = this.manager;
        let on = !old ? null : old.positionGizmoEnabled ? "position" : old.rotationGizmoEnabled ? "rotation"
            : old.scaleGizmoEnabled ? "scale" : old.boundingBoxGizmoEnabled ? "boundingBox" : null;
        if (old)
            GardenGizmo.disposeManager(old);
        this.manager = new GizmoManager(this.getScene(), this.thickness);
        if (meshes.length) {
            this.manager.attachableMeshes = meshes;
            // Without an initial attach, a freshly-enabled gizmo (e.g. clicking
            // "Position") has nothing to attach to until the user separately
            // clicks the mesh in the viewport -- attach the first one up front
            // so enabling a gizmo shows handles immediately.
            this.manager.attachToMesh(meshes[0]);
        }
        if (nodes.length) {
            this.manager.attachableNodes = nodes;
            this.manager.attachToNode(nodes[0]);
        }
        if (on == "position") this.enablePosition();
        else if (on == "rotation") this.enableRotation();
        else if (on == "scale") this.enableScale();
        else if (on == "boundingBox") this.enableBoundingBox();
    }

    /** Removed for good: the manager, its handles and its pointer observers leave the scene. */
    protected dispose() {
        if (this.manager)
            GardenGizmo.disposeManager(this.manager);
        this.manager = null;
        super.dispose();
    }

    /**
     * Disposes `manager` with both its pointer observers. Babylon's `dispose()` removes them
     * from the scene's observable, but the gizmo-axis one is on the utility layer's scene, so
     * one stayed there for each manager made.
     */
    private static disposeManager(manager: GizmoManager) {
        let observers = (<any>manager)._pointerObservers ?? [];
        manager.dispose();
        for (let observer of observers)
            manager.utilityLayer.utilityLayerScene.onPointerObservable.remove(observer);
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

    // The drag-end handlers are arrow functions: passed to Babylon observables as callbacks, they must keep `this`.
    positionDragEnd = (e) => {
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

    rotationDragEnd = (e) => {
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

    scaleDragEnd = (e) => {
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
