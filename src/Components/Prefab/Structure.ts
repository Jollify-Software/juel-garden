import { CSG, Mesh, MeshBuilder, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";
import { GardenRoom } from "./Room";
import { GardenWall } from "./Wall";

type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

interface AxisOverlap {
    lo: number;
    hi: number;
    gap: number; // > 0: separated by this much; <= 0: overlapping by -gap
}

/**
 * Groups mesh-based children (rooms, stairs, ...) and automatically cuts an opening
 * wherever two of them touch, instead of requiring a hand-placed <garden-opening>
 * for every join. A pair is considered "touching" when their world bounding boxes
 * meet almost exactly on one axis (the shared wall/floor plane) while genuinely
 * overlapping on the other two -- as opposed to merely sharing a corner or edge,
 * which is too ambiguous to cut sensibly.
 *
 * The cut itself uses fixed opening-* dimensions (matching <garden-opening>'s own
 * defaults) rather than the raw overlap on every axis: shapes like stairs and rooms
 * often barely overlap in world space where they actually meet (e.g. a stairway's
 * bounding box only grazes a room's floor level), so deriving the doorway height
 * from that overlap would produce a sliver instead of something walkable. The
 * vertical extent is instead anchored to the higher of the two floor levels and
 * grown upward by opening-height, which is what a real doorway does.
 *
 * Caveat: the box-vs-box detection only works for axis-aligned, box-ish geometry
 * (rooms, stairs). A `<garden-wall>` is handled separately (see tryWallCrossing) --
 * its own centreline is walked against each other child's box and a doorway cut
 * where it pierces one -- so a curved wall running into a room joins without a
 * hand-placed opening. Other rotated/curved children (a `curvature` stairway, a
 * dome roof) still need a hand-placed <garden-opening>.
 *
 * Floor/ceiling joins (the touch axis is "y") are handled separately from wall joins
 * (see tryFloorOpening): two rooms simply stacked on top of each other do *not* get an
 * automatic opening between them just because their floor/ceiling happen to touch --
 * unlike a shared wall, a shared floor doesn't imply anything should walk through it.
 * An opening is only cut where a whitelisted vertical connector (currently just
 * <garden-stairs>) actually reaches into a room's floor.
 *
 * Attributes: `opening-width`, `opening-height`, `opening-depth` (the fixed
 * cut dimensions used at every detected join), `tolerance` (how close two
 * bounding boxes must be to count as touching).
 *
 * @example
 * ```html
 * <garden-structure>
 *   <garden-room id="r1"></garden-room>
 *   <garden-room id="r2" position="0 0 -16"></garden-room>
 *   <garden-roof type="dome"></garden-roof>
 * </garden-structure>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-structure")
export class GardenStructure extends GardenElement {
    // Whitelist of tag names allowed to punch a floor opening in a room (see
    // tryFloorOpening) -- <garden-stairs> is the only one today, but this is where a
    // future ramp/ladder element would be added.
    private static readonly FLOOR_OPENING_TAGS = ["garden-stairs"];

    @property({ type: Number, attribute: "opening-width" }) openingWidth: number;
    @property({ type: Number, attribute: "opening-height" }) openingHeight: number;
    @property({ type: Number, attribute: "opening-depth" }) openingDepth: number;
    @property({ type: Number }) tolerance: number;

    constructor() {
        super();
        this.openingWidth = 3;
        this.openingHeight = GardenRoom.WallHeight - 1;
        this.openingDepth = GardenRoom.WallThickness * 2;
        this.tolerance = 0.05;
    }

    async updated() {
        super.updated();

        this.beginBuild();
        try {
            // Children may not be parsed into the light DOM yet -- a custom element's
            // connectedCallback (and Lit's first updated()) can fire as soon as its own
            // start tag is parsed, before its nested content is. Wait for the document
            // to finish before trusting this.children, same as <garden-opening> does.
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve =>
                    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
                );
            }

            // <garden-roof> is excluded here: a roof spanning the whole structure touches
            // every room it covers almost exactly at the roofline (its base sits right at
            // wall-top height), which the touch-detection below would mistake for a join
            // and carve a doorway-sized opening into -- not what a roof needs.
            let children = (<Element[]>Array.prototype.slice.call(this.children))
                .filter((el): el is GardenMesh => el instanceof GardenMesh && !el.matches("garden-roof"));

            await Promise.all(children.map(el => el.whenReady));

            for (let i = 0; i < children.length; i++) {
                for (let j = i + 1; j < children.length; j++) {
                    this.connect(children[i], children[j]);
                }
            }
        } finally {
            this.endBuild();
        }
    }

    private connect(a: GardenMesh, b: GardenMesh) {
        if (!a.mesh || !b.mesh)
            return;

        a.mesh.computeWorldMatrix(true);
        b.mesh.computeWorldMatrix(true);

        if (this.tryFloorOpening(a, b))
            return;

        if (this.tryWallCrossing(a, b))
            return;

        if (this.tryCurvedRoomJoin(a, b))
            return;

        let aBox = a.mesh.getBoundingInfo().boundingBox;
        let bBox = b.mesh.getBoundingInfo().boundingBox;

        let overlap = {} as Record<Axis, AxisOverlap>;
        for (let axis of AXES) {
            let lo = Math.max(aBox.minimumWorld[axis], bBox.minimumWorld[axis]);
            let hi = Math.min(aBox.maximumWorld[axis], bBox.maximumWorld[axis]);
            overlap[axis] = { lo, hi, gap: lo - hi };
        }

        // Any axis where the boxes are genuinely separated means these two don't touch at all.
        if (AXES.some(axis => overlap[axis].gap > this.tolerance))
            return;

        // The touch axis is the one where the boxes meet almost exactly (gap ~ 0). If more
        // than one axis qualifies, they only share a corner/edge -- too ambiguous to cut.
        let touchAxes = AXES.filter(axis => overlap[axis].gap > -this.tolerance);
        if (touchAxes.length !== 1)
            return;

        let touchAxis = touchAxes[0];

        // Floor/ceiling touches are handled exclusively by tryFloorOpening above -- a plain
        // wall-style cut here would treat any two stacked rooms as joined just because their
        // floor and ceiling happen to meet, which isn't a real connection between them.
        if (touchAxis === "y")
            return;

        let otherAxes = AXES.filter(axis => axis !== touchAxis);

        // The remaining axes must actually overlap (not just also be near-touching),
        // otherwise the two shapes are aligned but not adjacent.
        if (otherAxes.some(axis => overlap[axis].hi <= overlap[axis].lo))
            return;

        this.cut(a, b, touchAxis, otherAxes, overlap, aBox.minimumWorld, bBox.minimumWorld);
    }

    /**
     * Cuts a floor opening wherever a whitelisted vertical connector (currently just
     * <garden-stairs>) reaches into a room's floor slab, regardless of whether their
     * bounding boxes merely "touch" in the wall-join sense above -- a staircase has to
     * genuinely overlap a room's floor level to connect to it (its top/bottom lands at
     * the floor, it doesn't just graze it), which the touch-based algorithm isn't suited
     * to detect. Returns true only when it actually cut an opening; false in every other
     * case (including a room/stairs pair that isn't a floor case at all -- e.g. entrance
     * stairs meeting a room through a wall), so the caller still runs the normal wall-join
     * check on this pair instead of assuming it's already been handled.
     */
    private tryFloorOpening(a: GardenMesh, b: GardenMesh): boolean {
        let room: GardenRoom, connector: GardenMesh;
        if (a instanceof GardenRoom && !(b instanceof GardenRoom) && GardenStructure.FLOOR_OPENING_TAGS.some(tag => b.matches(tag))) {
            room = a; connector = b;
        } else if (b instanceof GardenRoom && !(a instanceof GardenRoom) && GardenStructure.FLOOR_OPENING_TAGS.some(tag => a.matches(tag))) {
            room = b; connector = a;
        } else {
            return false;
        }

        let roomBox = room.mesh.getBoundingInfo().boundingBox;
        let connBox = connector.mesh.getBoundingInfo().boundingBox;

        // The room's floor sits at its own local y = 0, i.e. its world position -- see
        // GardenRoom/createDomeRoof's own "flat base at local y = 0" convention.
        let floorY = room.position?.y ?? 0;
        let floorMin = floorY - room.thickness / 2 - this.tolerance;
        let floorMax = floorY + room.thickness / 2 + this.tolerance;
        // Not actually a floor case (e.g. this is <garden-stairs> entering the room through
        // a wall, like a building's entrance stairs) -- fall through to the normal wall-join
        // check below instead of claiming/skipping this pair.
        if (connBox.maximumWorld.y < floorMin || connBox.minimumWorld.y > floorMax)
            return false;

        let overlapX = { lo: Math.max(roomBox.minimumWorld.x, connBox.minimumWorld.x), hi: Math.min(roomBox.maximumWorld.x, connBox.maximumWorld.x) };
        let overlapZ = { lo: Math.max(roomBox.minimumWorld.z, connBox.minimumWorld.z), hi: Math.min(roomBox.maximumWorld.z, connBox.maximumWorld.z) };
        // Require *meaningfully* more than zero overlap, not just hi > lo: a connector that
        // merely touches a room at a wall boundary (e.g. entrance stairs meeting a room's
        // outer wall) can come out with a razor-thin "overlap" of a fraction of a micron from
        // floating-point noise in the bounding box coordinates, which read as genuine overlap
        // under a strict hi > lo check and wrongly claimed the pair here instead of letting it
        // fall through to the normal wall-join logic.
        if (overlapX.hi - overlapX.lo <= this.tolerance || overlapZ.hi - overlapZ.lo <= this.tolerance)
            return false;

        this.cutFloor(room, floorY, overlapX, overlapZ);
        return true;
    }

    private cutFloor(room: GardenRoom, floorY: number, overlapX: AxisOverlap, overlapZ: AxisOverlap) {
        let scene = this.getScene();
        let width = overlapX.hi - overlapX.lo;
        let depth = overlapZ.hi - overlapZ.lo;
        let centerX = (overlapX.lo + overlapX.hi) / 2;
        let centerZ = (overlapZ.lo + overlapZ.hi) / 2;

        let cutter = MeshBuilder.CreateBox("structure-floor-opening", {
            width, height: room.thickness * 4, depth
        }, scene);
        cutter.position = new Vector3(centerX, floorY, centerZ);
        cutter.isVisible = false;

        let mat = room.getMaterial();
        let mesh: Mesh = CSG.FromMesh(room.mesh).subtract(CSG.FromMesh(cutter)).toMesh(room.id, mat, scene, true);
        room.setMesh(mesh);
        // CSG.subtract().toMesh() doesn't reliably preserve which submesh belonged to
        // which original wall -- see GardenRoom.fixMaterialIndices for the empirical
        // case this was written against.
        room.fixMaterialIndices();

        cutter.dispose();
    }

    /**
     * Cut a doorway where a `<garden-wall>` centreline pierces another child's box.
     * The box-vs-box test in connect() can't see this: a curved wall's bounding box
     * is a big rectangle that doesn't follow where the wall actually runs.
     *
     * Only fires when exactly one of the pair is a `<garden-wall>`. Walks the wall's
     * world-space centreline; for every segment with one end inside the other mesh's
     * (x,z) box footprint and one end outside, binary-searches the crossing point and
     * cuts an opening-sized hole through both the wall and that mesh there. Returns
     * true only when it actually cut something -- otherwise the caller still runs the
     * normal box-vs-box check (a plain straight wall butting a wall face perpendicular
     * is handled fine by that).
     */
    private tryWallCrossing(a: GardenMesh, b: GardenMesh): boolean {
        let wall: GardenWall, other: GardenMesh;
        if (a instanceof GardenWall && !(b instanceof GardenWall)) { wall = a; other = b; }
        else if (b instanceof GardenWall && !(a instanceof GardenWall)) { wall = b; other = a; }
        else return false;

        let line = wall.centreline();
        if (!line || line.length < 2 || !wall.mesh || !other.mesh)
            return false;

        let world = wall.mesh.getWorldMatrix();
        let pts = line.map(p => Vector3.TransformCoordinates(p, world));

        let box = other.mesh.getBoundingInfo().boundingBox;
        let min = box.minimumWorld, max = box.maximumWorld;
        let m = this.tolerance;
        // Footprint test only (x,z) -- a wall spans the full height, so "does it reach
        // into the room" is a plan-view question.
        let inside = (p: Vector3) =>
            p.x >= min.x - m && p.x <= max.x + m && p.z >= min.z - m && p.z <= max.z + m;

        let floorY = (other instanceof GardenRoom ? other.position?.y : undefined) ?? min.y;

        let hits: Vector3[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
            let p0 = pts[i], p1 = pts[i + 1];
            let in0 = inside(p0);
            if (in0 === inside(p1))
                continue; // both inside (a partition) or both outside (a miss)

            let lo = 0, hi = 1;
            for (let k = 0; k < 24; k++) {
                let mid = (lo + hi) / 2;
                if (inside(Vector3.Lerp(p0, p1, mid)) === in0) lo = mid;
                else hi = mid;
            }
            let hit = Vector3.Lerp(p0, p1, (lo + hi) / 2);
            if (!hits.some(q => Vector3.Distance(q, hit) < this.openingWidth))
                hits.push(hit);
        }

        if (hits.length === 0)
            return false;

        for (let hit of hits)
            this.cutDoorway(other, wall, hit, floorY);
        return true;
    }

    /**
     * Cut a doorway where a curved room's wall outline runs up against another
     * room. `tryWallCrossing` only covers a `<garden-wall>` piercing a room;
     * this covers the room-to-room case the box-vs-box test can't, because a
     * curved-slot room or a rotunda has a bounding box that bulges past where
     * its wall actually is.
     *
     * Fires when at least one of the pair is a `GardenRoom` carrying a stored
     * `wallLoop` (built by buildWithWallSlots / buildRotunda -- a plain box room
     * has none and falls through to the box test). Walks that loop in world
     * space; a run of loop points sitting in the thin shell around the other
     * room's outline (its own `wallLoop` if it has one, else its box) is a
     * shared wall, and one opening is cut at the run's midpoint. Returns true
     * whenever a curved room was involved -- the loop walk is a superset of what
     * the box test could do for it, so the caller must not also run that.
     */
    private tryCurvedRoomJoin(a: GardenMesh, b: GardenMesh): boolean {
        let curved =
            (a instanceof GardenRoom && a.wallLoop) ? a :
            (b instanceof GardenRoom && b.wallLoop) ? b : null;
        if (!curved || !curved.mesh)
            return false;

        let other = curved === a ? b : a;
        if (!other.mesh)
            return true;

        let aBox = curved.mesh.getBoundingInfo().boundingBox;
        let bBox = other.mesh.getBoundingInfo().boundingBox;
        // Stacked storeys (no vertical overlap) are never a wall join.
        if (Math.max(aBox.minimumWorld.y, bBox.minimumWorld.y) >= Math.min(aBox.maximumWorld.y, bBox.maximumWorld.y) - this.tolerance)
            return true;

        let loop = curved.wallLoop!.map(p => Vector3.TransformCoordinates(p, curved.mesh.getWorldMatrix()));
        let otherLoop = (other instanceof GardenRoom && other.wallLoop)
            ? other.wallLoop.map(p => Vector3.TransformCoordinates(p, other.mesh.getWorldMatrix()))
            : null;

        let shell = this.tolerance * 4;
        let inBox = (p: Vector3, pad: number) =>
            p.x >= bBox.minimumWorld.x - pad && p.x <= bBox.maximumWorld.x + pad &&
            p.z >= bBox.minimumWorld.z - pad && p.z <= bBox.maximumWorld.z + pad;
        let touching = (p: Vector3) => otherLoop
            ? this.distToPolylineXZ(p, otherLoop) <= shell
            : (inBox(p, shell) && !inBox(p, -shell));

        // For each loop segment, find the stretch that runs against the other room's
        // outline and, if it's long enough to be a real shared wall (not a grazed
        // corner), cut one doorway at its midpoint. Sampling per segment -- rather
        // than per vertex -- keeps the doorway centred on the *shared* span even when
        // the neighbour only covers part of a long straight side.
        const SAMPLES = 12;
        // A shared wall shorter than this is a grazed corner, not a doorway.
        let minRun = Math.max(this.tolerance * 6, this.openingWidth * 0.4);
        let doorways: Vector3[] = [];
        for (let i = 0; i < loop.length - 1; i++) {
            let p0 = loop[i], p1 = loop[i + 1];
            let firstT = -1, lastT = -1;
            for (let s = 0; s <= SAMPLES; s++) {
                let t = s / SAMPLES;
                if (touching(Vector3.Lerp(p0, p1, t))) {
                    if (firstT < 0) firstT = t;
                    lastT = t;
                }
            }
            if (firstT < 0)
                continue;

            let start = Vector3.Lerp(p0, p1, firstT);
            let end = Vector3.Lerp(p0, p1, lastT);
            if (Vector3.Distance(start, end) < minRun)
                continue;

            let mid = Vector3.Lerp(start, end, 0.5);
            if (!doorways.some(q => Vector3.Distance(q, mid) < this.openingWidth))
                doorways.push(mid);
        }

        if (doorways.length === 0)
            return true;

        let floorY = Math.max(aBox.minimumWorld.y, bBox.minimumWorld.y);
        for (let at of doorways)
            this.cutDoorway(curved, other, at, floorY);
        return true;
    }

    /** Shortest distance from a point to a polyline, in the XZ plane (walls span all Y). */
    private distToPolylineXZ(p: Vector3, pts: Vector3[]): number {
        let best = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            let ax = pts[i].x, az = pts[i].z;
            let bx = pts[i + 1].x - ax, bz = pts[i + 1].z - az;
            let len2 = bx * bx + bz * bz;
            let t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - ax) * bx + (p.z - az) * bz) / len2)) : 0;
            best = Math.min(best, Math.hypot(p.x - (ax + bx * t), p.z - (az + bz * t)));
        }
        return best;
    }

    private cutDoorway(first: GardenMesh, second: GardenMesh, at: Vector3, floorY: number) {
        let scene = this.getScene();
        // Square in plan so it carves a clean opening whatever angle the walls meet at.
        let cutter = MeshBuilder.CreateBox("structure-wall-opening", {
            width: this.openingWidth,
            height: this.openingHeight,
            depth: this.openingWidth
        }, scene);
        cutter.position = new Vector3(at.x, floorY + this.openingHeight / 2, at.z);
        cutter.isVisible = false;

        let cutterCsg = CSG.FromMesh(cutter);
        for (let el of [first, second]) {
            let mesh: Mesh = CSG.FromMesh(el.mesh).subtract(cutterCsg).toMesh(el.id, el.getMaterial(), scene, true);
            el.setMesh(mesh);
            if (el instanceof GardenRoom)
                el.fixMaterialIndices();
        }

        cutter.dispose();
    }

    private cut(a: GardenMesh, b: GardenMesh, touchAxis: Axis, otherAxes: Axis[],
        overlap: Record<Axis, AxisOverlap>, aMin: Vector3, bMin: Vector3) {
        let scene = this.getScene();
        let size = { x: 0, y: 0, z: 0 };
        let center = { x: 0, y: 0, z: 0 };

        size[touchAxis] = this.openingDepth;
        center[touchAxis] = (overlap[touchAxis].lo + overlap[touchAxis].hi) / 2;

        for (let axis of otherAxes) {
            if (axis === "y") {
                let floor = Math.max(aMin.y, bMin.y);
                size.y = this.openingHeight;
                center.y = floor + this.openingHeight / 2;
            } else {
                let extent = overlap[axis].hi - overlap[axis].lo;
                size[axis] = Math.min(this.openingWidth, extent);
                center[axis] = (overlap[axis].lo + overlap[axis].hi) / 2;
            }
        }

        let cutter = MeshBuilder.CreateBox("structure-opening", {
            width: size.x, height: size.y, depth: size.z
        }, scene);
        cutter.position = new Vector3(center.x, center.y, center.z);
        cutter.isVisible = false;

        let cutterCsg = CSG.FromMesh(cutter);
        for (let el of [a, b]) {
            let mat = el.getMaterial();
            let mesh: Mesh = CSG.FromMesh(el.mesh).subtract(cutterCsg).toMesh(el.id, mat, scene, true);
            el.setMesh(mesh);
            // Same submesh/materialIndex scrambling as tryFloorOpening/cutFloor above --
            // see GardenRoom.fixMaterialIndices.
            if (el instanceof GardenRoom)
                el.fixMaterialIndices();
        }

        cutter.dispose();
    }
}
