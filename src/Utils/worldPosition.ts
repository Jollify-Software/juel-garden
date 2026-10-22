import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Where a node is in the world this frame: its whole parent chain recomputed, parents first.
 * `getAbsolutePosition()` can give last frame's place for a bone of a model that has just
 * moved or been posed; this is exact (it costs a matrix per ancestor).
 *
 * @category Utilities
 */
export function worldPosition(node: TransformNode): Vector3 {
    let chain: TransformNode[] = [];
    for (let n: TransformNode = node; n; n = n.parent as TransformNode)
        chain.unshift(n);
    for (let n of chain)
        n.computeWorldMatrix(true);
    return node.getAbsolutePosition().clone();
}
