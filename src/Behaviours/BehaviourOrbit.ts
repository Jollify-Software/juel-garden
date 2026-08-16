import { Camera, Matrix, Mesh, Space, TransformNode, Vector3 } from "babylonjs";
import { GardenMesh } from "../GardenMesh";

function worldPositionOf(obj: TransformNode | Camera): Vector3 {
    return obj instanceof TransformNode
        ? obj.getAbsolutePosition().clone()
        : obj.globalPosition.clone();
}

export function BehaviourOrbit(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    let nodes: TransformNode[] = [];

    let scene = (<GardenMesh>el.parentElement).getScene();
    let centre = (<GardenMesh>el.parentElement).mesh.position;
    let axis = new Vector3(0, -1, 0);
    let angle = Number(el.getAttribute("orbit-angle") ?? 0.002);

    let pivot = new TransformNode("root", scene);
    pivot.position = centre;

    // mesh.position was authored as a world-space point (this framework only makes a
    // child's mesh relative to its parent's node when the parent has the `parent`
    // attribute, which the container here doesn't have) -- so re-express it relative to
    // the new pivot instead of adding the pivot's own offset on top of it a second time.
    mesh.position = mesh.position.subtract(centre);
    mesh.parent = pivot;
    nodes.push(pivot);

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
    scene.registerAfterRender(function () {
        for (let node of nodes) {
            node.rotate(axis, angle, Space.LOCAL);
        }
    });
}
