import { Axis, Curve3, Mesh, Path3D, Vector3 } from "babylonjs";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenMesh } from "../GardenMesh";

// Follows the polyline given by the parent <garden-line>'s `points` attribute.
// `track-smooth="n"` runs the raw points through a Catmull-Rom spline (n points
// per segment) so the mesh glides through curves instead of snapping at corners
// -- essential for anything meant to look like a rollercoaster rather than rails.
// `track-bank` orients "up" to the path's Frenet normal instead of world Y, so
// the mesh rolls into turns; omit it for a cart that always stays level.
/**
 * Follows the polyline of a parent `<garden-line>`'s `points` attribute --
 * built for rollercoaster-style rides, but works for any path-following mesh.
 *
 * Attributes: `track-smooth` (Catmull-Rom points per segment, for a smooth
 * curve instead of snapping at corners; omit for straight rail segments),
 * `track-bank` (present to roll "up" into the path's curve instead of
 * staying world-Y-up), `track-step` (distance moved per frame, default
 * `0.05`).
 *
 * @example
 * ```html
 * <garden-line points="0 0 0, 10 0 0, 10 0 10, 0 0 10, 0 0 0">
 *   <garden-box track track-smooth="20" track-bank></garden-box>
 * </garden-line>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourTrack(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    let line = el.parentElement;
    let pointsAttr = line?.getAttribute("points");
    if (!pointsAttr) {
        return;
    }

    let scene = (<GardenMesh>el).getScene();
    let rawPoints = Vector3Convert.array(pointsAttr);
    if (rawPoints.length < 2) {
        return;
    }

    // A closed loop is authored by repeating the first point as the last (same
    // convention <garden-line> itself relies on to draw a closed polygon), so the
    // spline is always run un-closed -- Curve3's own `closed` flag expects a
    // non-repeated point list and would double up the closing segment here.
    let smooth = Number(el.getAttribute("track-smooth") ?? 0);
    let points = smooth > 1
        ? Curve3.CreateCatmullRomSpline(rawPoints, smooth, false).getPoints()
        : rawPoints;

    let path = new Path3D(points);
    let length = path.length();
    if (length <= 0) {
        return;
    }

    let step = Number(el.getAttribute("track-step") ?? 0.05);
    let bank = el.hasAttribute("track-bank");
    let distance = 0;

    scene.onBeforeRenderObservable.add(() => {
        distance = (distance + step) % length;
        let t = distance / length;

        let forward = path.getTangentAt(t, true);
        let up = bank ? path.getNormalAt(t, true) : Axis.Y;

        let right = Vector3.Cross(up, forward);
        if (right.lengthSquared() < 1e-6) {
            // forward is (near) parallel to up -- fall back to any other reference axis
            right = Vector3.Cross(Axis.Z, forward);
        }
        right.normalize();
        let trueUp = Vector3.Cross(forward, right).normalize();

        mesh.position = path.getPointAt(t);
        mesh.rotation = Vector3.RotationFromAxis(right, trueUp, forward);
    });
}
