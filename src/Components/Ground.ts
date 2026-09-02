import { Color3, MeshBuilder, StandardMaterial } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";
import { OptionsBuilder } from "../Options/OptionsBuilder";

/**
 * A flat ground plane, via Babylon's `MeshBuilder.CreateGround`. The default
 * teleport target for `<garden-webxr>` (see {@link GardenWebXR}) when no
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

        // A bare <garden-ground> should read as grass, not Babylon's default grey.
        // A `colour` attribute is applied synchronously by setMesh() above; a
        // <garden-material> child is applied async (see GardenMesh.modifyMesh), so
        // check the element for one directly rather than the mesh's material.
        if (!this.hasAttribute("colour")
            && !this.querySelector(":scope > garden-material")
            && this.mesh.material == null) {
            let mat = new StandardMaterial("ground", scene);
            mat.diffuseColor = Color3.FromHexString(GardenGround.DEFAULT_COLOUR);
            mat.specularColor = Color3.Black();
            this.mesh.material = mat;
        }

        super.updated();
    }
}