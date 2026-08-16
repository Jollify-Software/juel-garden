import { CSG, Material, Mesh, MeshBuilder, Scene } from "babylonjs";

/**
 * Build the flat ceiling patch that fills the square room footprint outside the dome's
 * circular rim (the corners a circle inscribed in a square doesn't cover). It's a real
 * solid (a thin box with a cylindrical hole punched out via CSG), not a bare plane, so
 * it doesn't also cover the area *inside* the circle -- a full square there would sit
 * exactly at the dome's rim height and occlude the entire curved surface above it from
 * any point in the room.
 */
function createBaseCap(
    name: string,
    squareSize: number,
    holeRadius: number,
    capThickness: number,
    material: Material,
    scene: Scene
): Mesh {
    const box = MeshBuilder.CreateBox(`${name}_box`, {
        width: squareSize,
        height: capThickness,
        depth: squareSize
    }, scene);

    const hole = MeshBuilder.CreateCylinder(`${name}_hole`, {
        diameter: holeRadius * 2,
        height: capThickness * 4
    }, scene);

    const cap = CSG.FromMesh(box).subtract(CSG.FromMesh(hole)).toMesh(name, material, scene, true);
    box.dispose();
    hole.dispose();

    return cap;
}

/**
 * Create a dome mesh in local space, sized to cover a width x depth footprint. The
 * returned mesh's flat base sits at local y = 0, so callers can parent it and
 * position it relative to whatever it's roofing without needing to know anything
 * about world coordinates.
 *
 * The outer and inner surfaces are built as separate shells -- the outer one with
 * default winding (visible from outside, culled from inside) and the inner one with
 * BACKSIDE winding (visible from inside, culled from outside) -- rather than as a
 * single CSG-subtracted solid, so each can carry its own material. They're merged
 * into one mesh via a MultiMaterial (Mesh.MergeMeshes' multiMultiMaterials flag),
 * the same technique GardenRoom uses to give each wall its own colour.
 */
export function createDomeRoof(
    name: string,
    width: number,
    depth: number,
    scene: Scene,
    thickness: number = 0.5,
    outsideMaterial: Material = null,
    insideMaterial: Material = null
): Mesh {
    const radius = Math.max(width, depth) / 2;
    const innerRadius = Math.max(radius - thickness, 0.01);

    const outerDome = MeshBuilder.CreateSphere(`${name}_outer`, {
        diameter: radius * 2,
        slice: 0.5,
        segments: 32
    }, scene);
    outerDome.material = outsideMaterial;

    // Both caps share innerRadius (the smaller of the two) as their hole size, even though
    // the outer dome's own rim is at the larger `radius`. Using `radius` here would leave a
    // sliver of the flat ceiling -- between innerRadius and radius, under the curved shell's
    // thickness -- uncovered by either cap, visible as a crack showing the inside material
    // through when viewed from a shallow angle outside.
    const outerBase = createBaseCap(`${name}_outer_base`, radius * 2, innerRadius, thickness, outsideMaterial, scene);

    const innerDome = MeshBuilder.CreateSphere(`${name}_inner`, {
        diameter: innerRadius * 2,
        slice: 0.5,
        segments: 32,
        sideOrientation: Mesh.BACKSIDE
    }, scene);
    innerDome.material = insideMaterial;

    const innerBase = createBaseCap(`${name}_inner_base`, radius * 2, innerRadius, thickness, insideMaterial, scene);

    const dome = Mesh.MergeMeshes(
        [outerDome, outerBase, innerDome, innerBase],
        true, true, undefined, false, true
    );

    return dome;
}
