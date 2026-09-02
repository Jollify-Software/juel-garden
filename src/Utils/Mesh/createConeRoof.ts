import { Material, Mesh, MeshBuilder, PolygonMeshBuilder, Scene, Vector2 } from "babylonjs";
import earcut from "earcut";

/** Facet count -- deliberately low so an apex roof reads as hand-built, not machined. */
const SEGMENTS = 12;

/** Regular SEGMENTS-gon in the XZ plane at the given radius. */
function polygon(radius: number): Vector2[] {
    const pts: Vector2[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        pts.push(new Vector2(Math.cos(a) * radius, Math.sin(a) * radius));
    }
    return pts;
}

function cone(name: string, radius: number, rise: number, side: number, scene: Scene): Mesh {
    const m = MeshBuilder.CreateCylinder(name, {
        // A hair of top diameter, not a true point: a zero-radius apex collapses
        // every top triangle into a degenerate fan that shades as a bright streak.
        diameterTop: radius * 0.02,
        diameterBottom: radius * 2,
        height: rise,
        tessellation: SEGMENTS,
        cap: Mesh.NO_CAP,
        sideOrientation: side
    }, scene);
    m.position.y = rise / 2;          // move the base to local y = 0
    m.bakeCurrentTransformIntoVertices();
    m.convertToFlatShadedMesh();
    return m;
}

/**
 * A hollow apex (thatch / timber) roof with real thickness, built the same way
 * as {@link createDomeRoof}: an outer faceted cone plus a smaller inner cone
 * with `BACKSIDE` winding (so it's lit from inside the room), joined by a flat
 * annular rim that closes the gap between their bases at the eave. Faceted on
 * purpose -- `SEGMENTS` is low and every shell is flat-shaded.
 *
 * The returned mesh's base sits at local y = 0, so a caller can position it on a
 * wall top without knowing world coordinates.
 *
 * @category Utilities
 */
export function createConeRoof(
    name: string,
    baseRadius: number,
    rise: number,
    thickness: number,
    scene: Scene,
    material: Material = null
): Mesh {
    const inner = Math.max(baseRadius - thickness, baseRadius * 0.1);

    const outer = cone(`${name}_outer`, baseRadius, rise, Mesh.FRONTSIDE, scene);
    const innerCone = cone(`${name}_inner`, inner, rise, Mesh.BACKSIDE, scene);

    // The eave: a flat ring between the two base radii, straddling y = 0, so the
    // roofline doesn't show a hollow edge from the side.
    const rimDepth = Math.max(thickness * 0.6, 0.05);
    const rim = new PolygonMeshBuilder(`${name}_rim`, polygon(baseRadius), scene, earcut)
        .addHole(polygon(inner))
        .build(false, rimDepth);
    rim.position.y = rimDepth / 2;
    rim.bakeCurrentTransformIntoVertices();
    rim.convertToFlatShadedMesh();

    const roof = Mesh.MergeMeshes([outer, innerCone, rim], true, true, undefined, false, false);
    if (roof && material)
        roof.material = material;
    return roof;
}
