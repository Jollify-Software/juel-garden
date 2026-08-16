import { CSG, Mesh, MeshBuilder, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";
import { GardenRoom } from "./Room";

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
 * Caveat: detection is purely bounding-box based, so it only works for axis-aligned,
 * box-ish geometry (rooms, stairs). Rotated children or curved shapes (a `curvature`
 * stairway, a dome roof) won't have a bounding box that reflects where they actually
 * touch, so joins involving those still need a hand-placed <garden-opening>.
 */
@customElement("garden-structure")
export class GardenStructure extends GardenElement {
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
        let otherAxes = AXES.filter(axis => axis !== touchAxis);

        // The remaining axes must actually overlap (not just also be near-touching),
        // otherwise the two shapes are aligned but not adjacent.
        if (otherAxes.some(axis => overlap[axis].hi <= overlap[axis].lo))
            return;

        this.cut(a, b, touchAxis, otherAxes, overlap, aBox.minimumWorld, bBox.minimumWorld);
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
        }

        cutter.dispose();
    }
}
