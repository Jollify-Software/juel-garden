import { Curve3, Mesh, MeshBuilder, Scene, Vector3 } from "babylonjs";

/**
 * Sample a circular arc between two points that lie in the XZ plane.
 *
 * `sagitta` is how far the arc's midpoint bulges away from the straight chord,
 * in scene units: positive bulges toward `rotate90(end - start)` (the chord
 * direction turned 90 degrees anticlockwise in XZ, i.e. `(dx, dz) -> (-dz, dx)`),
 * negative bulges the other way. A room wall slot picks the endpoint order so
 * that positive always bulges *outward* from the room (see {@link GardenRoom}).
 *
 * Returns `[start, ...interior, end]` with `segments` spans (so `segments + 1`
 * points). A zero/near-zero sagitta returns just `[start, end]` -- a straight
 * wall.
 *
 * @category Utilities
 */
export function arcPoints(start: Vector3, end: Vector3, sagitta: number, segments: number): Vector3[] {
    const chord = end.subtract(start);
    const chordLen = Math.sqrt(chord.x * chord.x + chord.z * chord.z);
    if (chordLen < 1e-6 || Math.abs(sagitta) < 1e-4 || segments < 2)
        return [start.clone(), end.clone()];

    // Unit chord direction and its 90-degree (anticlockwise, XZ) perpendicular.
    const dirX = chord.x / chordLen;
    const dirZ = chord.z / chordLen;
    const perpX = -dirZ;
    const perpZ = dirX;

    const half = chordLen / 2;
    // Circle through both endpoints whose minor arc has this sagitta.
    const radius = (sagitta * sagitta + half * half) / (2 * Math.abs(sagitta));
    const sign = Math.sign(sagitta);
    // Centre sits on the far side of the chord from the bulge.
    const midX = (start.x + end.x) / 2;
    const midZ = (start.z + end.z) / 2;
    const centreOffset = radius - Math.abs(sagitta);
    const centreX = midX - perpX * sign * centreOffset;
    const centreZ = midZ - perpZ * sign * centreOffset;

    const startAngle = Math.atan2(start.z - centreZ, start.x - centreX);
    let endAngle = Math.atan2(end.z - centreZ, end.x - centreX);
    // Walk the short way round, on the side the bulge is on.
    let delta = endAngle - startAngle;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;

    const y0 = start.y;
    const y1 = end.y;
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = startAngle + delta * t;
        points.push(new Vector3(
            centreX + radius * Math.cos(a),
            y0 + (y1 - y0) * t,
            centreZ + radius * Math.sin(a)
        ));
    }
    // Pin the ends exactly (guard against rounding drift off the given points).
    points[0] = start.clone();
    points[points.length - 1] = end.clone();
    return points;
}

/**
 * Build a solid wall by sweeping a `thickness` x `height` rectangular
 * cross-section (rising from local y = 0) along `centreline`, a polyline that
 * should lie in the XZ (floor) plane.
 *
 * Uses `MeshBuilder.ExtrudeShape` with `cap: CAP_ALL` over a closed rectangular
 * cross-section, so the result is a solid tube -- outer, inner, top and bottom
 * faces all present (a room is seen from inside as well as out) plus end caps.
 * Single-sided winding on purpose: `DOUBLESIDE` doubles every triangle, and the
 * coincident pairs make a mess of coplanar z-fighting once `<garden-opening>` /
 * `<garden-structure>` run CSG on the wall. Keep the centreline horizontal:
 * `ExtrudeShape` derives its cross-section orientation from the path's Frenet
 * frame, which stays upright for a horizontal path but can roll on one that also
 * climbs steeply or doubles back.
 *
 * Consecutive duplicate points are dropped (ExtrudeShape produces degenerate
 * segments otherwise). Returns `null` if fewer than two distinct points remain.
 *
 * `sink` extends the cross-section *below* local y = 0 (default 0). A room passes
 * a small value so its wall base overlaps the floor slab rather than meeting it
 * exactly at y = 0 -- two coplanar faces there z-fight, worst once
 * `<garden-opening>` retriangulates the mesh at a doorway.
 *
 * @category Utilities
 */
export function createWall(
    name: string,
    centreline: Vector3[],
    height: number,
    thickness: number,
    scene: Scene,
    smooth = false,
    sink = 0
): Mesh | null {
    let path = centreline.filter((p, i) =>
        i === 0 || Vector3.Distance(p, centreline[i - 1]) > 1e-4);
    if (path.length < 2)
        return null;

    if (smooth && path.length > 2) {
        // A few control points -> a rounded polyline. Kept un-closed here: a
        // closed loop is expressed by repeating the first point in `centreline`,
        // and Curve3's own `closed` flag would double that.
        path = Curve3.CreateCatmullRomSpline(path, Math.max(2, Math.ceil(32 / path.length)), false).getPoints();
    }

    const half = thickness / 2;
    const base = -sink;
    const shape = [
        new Vector3(-half, base, 0),
        new Vector3(half, base, 0),
        new Vector3(half, height, 0),
        new Vector3(-half, height, 0),
        new Vector3(-half, base, 0)
    ];

    return MeshBuilder.ExtrudeShape(name, {
        shape,
        path,
        cap: Mesh.CAP_ALL
    }, scene);
}
