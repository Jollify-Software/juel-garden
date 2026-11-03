import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

/**
 * A flat ground plane, via Babylon's `MeshBuilder.CreateGround`. The default
 * teleport target for `<garden-webxr>` (see {@link "Components/WebXR"!GardenWebXR}) when no
 * `floor` attribute is given.
 *
 * Attributes: `width`, `height`, `subdivisions` (plus the common
 * {@link GardenMesh} set, notably `collisions`). With no `colour` and no
 * `<garden-material>` child it defaults to a muted grass green rather than
 * Babylon's default grey.
 *
 * @example
 * ```html
 * <garden-ground width="150" height="160" colour="green" collisions></garden-ground>
 * ```
 *
 * @category Components
 */
@customElement("garden-ground")
export class GardenGround extends GardenMesh {
    /** Fallback ground colour when the element carries neither a `colour` attribute nor a `<garden-material>` child. */
    static DEFAULT_COLOUR = "#6b8f4e";

    updated() {
        let scene = this.getScene();
        let options = this.buildOptions();
        this.setMesh(
            MeshBuilder.CreateGround(this.id ?? "ground", options, scene)
        );

        this.applyDefaultMaterial(this.mesh);

        super.updated();
    }

    /**
     * A bare `<garden-ground>` should read as grass, not Babylon's default grey.
     * A `colour` attribute is applied synchronously by setMesh(); a
     * `<garden-material>` child is applied async (see GardenMesh.modifyMesh), so
     * check the element for one directly rather than the mesh's material. In the
     * initial markup this element upgrades on its opening tag, before the parser
     * has reached its children, so the check waits for the document first (the
     * render loop doesn't start until then either, so nothing shows grey).
     */
    private async applyDefaultMaterial(mesh: Mesh) {
        await GardenElement.whenDocumentReady();
        if (this.mesh != mesh
            || this.hasAttribute("colour")
            || this.querySelector(":scope > garden-material")
            || mesh.material != null)
            return;
        let mat = new StandardMaterial("ground", this.getScene());
        mat.diffuseColor = Color3.FromHexString(GardenGround.DEFAULT_COLOUR);
        mat.specularColor = Color3.Black();
        mesh.material = mat;
    }
}