import { CSG, Material, Mesh, MeshBuilder, Scene, Vector3, VertexBuffer } from "babylonjs";

/** Where a dome texture's own centre point sits, in the texture's own 0..1 UV space. */
export interface DomeTextureTransform {
    centerU: number;
    centerV: number;
    rotation: number; // radians
}

export const DEFAULT_DOME_TEXTURE_TRANSFORM: DomeTextureTransform = { centerU: 0.5, centerV: 0.5, rotation: 0 };

/**
 * Re-maps a dome shell's UVs from the sphere builder's default cylindrical/equirectangular
 * layout (U = azimuth swept across the texture's full width, V = polar angle down its
 * height) to a polar/fisheye layout instead: the texture's own centre point (by default
 * its middle, (0.5, 0.5)) sits at the dome's apex, and the texture unwraps radially outward
 * from there to the rim. This is the layout a real photograph of a domed ceiling naturally
 * has (the medallion/focal point centred in frame, everything else radiating outward to the
 * edge of the shot) -- the default cylindrical layout instead pinches the texture's *top
 * row* into a single point at the apex (a visible bright/distorted streak) and leaves the
 * texture's actual centre stranded partway down the slope, off to one side.
 */
function applyPolarDomeUVs(mesh: Mesh, radiusX: number, radiusZ: number, transform: DomeTextureTransform): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const vertexCount = positions.length / 3;
    const uvs = new Float32Array(vertexCount * 2);
    const cos = Math.cos(transform.rotation);
    const sin = Math.sin(transform.rotation);

    for (let i = 0; i < vertexCount; i++) {
        // Normalized so the rim (where the ellipse equation (x/radiusX)^2 + (z/radiusZ)^2
        // is exactly 1) lands on the unit circle, regardless of the dome's own aspect ratio.
        const dx = radiusX > 0 ? positions[i * 3] / radiusX : 0;
        const dz = radiusZ > 0 ? positions[i * 3 + 2] / radiusZ : 0;
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;

        // V is negated but U isn't -- confirmed empirically via screenshot. Un-negated,
        // a real photo rendered a clean 180-degree rotation (face and Latin text both
        // upside-down, but not mirrored -- correct chirality, wrong orientation).
        // Negating *both* U and V (a true 180-degree rotation, which would seem like the
        // obvious undo) instead produced an upright but left-right *mirrored* result
        // (backwards letterforms), proving the original mapping's "rotation" was actually
        // two independent flips landing on top of each other by coincidence (likely
        // Babylon's V-axis image-row convention combined with viewing the inside of the
        // dome from below, which itself mirrors a "from above" mapping). Negating V alone
        // cancels just the V-axis flip and leaves the correct, unmirrored result.
        uvs[i * 2] = transform.centerU + rx * 0.5;
        uvs[i * 2 + 1] = transform.centerV - rz * 0.5;
    }

    mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

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
    insideMaterial: Material = null,
    outsideTextureTransform: DomeTextureTransform = DEFAULT_DOME_TEXTURE_TRANSFORM,
    insideTextureTransform: DomeTextureTransform = DEFAULT_DOME_TEXTURE_TRANSFORM
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
    applyPolarDomeUVs(outerDome, radiusX, radiusZ, outsideTextureTransform);

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
    applyPolarDomeUVs(innerDome, innerRadiusX, innerRadiusZ, insideTextureTransform);

    const innerBase = createBaseCap(`${name}_inner_base`, width, depth, innerRadiusX, innerRadiusZ, thickness, insideMaterial, scene);

    const dome = Mesh.MergeMeshes(
        [outerDome, outerBase, innerDome, innerBase],
        true, true, undefined, false, true
    );

    return dome;
}
