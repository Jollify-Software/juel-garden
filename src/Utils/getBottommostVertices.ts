
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Get the bottommost vertices from a given list of vertices.
 * Bottommost vertices are those with the lowest Y-coordinate.
 * @param vertices - List of vertices
 * @returns An array of bottommost vertices
 * @category Utilities
 */
export function getBottommostVertices(vertices: Vector3[]): Vector3[] {
    if (vertices.length === 0) {
        console.warn("The list of vertices is empty.");
        return [];
    }

    // Find the minimum Y-coordinate
    let minY = Number.POSITIVE_INFINITY;
    for (const vertex of vertices) {
        if (vertex.y < minY) {
            minY = vertex.y;
        }
    }

    // Filter vertices with the minimum Y-coordinate
    return vertices.filter((vertex) => vertex.y === minY);
}