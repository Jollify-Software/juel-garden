import { CSG, Mesh, MeshBuilder, Scene } from "babylonjs";

/**
 * Create a thick-walled dome mesh in local space, sized to cover a width x depth
 * footprint. The returned mesh's flat base sits at local y = 0, so callers can
 * parent it and position it relative to whatever it's roofing without needing to
 * know anything about world coordinates.
 */
export function createDomeRoof(
    name: string,
    width: number,
    depth: number,
    scene: Scene,
    thickness: number = 0.5
): Mesh {
    const radius = Math.max(width, depth) / 2;

    const outerDome = MeshBuilder.CreateSphere(`${name}_outer`, {
        diameter: radius * 2,
        slice: 0.5,
        segments: 32,
        sideOrientation: Mesh.DOUBLESIDE
    }, scene);

    const base = MeshBuilder.CreatePlane(`${name}_base`, {
        size: radius * 2,
        sideOrientation: Mesh.DOUBLESIDE
    }, scene);
    base.rotation.x = Math.PI / 2;

    const outerShell = Mesh.MergeMeshes([outerDome, base], true);

    const innerDome = MeshBuilder.CreateSphere(`${name}_inner`, {
        diameter: Math.max(radius - thickness, 0.01) * 2,
        slice: 0.5,
        segments: 32
    }, scene);

    const dome = CSG.FromMesh(outerShell)
        .subtract(CSG.FromMesh(innerDome))
        .toMesh(name, null, scene, true);

    outerShell.dispose();
    innerDome.dispose();

    return dome;
}
