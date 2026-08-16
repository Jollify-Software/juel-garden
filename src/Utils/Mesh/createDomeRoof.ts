import { CSG, Material, Mesh, MeshBuilder, Scene, Vector3 } from "babylonjs";

/**
 * Build the flat ceiling patch that fills the rectangular footprint outside the dome's
 * elliptical rim (the corners an ellipse inscribed in a rectangle doesn't cover). It's a
 * real solid (a thin box with an elliptical hole punched out via CSG), not a bare plane,
 * so it doesn't also cover the area *inside* the ellipse -- a full rectangle there would
 * sit exactly at the dome's rim height and occlude the entire curved surface above it
 * from any point in the room.
 */
function createBaseCap(
    name: string,
    boxWidth: number,
    boxDepth: number,
    holeRadiusX: number,
    holeRadiusZ: number,
    capThickness: number,
    material: Material,
    scene: Scene
): Mesh {
    const box = MeshBuilder.CreateBox(`${name}_box`, {
        width: boxWidth,
        height: capThickness,
        depth: boxDepth
    }, scene);

    // A circular cylinder stretched into an ellipse via non-uniform scaling, baked into
    // its vertices before the CSG op (CSG works on baked geometry, not live transforms).
    const hole = MeshBuilder.CreateCylinder(`${name}_hole`, {
        diameter: 2,
        height: capThickness * 4
    }, scene);
    hole.scaling = new Vector3(holeRadiusX, 1, holeRadiusZ);
    hole.bakeCurrentTransformIntoVertices();

    const cap = CSG.FromMesh(box).subtract(CSG.FromMesh(hole)).toMesh(name, material, scene, true);
    box.dispose();
    hole.dispose();

    return cap;
}

/**
 * Create a dome mesh in local space, sized to cover a width x depth footprint exactly
 * (an ellipsoid, not a true sphere, whenever width != depth -- a sphere sized to the
 * larger dimension would overhang past the shorter sides). The returned mesh's flat
 * base sits at local y = 0, so callers can parent it and position it relative to
 * whatever it's roofing without needing to know anything about world coordinates.
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
    const radiusX = width / 2;
    const radiusZ = depth / 2;
    // The dome's height (how far it rises) follows the *shorter* footprint dimension,
    // same as a real vault -- basing it on the longer one would make a tall, spike-like
    // dome over an elongated rectangle instead of a naturally proportioned one.
    const radiusY = Math.min(radiusX, radiusZ);

    const innerRadiusX = Math.max(radiusX - thickness, 0.01);
    const innerRadiusZ = Math.max(radiusZ - thickness, 0.01);
    const innerRadiusY = Math.max(radiusY - thickness, 0.01);

    const outerDome = MeshBuilder.CreateSphere(`${name}_outer`, {
        diameterX: radiusX * 2,
        diameterY: radiusY * 2,
        diameterZ: radiusZ * 2,
        slice: 0.5,
        segments: 32
    }, scene);
    outerDome.material = outsideMaterial;

    // Both caps share the inner (smaller) ellipse as their hole size, even though the
    // outer dome's own rim is the larger one. Using the outer rim here would leave a
    // sliver of the flat ceiling -- between the two ellipses, under the curved shell's
    // thickness -- uncovered by either cap, visible as a crack showing the inside
    // material through when viewed from a shallow angle outside.
    const outerBase = createBaseCap(`${name}_outer_base`, width, depth, innerRadiusX, innerRadiusZ, thickness, outsideMaterial, scene);

    const innerDome = MeshBuilder.CreateSphere(`${name}_inner`, {
        diameterX: innerRadiusX * 2,
        diameterY: innerRadiusY * 2,
        diameterZ: innerRadiusZ * 2,
        slice: 0.5,
        segments: 32,
        sideOrientation: Mesh.BACKSIDE
    }, scene);
    innerDome.material = insideMaterial;

    const innerBase = createBaseCap(`${name}_inner_base`, width, depth, innerRadiusX, innerRadiusZ, thickness, insideMaterial, scene);

    const dome = Mesh.MergeMeshes(
        [outerDome, outerBase, innerDome, innerBase],
        true, true, undefined, false, true
    );

    return dome;
}
