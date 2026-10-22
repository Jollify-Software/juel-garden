import { Camera } from "@babylonjs/core/Cameras/camera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

function worldPositionOf(obj: TransformNode | Camera): Vector3 {
    return obj instanceof TransformNode
        ? obj.getAbsolutePosition().clone()
        : obj.globalPosition.clone();
}

/** What {@link BehaviourOrbit} keeps on its element, so applying it again (each `modifyMesh`) reuses one pivot. */
interface OrbitState {
    mesh: Mesh;
    pivot: TransformNode;
}

/**
 * Continuously orbits the mesh around its parent element's position. Also
 * exposes `enter(obj)`/`leave(obj)` on the element (used by
 * {@link GardenWaypoint} to join/leave a camera to the same orbit while
 * preserving its world position).
 *
 * Attributes: `orbit-angle` (radians per frame, default `0.002`).
 *
 * The orbiting element's `position` is world-space, and it stays so when the
 * behaviour is applied again (`GardenMesh.modifyMesh` runs more than once, and
 * `position` is re-set in between): the pivot is made once per mesh. A parent
 * whose mesh isn't there yet (a `<garden-mesh-model>` still loading) is
 * waited for: the pivot starts at the parent's `position` attribute and
 * follows the parent's mesh once it exists.
 *
 * @example
 * ```html
 * <garden-sphere position="0 0 0" diameter="3">
 *   <garden-sphere id="moon" position="4 0 0" diameter="0.5" orbit orbit-angle="0.01"></garden-sphere>
 * </garden-sphere>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourOrbit(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    let parentEl = <GardenMesh>el.parentElement;
    let state: OrbitState = (<any>el).orbitState;
    let authored = (<GardenElement><unknown>el).position?.clone() ?? mesh.position.clone();

    // Applied again to the same mesh: keep the one pivot (and its rotation so far), and
    // re-express the authored world position relative to it -- assigning `position`
    // in between made it local to the pivot, lifting it by the parent's height.
    if (state && state.mesh == mesh) {
        if (!(<GardenElement><unknown>el).position)
            return; // nothing re-set it: mesh.position is still the local one
        state.pivot.computeWorldMatrix(true);
        mesh.position = Vector3.TransformCoordinates(authored, Matrix.Invert(state.pivot.getWorldMatrix()));
        return;
    }
    state?.pivot.dispose(true);

    let nodes: TransformNode[] = [];

    let scene = parentEl.getScene();
    let axis = new Vector3(0, -1, 0);
    let angle = Number(el.getAttribute("orbit-angle") ?? 0.002);

    let pivot = new TransformNode("root", scene);
    let centre = parentEl.mesh?.position ?? parentEl.position?.clone() ?? Vector3.Zero();
    pivot.position = centre;

    // mesh.position was authored as a world-space point (this framework only makes a
    // child's mesh relative to its parent's node when the parent has the `parent`
    // attribute, which the container here doesn't have) -- so re-express it relative to
    // the new pivot instead of adding the pivot's own offset on top of it a second time.
    mesh.position = authored.subtract(centre);
    mesh.parent = pivot;
    nodes.push(pivot);
    (<any>el).orbitState = <OrbitState>{ mesh, pivot };

    // The parent's mesh may come later (a model loading): then follow it. The pivot
    // shares the parent mesh's position vector, so a moving parent carries its orbit.
    if (!parentEl.mesh) {
        let watch = (<GardenElement>el).observe(scene.onBeforeRenderObservable, () => {
            if (!parentEl.mesh) return;
            scene.onBeforeRenderObservable.remove(watch);
            let world = mesh.getAbsolutePosition().clone();
            pivot.position = parentEl.mesh.position;
            pivot.computeWorldMatrix(true);
            mesh.position = Vector3.TransformCoordinates(world, Matrix.Invert(pivot.getWorldMatrix()));
        });
    }

    /***************************************************************/
    (<any>el).enter = (obj: TransformNode | Camera) => {
        if (obj instanceof TransformNode) {
            nodes.push(obj);
        } else {
            // Plain `.parent =` assignment doesn't preserve world position -- the camera's
            // existing (world-space) position would otherwise be silently reinterpreted as
            // a local offset from the pivot, teleporting it. Recompute the local position
            // that keeps it exactly where it already is.
            let worldPosition = worldPositionOf(obj);
            obj.parent = pivot;
            pivot.computeWorldMatrix(true);
            obj.position = Vector3.TransformCoordinates(worldPosition, Matrix.Invert(pivot.getWorldMatrix()));
        }
    }
    (<any>el).leave = (obj: TransformNode | Camera) => {
        if (obj instanceof TransformNode) {
            nodes = nodes.filter(x => x != obj);
        } else {
            let worldPosition = worldPositionOf(obj);
            obj.parent = null;
            obj.position = worldPosition;
        }
    }

    /**************Animation of Rotation**********/
    let rotate = (<GardenElement>el).observe(scene.onAfterRenderObservable, function () {
        if (pivot.isDisposed()) {
            scene.onAfterRenderObservable.remove(rotate);
            return;
        }
        for (let node of nodes) {
            node.rotate(axis, angle, Space.LOCAL);
        }
    });
}
