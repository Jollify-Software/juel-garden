import { Vector3 } from "babylonjs";
import { Mesh, MeshBuilder } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

/**
 * A vertical column, standing on the ground with its base at local `y = 0`
 * (unlike a plain `<garden-cylinder>`, which centres on its own origin).
 * Useful as a support/decoration, e.g. with a `<garden-particle effect="fire">`
 * child as a torch.
 *
 * Attributes: `height`, `type` (`"round"`, the only type today), plus the
 * common {@link GardenMesh} set (`diameter` comes from the shared
 * `OptionsBuilder`).
 *
 * @example
 * ```html
 * <garden-column position="-4 -5 -22" diameter="1" height="6">
 *   <garden-particle effect="fire"></garden-particle>
 * </garden-column>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-column")
export class GardenColumn extends GardenMesh {
    @property({ type: Number }) height: number;
    @property({ type: String }) type: string;

    constructor() {
        super();
        this.type = "round";
    }

    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        let mesh: Mesh;
        switch (this.type) {
            case "round":
                mesh = MeshBuilder.CreateCylinder("roof", options, scene)
                break;
        
            default:
                break;
        }
        mesh.position = new Vector3(0, this.height/2, 0);
        this.setMesh(mesh);
    }
}