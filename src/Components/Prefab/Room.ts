import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

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

        this.endBuild();
    }
}