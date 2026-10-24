import { NodeGeometry } from "@babylonjs/core/Meshes/Node/nodeGeometry";
import { customElement, property } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";
import { setNodeInputs } from "./Material";

/**
 * A mesh made by a node geometry (Babylon's Node Geometry Editor's output): `src`, a
 * JSON file's URL, or `#ID` on Babylon's snippet server; `input-<name>="value"` sets
 * its input block of that name (a number, or 2–4 for a vector) before it's built.
 * A `<garden-material>` child dresses it, as for any mesh. `element.nodeGeometry` is
 * Babylon's NodeGeometry.
 * @example
 * ```html
 * <garden-node-geometry src="ground.json" input-resolutionx="18">
 *   <garden-material node="groundShader.json"></garden-material>
 * </garden-node-geometry>
 * ```
 * @category Components
 */
@customElement("garden-node-geometry")
export class GardenNodeGeometry extends GardenMesh {
    @property() src: string;

    nodeGeometry: NodeGeometry;

    async updated() {
        this.beginBuild();
        try {
            let geometry: NodeGeometry;
            if (this.src.startsWith("#")) {
                geometry = await NodeGeometry.ParseFromSnippetAsync(this.src.slice(1));
            } else {
                let response = await fetch(this.src);
                geometry = NodeGeometry.Parse(await response.json());
            }
            setNodeInputs(this, geometry, "<garden-node-geometry>");
            geometry.build();
            this.nodeGeometry = geometry;
            this.setMesh(geometry.createMesh(this.id || "nodeGeometry", this.getScene()));
            super.updated();
        } catch (e) {
            console.warn(`<garden-node-geometry> couldn't build "${this.src}": ${e}`);
        } finally {
            this.endBuild();
        }
    }
}
