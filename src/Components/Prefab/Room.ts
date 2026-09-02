import { Color3, Mesh, MeshBuilder, MultiMaterial, PolygonMeshBuilder, Scene, StandardMaterial, Vector2, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import earcut from "earcut";
import { GardenMesh } from "../../GardenMesh";
import { GardenMaterial } from "../Material";
import { createWall } from "../../Utils/Mesh/createWall";
import type { GardenWall } from "./Wall";

// Example ColorConverter (should be imported or defined elsewhere)
export const ColorConverter = {
    fromAttribute(value: string): Color3 {
        if (!value) return Color3.White();
        try {
            if (value.startsWith("#")) {
                return Color3.FromHexString(value);
            }
            // Try named color using a dummy element
            const ctx = document.createElement("canvas").getContext("2d");
            if (ctx) {
                ctx.fillStyle = value;
                const rgb = ctx.fillStyle.match(/^#([0-9a-f]{6})$/i);
                if (rgb) {
                    return Color3.FromHexString(rgb[0]);
                }
            }
        } catch {}
        return Color3.White();
    },
    toAttribute(value: Color3): string {
        return value.toHexString();
    }
};

type WallSide = "north" | "east" | "south" | "west";
const WALL_SIDES: WallSide[] = ["north", "east", "south", "west"];

/**
 * A room: a floor plus walls, merged into one mesh with a `MultiMaterial` so
 * each surface can carry its own colour or texture. Combine several under a
 * `<garden-structure>` to have shared walls auto-cut into doorways (see
 * {@link GardenStructure}), or add a `<garden-roof>` child.
 *
 * With no children a room is a plain rectangular box (`width` x `depth` x
 * `height`). Any of its four sides can instead be a `<garden-wall
 * slot="north"|"east"|"south"|"west">` child -- straight, or bowed with that
 * wall's `curve` attribute -- for an apsidal end, a bow front, or (all four
 * curved) a rounded room. `type="rotunda"` is the shortcut for a fully circular
 * room: a round floor and one swept wall.
 *
 * When any side is curved, the floor is generated from the actual wall loop
 * (triangulated with `earcut`) rather than the `width` x `depth` slab.
 *
 * Attributes: `width`, `height`, `depth`, `thickness`, `type` (`"rect"` default,
 * or `"rotunda"`), `floor-color`/`north-color`/`east-color`/`south-color`/
 * `west-color` (each may instead be overridden by a `<garden-material
 * slot="floor"|"north"|"east"|"south"|"west">` child -- a room with curved wall
 * slots, or `type="rotunda"`, has one wall material instead: `slot="wall"` --
 * which takes full precedence), `debug-colors` (swap the neutral
 * default palette for the per-face black/green/red/blue/yellow one, to tell the
 * faces apart while positioning).
 *
 * @example
 * ```html
 * <garden-room id="r1" width="8" height="6" depth="16" collisions></garden-room>
 *
 * <garden-room width="10" depth="8" height="6">
 *   <garden-wall slot="north" curve="2"></garden-wall>
 * </garden-room>
 *
 * <garden-room type="rotunda" width="12" height="7"></garden-room>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-room")
export class GardenRoom extends GardenMesh {
    static WallHeight = 6;
    static WallThickness = 0.2;

    /**
     * Default surface colours: a neutral architectural palette -- a warm stone
     * floor and off-white plaster walls -- so a room with no explicit `*-color`
     * attribute or `<garden-material>` child still reads as a real room rather
     * than a box of primary colours. All four walls share one colour; the four
     * slots stay separate only so a wall can still be given its own texture.
     */
    static COLORS = {
        floor: Color3.FromHexString("#9c968c"),
        north: Color3.FromHexString("#e0dcd3"),
        east: Color3.FromHexString("#e0dcd3"),
        south: Color3.FromHexString("#e0dcd3"),
        west: Color3.FromHexString("#e0dcd3")
    };

    /**
     * The old per-face palette (floor black, north green, east red, south blue,
     * west yellow), kept as an opt-in via the `debug-colors` attribute: it makes
     * every wall instantly identifiable while positioning a scene.
     */
    static DEBUG_COLORS = {
        floor: Color3.Black(),
        north: Color3.Green(),
        east: Color3.Red(),
        south: Color3.Blue(),
        west: Color3.Yellow()
    };

    @property({ type: Number }) width: number;
    @property({ type: Number }) height: number;
    @property({ type: Number }) depth: number;
    @property({ type: Number }) thickness: number;
    @property() type = "rect";

    @property({ type: Boolean, attribute: "debug-colors" }) debugColors = false;

    // Deliberately left undefined unless the attribute is actually present, so
    // updated() can fall back to whichever palette `debug-colors` selects -- a
    // field initializer would bake in the neutral palette before that flag is read.
    @property({ attribute: "floor-color", converter: ColorConverter }) floorColor?: Color3;
    @property({ attribute: "north-color", converter: ColorConverter }) northColor?: Color3;
    @property({ attribute: "east-color", converter: ColorConverter }) eastColor?: Color3;
    @property({ attribute: "south-color", converter: ColorConverter }) southColor?: Color3;
    @property({ attribute: "west-color", converter: ColorConverter }) westColor?: Color3;

    /**
     * True once this room built as a rotunda or with `<garden-wall>` slots: the
     * mesh then carries just two submaterials -- `[floor, wall]` -- instead of
     * `[floor, north, east, south, west]`, so {@link fixMaterialIndices} and
     * {@link applyMaterialSlots} switch to the two-slot layout. A plain box room
     * keeps the five-way per-face model.
     */
    private twoSlotModel = false;

    /**
     * The room's wall-outline centreline in local space (open ring, no repeated
     * closing point), set by {@link buildWithWallSlots} / {@link buildRotunda}.
     * `<garden-structure>` reads it to auto-join a curved room to a neighbour,
     * since such a room's bounding box bulges past its real wall line. Left
     * undefined for a plain box room (the box test handles those).
     */
    wallLoop?: Vector3[];

    constructor() {
        super();
        this.width = 8;
        this.height = GardenRoom.WallHeight;
        this.depth = 16;
        this.thickness = 0.2;
    }

    async updated(): Promise<void> {
        this.beginBuild();
        try {
            // A room with custom wall slots has to read its <garden-wall> children,
            // whose own attributes/upgrade aren't guaranteed until the document is
            // parsed. beginBuild() was called synchronously above, so a
            // <garden-structure> / <garden-roof> parent -- both of which await
            // whenReady before touching this.mesh -- still waits correctly.
            await GardenRoom.whenDocumentReady();

            let scene = this.getScene();

            if (this.mesh)
                this.mesh.dispose();

            // An explicit *-color attribute wins; otherwise fall back to the palette
            // `debug-colors` selects. A <garden-material> slot child, if present,
            // overrides even this -- applied later in applyMaterialSlots().
            const palette = this.debugColors ? GardenRoom.DEBUG_COLORS : GardenRoom.COLORS;
            const colors = {
                floor: this.floorColor ?? palette.floor,
                north: this.northColor ?? palette.north,
                east: this.eastColor ?? palette.east,
                south: this.southColor ?? palette.south,
                west: this.westColor ?? palette.west
            };

            const slots = this.getWallSlots();
            this.twoSlotModel = this.type === "rotunda" || Object.keys(slots).length > 0;

            let roomMesh: Mesh;
            if (this.type === "rotunda")
                roomMesh = this.buildRotunda(scene, colors);
            else if (this.twoSlotModel)
                roomMesh = this.buildWithWallSlots(scene, colors, slots);
            else
                roomMesh = this.buildBox(scene, colors);

            this.setMesh(roomMesh);
            this.fixMaterialIndices();

            // Not awaited: a <garden-material slot="..."> child can pull a texture
            // over the network, which the room mesh shouldn't block on. Applied in
            // place on the MultiMaterial MergeMeshes just built.
            this.applyMaterialSlots(roomMesh);
        } finally {
            this.endBuild();
        }
    }

    /** Matte StandardMaterial -- interior plaster/stone, not plastic. */
    private matte(name: string, color: Color3, scene: Scene, doubleSided = false): StandardMaterial {
        const mat = new StandardMaterial(name, scene);
        mat.diffuseColor = color;
        mat.specularColor = Color3.Black();
        if (doubleSided)
            mat.backFaceCulling = false;
        return mat;
    }

    /** The classic rectangular room: floor slab + four wall boxes, inset so they don't overlap at the corners. */
    private buildBox(scene: Scene, colors: Record<string, Color3>): Mesh {
        this.wallLoop = undefined; // box rooms use <garden-structure>'s bounding-box join
        let hh = this.height / 2;
        let dt = this.thickness * 2;

        let floor = MeshBuilder.CreateBox("floor", {
            width: this.width,
            height: this.thickness,
            depth: this.depth
        }, scene);
        floor.material = this.matte("mat-floor", colors.floor, scene);

        let wallN = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene);
        wallN.position = new Vector3(0, hh, (this.depth / 2) - (this.thickness / 2));
        wallN.material = this.matte("mat-north", colors.north, scene);

        let wallE = MeshBuilder.CreateBox("wall-east", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene);
        wallE.position = new Vector3((this.width / 2) - (this.thickness / 2), hh, 0);
        wallE.material = this.matte("mat-east", colors.east, scene);

        let wallS = MeshBuilder.CreateBox("wall-south", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene);
        wallS.position = new Vector3(0, hh, -(this.depth / 2) + (this.thickness / 2));
        wallS.material = this.matte("mat-south", colors.south, scene);

        let wallW = MeshBuilder.CreateBox("wall-west", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene);
        wallW.position = new Vector3(-(this.width / 2) + (this.thickness / 2), hh, 0);
        wallW.material = this.matte("mat-west", colors.west, scene);

        // [floor, north, east, south, west] -- the order fixMaterialIndices /
        // applyMaterialSlots index subMaterials by.
        return Mesh.MergeMeshes([floor, wallN, wallE, wallS, wallW], true, true, undefined, false, true)!;
    }

    /**
     * A room where at least one side is a `<garden-wall slot="...">` child. The
     * four sides are concatenated into a single closed centreline loop and swept
     * as one continuous wall (see {@link createWall}) -- like the rotunda, and
     * for the same reason: one closed sweep has no end caps and no corner
     * seams to z-fight, where four separately-capped walls butted together do.
     * The floor is the earcut triangulation of that loop.
     *
     * The trade-off is a single wall colour for the whole room (the `north`
     * colour, or a `<garden-material slot="wall">` child) rather than one per
     * face -- per-face materials stay a plain-box feature. Merge order is
     * `[floor, wall]` (see {@link twoSlotModel}).
     */
    private buildWithWallSlots(scene: Scene, colors: Record<string, Color3>, slots: Partial<Record<WallSide, GardenWall>>): Mesh {
        // Pull the centreline in by half a wall thickness so the *outer* face
        // lands at +-width/2 -- the same outer extent a plain box room has, so
        // the two still meet flush for <garden-structure>'s bounding-box join.
        let inset = this.thickness / 2;
        let hw = this.width / 2 - inset;
        let hd = this.depth / 2 - inset;
        // Endpoint order per side is chosen so a positive `curve` (sagitta) bows
        // the wall *outward* from the room -- see arcPoints' rotate90 convention --
        // and so consecutive sides share an endpoint (N ends where E starts, ...).
        const edges: Record<WallSide, [Vector3, Vector3]> = {
            north: [new Vector3(-hw, 0, hd), new Vector3(hw, 0, hd)],
            east: [new Vector3(hw, 0, hd), new Vector3(hw, 0, -hd)],
            south: [new Vector3(hw, 0, -hd), new Vector3(-hw, 0, -hd)],
            west: [new Vector3(-hw, 0, -hd), new Vector3(-hw, 0, hd)]
        };

        let loop: Vector3[] = [];
        for (let side of WALL_SIDES) {
            let [a, b] = edges[side];
            let slotEl = slots[side];
            let seg: Vector3[];
            if (slotEl) {
                slotEl.edge = [a, b];
                seg = slotEl.centreline() ?? [a, b];
            } else {
                seg = [a, b];
            }
            for (let p of seg) {
                if (loop.length === 0 || !loop[loop.length - 1].equalsWithEpsilon(p, 1e-4))
                    loop.push(p.clone());
            }
        }
        // Open ring for <garden-structure> (see wallLoop); closed copy for the sweep.
        let closes = loop.length > 1 && loop[0].equalsWithEpsilon(loop[loop.length - 1], 1e-4);
        this.wallLoop = (closes ? loop.slice(0, -1) : loop).map(p => p.clone());
        if (!closes)
            loop.push(loop[0].clone());

        let wall = createWall("wall", loop, this.height, this.thickness, scene)!;
        wall.material = this.matte("mat-wall", colors.north, scene, true);

        let floor = this.buildFloorPolygon(scene, loop);
        floor.material = this.matte("mat-floor", colors.floor, scene);

        // [floor, wall] -- see twoSlotModel / applyMaterialSlots.
        return Mesh.MergeMeshes([floor, wall], true, true, undefined, false, true)!;
    }

    /** A round room: a cylinder-slab floor (top at y = 0) and one swept circular wall. */
    private buildRotunda(scene: Scene, colors: Record<string, Color3>): Mesh {
        let radius = this.width / 2;
        let tess = Math.max(24, Math.round(this.width * 4));

        let floor = MeshBuilder.CreateCylinder("floor", {
            diameter: this.width,
            height: this.thickness,
            tessellation: tess
        }, scene);
        floor.position.y = -this.thickness / 2;
        floor.material = this.matte("mat-floor", colors.floor, scene);

        // Pull the centreline in by half the thickness so the outer face sits at
        // roughly `width`.
        let wallR = Math.max(radius - this.thickness / 2, 0.01);
        let ring: Vector3[] = [];
        for (let i = 0; i <= tess; i++) {
            let ang = (i / tess) * Math.PI * 2;
            ring.push(new Vector3(Math.cos(ang) * wallR, 0, Math.sin(ang) * wallR));
        }
        // Open ring (drop the repeated closing point) for <garden-structure>'s join.
        this.wallLoop = ring.slice(0, tess).map(p => p.clone());
        let wall = createWall("wall", ring, this.height, this.thickness, scene)!;
        wall.material = this.matte("mat-wall", colors.north, scene, true);

        // [floor, wall] -- rotunda's own two-slot order (see applyMaterialSlots).
        return Mesh.MergeMeshes([floor, wall], true, true, undefined, false, true)!;
    }

    /** Flat floor filling a wall loop, triangulated with earcut; top face at y = 0. */
    private buildFloorPolygon(scene: Scene, loop: Vector3[]): Mesh {
        let ring = loop.slice();
        while (ring.length > 1 && ring[0].equalsWithEpsilon(ring[ring.length - 1], 1e-4))
            ring.pop();

        let pmb = new PolygonMeshBuilder("floor", ring.map(p => new Vector2(p.x, p.z)), scene, earcut);
        // build(updatable, depth): polygon sits at y = 0 and extrudes downward by
        // `depth`, so its walkable top face lines up with where the walls start.
        return pmb.build(false, this.thickness);
    }

    /** Direct `<garden-wall slot="north"|"east"|"south"|"west">` children, keyed by side. */
    private getWallSlots(): Partial<Record<WallSide, GardenWall>> {
        let out: Partial<Record<WallSide, GardenWall>> = {};
        for (let el of (<Element[]>Array.prototype.slice.call(this.children))) {
            if (!el.matches('garden-wall[slot]'))
                continue;
            let side = el.getAttribute('slot') as WallSide;
            if (WALL_SIDES.indexOf(side) >= 0)
                out[side] = el as unknown as GardenWall;
        }
        return out;
    }

    /**
     * Reassigns every submesh's materialIndex by comparing its own world-space bounding
     * box against the room's overall bounds, instead of trusting whatever index Babylon's
     * CSG library left it with. <garden-structure> cuts doorways/floor openings via
     * CSG.subtract().toMesh() (see GardenStructure), which -- empirically confirmed by
     * building this room-decorating feature -- does not reliably preserve which
     * submesh/materialIndex pairing belonged to which original wall once a room has been
     * cut more than once (e.g. a room with two wall joins *and* a <garden-stairs> floor
     * connection punched into it): the resulting mesh still had the right 5 colours/
     * textures in its MultiMaterial's subMaterials array, but the submesh actually sitting
     * at the south wall's position had been left pointing at the north wall's material
     * index, and vice versa. Classifying by geometry instead of trusting the index sidesteps
     * that regardless of how CSG scrambled it. Public so <garden-structure> can call it
     * again after each CSG cut it performs on a room (see GardenStructure.cut/cutFloor) --
     * cutting rebuilds the mesh's submeshes from scratch each time, so a fix applied before
     * a later cut doesn't survive it.
     *
     * For the two-slot model (rotunda or `<garden-wall>` slots -- see
     * {@link twoSlotModel}) there is no north/east/south/west geometry to classify;
     * submeshes are split floor vs. wall by height alone.
     */
    fixMaterialIndices(): void {
        if (!this.mesh || !(this.mesh.material instanceof MultiMaterial))
            return;

        this.mesh.computeWorldMatrix(true);

        if (this.twoSlotModel) {
            let bounds = this.mesh.getBoundingInfo().boundingBox;
            let floorTop = bounds.minimumWorld.y + this.thickness * 2;
            for (let subMesh of this.mesh.subMeshes) {
                let box = subMesh.getBoundingInfo().boundingBox;
                let cy = (box.minimumWorld.y + box.maximumWorld.y) / 2;
                subMesh.materialIndex = cy <= floorTop ? 0 : 1;
            }
            return;
        }

        let overall = this.mesh.getBoundingInfo().boundingBox;
        // Must match the [floor, wallN, wallE, wallS, wallW] order MergeMeshes was
        // called with above -- this is the array subMaterials is indexed
        // into, independent of whatever order CSG left the submeshes themselves in.
        let order = ["floor", "north", "east", "south", "west"];

        for (let subMesh of this.mesh.subMeshes) {
            let box = subMesh.getBoundingInfo().boundingBox;
            let cx = (box.minimumWorld.x + box.maximumWorld.x) / 2;
            let cy = (box.minimumWorld.y + box.maximumWorld.y) / 2;
            let cz = (box.minimumWorld.z + box.maximumWorld.z) / 2;

            let distances: [string, number][] = [
                ["floor", Math.abs(cy - overall.minimumWorld.y)],
                ["north", Math.abs(cz - overall.maximumWorld.z)],
                ["south", Math.abs(cz - overall.minimumWorld.z)],
                ["east", Math.abs(cx - overall.maximumWorld.x)],
                ["west", Math.abs(cx - overall.minimumWorld.x)],
            ];
            distances.sort((a, b) => a[1] - b[1]);
            subMesh.materialIndex = order.indexOf(distances[0][0]);
        }
    }

    /** Direct <garden-material slot="..."> child only -- not any nested inside a further child. */
    private getMaterialSlot(slot: string): GardenMaterial | null {
        return (<Element[]>Array.prototype.slice.call(this.children))
            .find((el): el is GardenMaterial => el.matches(`garden-material[slot="${slot}"]`)) ?? null;
    }

    /**
     * A <garden-material slot="floor"/"north"/"east"/"south"/"west"> child (or, for
     * a rotunda / curved-slot room, slot="floor"/"wall"), if present, takes full
     * precedence over that wall's
     * legacy *-color attribute -- same pattern as GardenRoof's outside/inside slots --
     * letting a wall carry a texture (e.g. temple stonework) instead of just a flat
     * colour. Applied by mutating the existing MultiMaterial's subMaterials in place
     * (matching the merge order above) rather than rebuilding the mesh, so it still
     * applies correctly even if <garden-structure> has already CSG-cut this room's
     * mesh by the time this resolves -- a CSG cut reuses the same MultiMaterial
     * instance, it doesn't clone it.
     */
    private async applyMaterialSlots(mesh: Mesh): Promise<void> {
        await GardenRoom.whenDocumentReady();

        let multi = mesh.material;
        if (!(multi instanceof MultiMaterial))
            return;

        const slots: [string, number][] = this.twoSlotModel
            ? [["floor", 0], ["wall", 1]]
            : [["floor", 0], ["north", 1], ["east", 2], ["south", 3], ["west", 4]];

        await Promise.all(slots.map(async ([slot, index]) => {
            if (index >= multi.subMaterials.length)
                return;
            let materialEl = this.getMaterialSlot(slot);
            if (!materialEl)
                return;
            await materialEl.whenReady;
            multi.subMaterials[index] = materialEl.material;
        }));
    }
}
