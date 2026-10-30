import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { customElement } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";

/**
 * A lathed (revolved-profile) mesh, via Babylon's `MeshBuilder.CreateLathe` --
 * sweeps a 2D `shape` profile around the Y axis, e.g. a vase or fountain bowl.
 *
 * Attributes: `shape` (a `Vector3` array profile, see {@link "Converters/Vector3Convert"!Vector3Convert.array}),
 * `tessellation`, `sideorientation` (plus the common {@link GardenMesh} set). Without a
 * `shape` it builds nothing (with a console warning).
 *
 * @category Components
 */
@customElement("garden-lathe")
export class GardenLathe extends GardenMesh {
    updated() {
        // No profile, nothing to turn: build nothing rather than throw.
        if (!this.getAttribute("shape")?.trim()) {
            console.warn("garden-lathe: no `shape`, so nothing is built");
            return;
        }
        let scene = this.getScene();
        this.setMesh(
            MeshBuilder.CreateLathe("fountain", <any>this.buildOptions(), scene)
        );
    }
}