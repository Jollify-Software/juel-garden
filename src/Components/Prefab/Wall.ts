import { Color3, StandardMaterial, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../../Converters/Vector3Convert";
import { GardenMesh } from "../../GardenMesh";
import { arcPoints, createWall } from "../../Utils/Mesh/createWall";
import { GardenRoom } from "./Room";

/**
 * A straight or curved wall: a `thickness` x `height` cross-section swept along
 * a centreline (see {@link createWall}). Two ways to use it:
 *
 * 1. **Standalone** -- a `<garden-structure>` sibling, an interior partition, a
 *    colonnade, a boundary wall. Give it `points` (a centreline polyline on the
 *    floor plane), optionally `smooth` to round it or `curve` to bow a
 *    two-point wall into an arc.
 * 2. **A room wall slot** -- `slot="north"|"east"|"south"|"west"` inside a
 *    `<garden-room>`. The room supplies the edge endpoints, so `points` is not
 *    needed; the wall only carries shape modifiers (`curve`, `segments`). In
 *    this mode the element builds no mesh of its own -- the room reads its
 *    attributes and builds the side as part of the room mesh. See
 *    {@link GardenRoom}.
 *
 * Attributes: `points` (centreline, a `Vector3` array -- see
 * {@link Vector3Convert.array}), `height` (default {@link GardenRoom.WallHeight}),
 * `thickness` (default {@link GardenRoom.WallThickness}), `curve` (sagitta: bow
 * a two-point wall out by this many units, + one way / - the other), `segments`
 * (arc sampling resolution, default 16), `smooth` (round a multi-point
 * centreline through a Catmull-Rom spline), `closed` (close the loop), `slot`
 * (room-slot mode, above), plus the common {@link GardenMesh} set.
 *
 * @example
 * ```html
 * <garden-wall points="-8 0 0, 8 0 0" curve="3" height="4" collisions></garden-wall>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-wall")
export class GardenWall extends GardenMesh {
    @property({ converter: Vector3Convert.array }) points?: Vector3[];
    @property({ type: Number }) height = GardenRoom.WallHeight;
    @property({ type: Number }) thickness = GardenRoom.WallThickness;
    @property({ type: Number }) curve = 0;
    @property({ type: Number }) segments = 16;
    @property({ type: Boolean }) smooth = false;
    @property({ type: Boolean }) closed = false;
    // `slot` is the native HTMLElement property (reflects the `slot` attribute) --
    // used in room-slot mode; no need to redeclare it as a reactive property.

    /**
     * Room-slot mode: the parent {@link GardenRoom} injects this side's two edge
     * endpoints (room-local) before it builds, so the wall doesn't need `points`.
     */
    edge?: [Vector3, Vector3];

    /** Resolve this wall's centreline, whatever mode it's in -- also used by the room. */
    centreline(): Vector3[] | null {
        let pts = this.points ? this.points.map(p => p.clone()) : null;
        if ((!pts || pts.length < 2) && this.edge)
            pts = [this.edge[0].clone(), this.edge[1].clone()];
        if (!pts || pts.length < 2)
            return null;

        if (pts.length === 2 && Math.abs(this.curve) > 1e-4)
            pts = arcPoints(pts[0], pts[1], this.curve, Math.max(2, Math.round(this.segments)));

        if (this.closed && !pts[0].equalsWithEpsilon(pts[pts.length - 1], 1e-4))
            pts.push(pts[0].clone());

        return pts;
    }

    updated(): void {
        // Room-slot mode: the room builds this side into its own mesh. Building a
        // second, overlapping mesh here would z-fight with it.
        if (this.slot && this.parentElement instanceof GardenRoom)
            return;

        this.beginBuild();
        try {
            let line = this.centreline();
            if (!line)
                return;

            let mesh = createWall(this.id ?? "wall", line, this.height, this.thickness, this.getScene(), this.smooth);
            if (!mesh)
                return;

            // A sensible default (matte, same plaster as a room wall, visible from
            // both faces since a partition is seen from both sides). setMesh() then
            // layers any `colour` attribute or <garden-material> child over this.
            let mat = new StandardMaterial("wall", this.getScene());
            mat.diffuseColor = GardenRoom.COLORS.north;
            mat.specularColor = Color3.Black();
            mat.backFaceCulling = false;
            mesh.material = mat;

            this.setMesh(mesh);
        } finally {
            this.endBuild();
        }
    }
}
