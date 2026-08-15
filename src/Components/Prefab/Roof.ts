import { Mesh, MeshBuilder, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";
import { createDomeRoof } from "../../Utils/Mesh/createDomeRoof";
import { GardenRoom } from "./Room";

@customElement("garden-roof")
export class GardenRoof extends GardenMesh {
    @property() type: string;
    @property({ type: Number }) thickness: number;

    constructor() {
        super();
        this.type = "flat";
    }

    async updated() {
        let room = this.parentElement;
        if (!(room instanceof GardenRoom)) {
            console.warn("<garden-roof> must be a child of <garden-room>.");
            return;
        }

        this.beginBuild();
        try {
            await room.whenReady;

            let scene = this.getScene();
            let thickness = this.thickness ?? room.thickness;
            let mesh: Mesh;

            switch (this.type) {
                case "dome":
                    mesh = createDomeRoof("roof", room.width, room.depth, scene, thickness);
                    break;

                case "flat":
                default:
                    mesh = MeshBuilder.CreateBox("roof", {
                        width: room.width,
                        height: thickness,
                        depth: room.depth
                    }, scene);
                    break;
            }

            mesh.parent = room.getNode();
            mesh.position = new Vector3(0, room.height, 0);

            this.setMesh(mesh);
        } finally {
            this.endBuild();
        }
    }
}
