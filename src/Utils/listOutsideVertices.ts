import { Mesh, Ray, Scene, Vector3 } from "babylonjs";
import { listVertices } from "./listVertices";

/**
 * Get a list of outside vertices of a given mesh after a CSG operation and merging.
 * @param mesh - The Babylon.js mesh
 * @param scene - The Babylon.js scene
 * @returns An array of outside vertices (world coordinates)
 */
export function listOutsideVertices(mesh: Mesh, scene: Scene): Vector3[] {
    const allVertices = listVertices(mesh);
    const outsideVertices: Vector3[] = [];

    for (const vertex of allVertices) {
        // Transform vertex to world coordinates
        const worldVertex = Vector3.TransformCoordinates(vertex, mesh.getWorldMatrix());

        // Cast a ray outward from the vertex
        const ray = new Ray(worldVertex, mesh.getFacetNormal(0));
        const pickInfo = scene.pickWithRay(ray, (otherMesh) => otherMesh === mesh);

        if (!pickInfo || !pickInfo.hit || pickInfo.distance === 0) {
            // If the ray doesn't hit anything else or the current mesh itself, it's outside
            outsideVertices.push(worldVertex);
        }
    }

    return outsideVertices;
}