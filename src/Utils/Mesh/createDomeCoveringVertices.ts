import { Mesh, MeshBuilder, Scene, Vector3 } from "babylonjs";

/**
 * Create a dome mesh with its base covering a list of vertices.
 * @param name - The name of the dome mesh.
 * @param vertices - The list of vertices (BABYLON.Vector3) to cover with the dome's base.
 * @param scene - The Babylon.js scene.
 * @param height - The height of the dome.
 * @returns The created dome mesh.
 */
export function createDomeCoveringVertices(
    name: string,
    vertices: Vector3[],
    scene: Scene,
    height: number = 5
): Mesh {
    if (vertices.length === 0) {
        throw new Error("The list of vertices is empty.");
    }

    // Calculate the bounding box of the vertices
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const vertex of vertices) {
        if (vertex.x < minX) minX = vertex.x;
        if (vertex.z < minZ) minZ = vertex.z;
        if (vertex.x > maxX) maxX = vertex.x;
        if (vertex.z > maxZ) maxZ = vertex.z;
    }

    // Calculate the center of the bounding area
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2;

    // Create a dome using MeshBuilder
    const dome = MeshBuilder.CreateSphere(name, {
        diameter: radius * 2,
        slice: 0.5, // Slice to create a dome shape
        segments: 32,
    }, scene);

    // Position the dome
    const baseY = vertices.reduce((minY, vertex) => Math.min(minY, vertex.y), Number.POSITIVE_INFINITY);
    dome.position = new Vector3(centerX, baseY + height / 2, centerZ);

    return dome;
}