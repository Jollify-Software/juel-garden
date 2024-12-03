import { Vector3 } from "babylonjs";

/**
 * Get the topmost vertices from a given list of vertices.
 * Topmost vertices are those with the highest Y-coordinate.
 * @param vertices - List of vertices (BABYLON.Vector3)
 * @returns An array of topmost vertices
 */
export function getTopmostVertices(vertices: Vector3[]): Vector3[] {
    if (vertices.length === 0) {
        console.warn("The list of vertices is empty.");
        return [];
    }

    // Find the maximum Y-coordinate
    let maxY = Number.NEGATIVE_INFINITY;
    for (const vertex of vertices) {
        if (vertex.y > maxY) {
            maxY = vertex.y;
        }
    }

    // Filter vertices with the maximum Y-coordinate
    return vertices.filter((vertex) => vertex.y === maxY);
}