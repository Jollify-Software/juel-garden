import { CSG, MeshBuilder, Scene, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../../Converters/Vector3Convert";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";
import { GardenRoom } from "./Room";

@customElement("garden-opening")
export class GardenDoorway extends GardenMesh {
    @property() type: string;
    @property() between: string;
    @property({ type: Boolean }) step: boolean;
    @property({ type: Number }) width: number;
    @property({ type: Number }) height: number;
    @property({ type: Number }) depth: number;

    @property({ converter: Vector3Convert.fromString }) position: Vector3;

    constructor() {
        super();
        this.step = false;
        this.type = "square";
        this.width = 3;
        this.height = GardenRoom.WallHeight - 1;
        this.depth = GardenRoom.WallThickness * 2;
    }

    async updated() {
        if (!this.between)
            return;

        this.beginBuild();
        try {
            let scene = this.getScene();

            switch (this.type) {
                case "square":
                    this.mesh = MeshBuilder.CreateBox("opening", {
                        width: this.width,
                        height: this.height,
                        depth: this.depth
                    }, scene);
                    break;

                default:
                    break;
            }
            if (this.position) {
                this.mesh.position = this.position.add(
                    new Vector3(0, 0.5, 0)
                );
            }

            this.mesh.isVisible = false;
            let thisCsg = CSG.FromMesh(this.mesh);

            let ids = this.between.split(' ');
            let targets = await Promise.all(ids.map(id => GardenElement.byId<GardenMesh>(id)));

            for (let el of targets) {
                if (el) {
                    let thatCsg = CSG.FromMesh(el.mesh);
                    let mat = el.getMaterial();
                    el.setMesh(
                        thatCsg.subtract(thisCsg).toMesh(el.id, mat, scene, true)
                    );
                }
            }
        } finally {
            this.endBuild();
        }
    }
}