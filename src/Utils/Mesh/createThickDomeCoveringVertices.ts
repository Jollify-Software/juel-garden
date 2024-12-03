import { Axis, CSG, Mesh, MeshBuilder, Scene, Space, StandardMaterial, Vector3 } from "babylonjs";

/**
 * Create a thick-walled dome mesh with its base covering a list of vertices.
 * This dome can act as a domed roof for a structure.
 * @param name - The name of the dome mesh.
 * @param vertices - The list of vertices (BABYLON.Vector3) to cover with the dome's base.
 * @param scene - The Babylon.js scene.
 * @param height - The height of the dome.
 * @param thickness - The wall thickness of the dome.
 * @returns The created thick-walled dome mesh.
 */
export function createThickDomeCoveringVertices(
    name: string,
    vertices: Vector3[],
    scene: Scene,
    height: number = 5,
    thickness: number = 0.5
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

    // Calculate the center and radius
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2;

    // Create the half-sphere (outer dome)
    const halfSphere = MeshBuilder.CreateSphere(
        `${name}_halfSphere`,
        { diameter: radius * 2, slice: 0.5, segments: 32, sideOrientation: Mesh.DOUBLESIDE },
        scene
    );

    // Create a flat circular base
    const circularBase = MeshBuilder.CreatePlane(
        `${name}_circularBase`,
        { size: radius * 2, sideOrientation: Mesh.DOUBLESIDE },
        scene
    );

    // Position the half-sphere and the base
    const baseY = vertices.reduce((minY, vertex) => Math.min(minY, vertex.y), Number.POSITIVE_INFINITY);
    halfSphere.position = new Vector3(centerX, baseY, centerZ);
    circularBase.position = new Vector3(centerX, baseY, centerZ);
    circularBase.rotation.x = Math.PI / 2;

    // Merge the half-sphere and the circular base
    const mergedDome = Mesh.MergeMeshes([halfSphere, circularBase], true);

    // Create the inner dome
    const innerDome = MeshBuilder.CreateSphere(
        `${name}_innerDome`,
        { diameter: (radius - thickness) * 2, slice: 0.5, segments: 32 },
        scene
    );

    // Position the inner dome
    innerDome.position = new Vector3(centerX, baseY, centerZ);

    // Convert meshes to CSG
    const mergedCSG = CSG.FromMesh(mergedDome);
    const innerCSG = CSG.FromMesh(innerDome);

    // Subtract the inner dome from the merged dome
    const thickDomeCSG = mergedCSG.subtract(innerCSG);

    // Convert the final CSG result back to a mesh
    const thickDomeMesh = thickDomeCSG.toMesh(name, new StandardMaterial(`${name}_mat`, scene), scene);

    // Clean up intermediate meshes
    mergedDome.dispose();
    innerDome.dispose();

    return thickDomeMesh;
}