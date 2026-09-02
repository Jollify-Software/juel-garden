import { CSG, MeshBuilder, Scene, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Vector3Convert } from "../../Converters/Vector3Convert";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";
import { GardenRoom } from "./Room";

/**
 * Cuts a doorway-shaped hole into one or more other meshes via CSG, wherever
 * a hand-placed opening is needed (e.g. a rotated or curved join that
 * `<garden-structure>`'s automatic bounding-box detection can't handle --
 * see {@link GardenStructure}).
 *
 * Attributes: `between` (selector of the mesh(es) to cut into, see
 * {@link resolveElements}), `type` (`"square"`, the only type today),
 * `width`, `height` (default room wall height minus 1), `depth` (default
 * double wall thickness), `position`.
 *
 * @example
 * ```html
 * <garden-opening between="#r1 #r2" position="0 1 -4" width="2" height="2" depth="0.4"></garden-opening>
 * ```
 *
 * @category Components - Prefabs
 */
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

            // `between` may reference elements later in the document (e.g. a room cut
            // against stairs that haven't been parsed yet), so wait for the document to
            // finish before resolving it.
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve =>
                    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
                );
            }

            let targets = await GardenElement.resolveReady<GardenMesh>(this.between);

            for (let el of targets) {
                let thatCsg = CSG.FromMesh(el.mesh);
                let mat = el.getMaterial();
                el.setMesh(
                    thatCsg.subtract(thisCsg).toMesh(el.id, mat, scene, true)
                );
                // CSG.subtract().toMesh() doesn't reliably keep each submesh pointing
                // at the material it started on (see GardenRoom.fixMaterialIndices) --
                // without this the freshly cut doorway reveal can come out wearing the
                // floor's material. GardenStructure does the same after its own cuts.
                if (el instanceof GardenRoom)
                    el.fixMaterialIndices();
            }
        } finally {
            this.endBuild();
        }
    }
}