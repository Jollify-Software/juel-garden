import { Mesh, Vector3 } from "babylonjs";
import { listVertices } from "./listVertices";

/**
 * Get a list of inside vertices of a given mesh.
 * Inside vertices are those NOT in the list of outside vertices.
 * @param mesh - The Babylon.js mesh
 * @param outsideVertices - List of outside vertices for comparison
 * @returns An array of inside vertices
 * @category Utilities
 */
export function listInsideVertices(mesh: Mesh, outsideVertices: Vector3[]): Vector3[] {
    const allVertices = listVertices(mesh);
    const insideVertices: Vector3[] = [];

    const outsideSet = new Set(outsideVertices.map((v) => v.toString()));

    for (const vertex of allVertices) {
        // Transform vertex to world coordinates
        const worldVertex = Vector3.TransformCoordinates(vertex, mesh.getWorldMatrix());

        if (!outsideSet.has(worldVertex.toString())) {
            insideVertices.push(worldVertex);
        }
    }

    return insideVertices;
}