import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { customElement } from "lit/decorators.js";
import { GardenMesh } from "../../GardenMesh";

/**
 * A half-width variant of {@link GardenHouse}, for a semi-detached pair --
 * from the same classic Babylon.js "village" tutorial. Has no configurable
 * attributes; use `position`/`rotation`/`scale` to place it.
 *
 * @example
 * ```html
 * <garden-semi-house position="-3 0 -3"></garden-semi-house>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-semi-house")
export class GardenSemiHouse extends GardenMesh {
    /**
     * The merge below consumes the walls' and roof's own meshes, so a rebuild has them
     * built again first (they're children: generated, or the author's).
     */
    protected unbuild() {
        let house = this.firstElementChild as GardenMesh;
        let roof = house?.firstElementChild as GardenMesh;
        for (let el of [house, roof])
            el?.requestUpdate();
        super.unbuild();
    }

    updated() {
        // See GardenHouse.updated() -- Lit's own render()-into-renderRoot step never
        // runs for any component in this library, so these are built by hand.
        if (this.children.length === 0) {
            let box = document.createElement("garden-box");
            box.setAttribute("position", "0 0.5 0");
            box.setAttribute("width", "2");
            box.setAttribute("texture", "https://assets.babylonjs.com/environments/semihouse.png");
            box.setAttribute("faceuv", "0.6 0.0 1.0 1.0,0.0 0.0 0.4 1.0,0.4 0 0.6 1.0,0.4 0 0.6 1.0");
            box.setAttribute("wrap", "true");

            let roofEl = document.createElement("garden-cylinder");
            roofEl.setAttribute("position", "0 0.72 0");
            roofEl.setAttribute("scale", "-0.25 1 0");
            roofEl.setAttribute("rotation", "0 0 90");
            roofEl.setAttribute("diameter", "1.3");
            roofEl.setAttribute("height", "1.2");
            roofEl.setAttribute("tessellation", "3");
            roofEl.setAttribute("texture", "https://assets.babylonjs.com/environments/roof.jpg");

            box.appendChild(roofEl);
            this.appendChild(box);
        }

        let house = this.firstElementChild as GardenMesh;
        let roof = house.firstElementChild as GardenMesh;
        Promise.all([house.updateComplete, roof.updateComplete]).then(() => {
            this.setMesh(
                Mesh.MergeMeshes([house.mesh, roof.mesh], true, false, null, false, true)
            );
        });
    }
}