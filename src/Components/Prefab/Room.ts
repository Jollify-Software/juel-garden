import { Color3, Mesh, MeshBuilder, MultiMaterial, StandardMaterial, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";
import { GardenMaterial } from "../Material";

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

@customElement("garden-room")
export class GardenRoom extends GardenMesh {
    static WallHeight = 6;
    static WallThickness = 0.2;

    static COLORS = {
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

    @property({ attribute: "floor-color", converter: ColorConverter }) floorColor: Color3 = GardenRoom.COLORS.floor;
    @property({ attribute: "north-color", converter: ColorConverter }) northColor: Color3 = GardenRoom.COLORS.north;
    @property({ attribute: "east-color", converter: ColorConverter }) eastColor: Color3 = GardenRoom.COLORS.east;
    @property({ attribute: "south-color", converter: ColorConverter }) southColor: Color3 = GardenRoom.COLORS.south;
    @property({ attribute: "west-color", converter: ColorConverter }) westColor: Color3 = GardenRoom.COLORS.west;

    constructor() {
        super();
        this.width = 8;
        this.height = GardenRoom.WallHeight;
        this.depth = 16;
        this.thickness = 0.2;
    }

    updated(): void {
        this.beginBuild();

        let scene = this.getScene();
        let hh = this.height / 2;
        let ht = this.thickness / 2;
        let dt = this.thickness * 2;

        // Dispose previous mesh if exists
        if (this.mesh) {
            this.mesh.dispose();
        }

        // Materials
        const createMaterial = (name: string, color: Color3) => {
            const mat = new StandardMaterial(name, scene);
            mat.diffuseColor = color;
            return mat;
        };

        let floor = MeshBuilder.CreateBox("floor", {
            width: this.width,
            height: this.thickness,
            depth: this.depth
        }, scene);
        floor.material = createMaterial("mat-floor", this.floorColor);

        let wallN = MeshBuilder.CreateBox("wall-north", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene);
        wallN.position = new Vector3(0, hh, (this.depth / 2) - (this.thickness / 2));
        wallN.material = createMaterial("mat-north", this.northColor);

        let wallE = MeshBuilder.CreateBox("wall-east", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene);
        wallE.position = new Vector3((this.width / 2) - (this.thickness / 2), hh, 0);
        wallE.material = createMaterial("mat-east", this.eastColor);

        let wallS = MeshBuilder.CreateBox("wall-south", {
            width: this.width,
            height: this.height - this.thickness,
            depth: this.thickness
        }, scene);
        wallS.position = new Vector3(0, hh, -(this.depth / 2) + (this.thickness / 2));
        wallS.material = createMaterial("mat-south", this.southColor);

        let wallW = MeshBuilder.CreateBox("wall-west", {
            width: this.thickness,
            height: this.height - this.thickness,
            depth: this.depth - dt
        }, scene);
        wallW.position = new Vector3(-(this.width / 2) + (this.thickness / 2), hh, 0);
        wallW.material = createMaterial("mat-west", this.westColor);

        // Merge walls and floor
        const roomMesh = Mesh.MergeMeshes([floor, wallN, wallE, wallS, wallW], true, true, undefined, false, true);
        this.setMesh(roomMesh);
        this.fixMaterialIndices();

        this.endBuild();

        // Not awaited: the mesh above must exist synchronously (with its flat-colour
        // fallback materials) as soon as updated() returns, since <garden-structure>
        // reads a room's whenReady/mesh without itself waiting on document-load timing
        // (see GardenStructure.updated()) -- making this method, or updated() itself,
        // await whenDocumentReady() up front would race that. Any <garden-material
        // slot="..."> children are instead applied afterwards, in place, on the
        // MultiMaterial that MergeMeshes just built.
        this.applyMaterialSlots(roomMesh);
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
     */
    fixMaterialIndices(): void {
        if (!this.mesh || !(this.mesh.material instanceof MultiMaterial))
            return;

        this.mesh.computeWorldMatrix(true);
        let overall = this.mesh.getBoundingInfo().boundingBox;
        // Must match the [floor, wallN, wallE, wallS, wallW] order MergeMeshes was
        // called with in updated() above -- this is the array subMaterials is indexed
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
     * A <garden-material slot="floor"/"north"/"east"/"south"/"west"> child, if present,
     * takes full precedence over that wall's legacy *-color attribute -- same pattern as
     * GardenRoof's outside/inside slots -- letting a wall carry a texture (e.g. temple
     * stonework) instead of just a flat colour. Applied by mutating the existing
     * MultiMaterial's subMaterials in place (matching the [floor, north, east, south,
     * west] order MergeMeshes was called with above) rather than rebuilding the mesh, so
     * it still applies correctly even if <garden-structure> has already CSG-cut this
     * room's mesh by the time this resolves -- a CSG cut reuses the same MultiMaterial
     * instance, it doesn't clone it.
     */
    private async applyMaterialSlots(mesh: Mesh): Promise<void> {
        await GardenRoom.whenDocumentReady();

        let multi = mesh.material;
        if (!(multi instanceof MultiMaterial))
            return;

        const slots: ["floor" | "north" | "east" | "south" | "west", number][] =
            [["floor", 0], ["north", 1], ["east", 2], ["south", 3], ["west", 4]];

        await Promise.all(slots.map(async ([slot, index]) => {
            let materialEl = this.getMaterialSlot(slot);
            if (!materialEl)
                return;
            await materialEl.whenReady;
            multi.subMaterials[index] = materialEl.material;
        }));
    }
}