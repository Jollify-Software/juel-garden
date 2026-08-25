import { Mesh } from "babylonjs";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

/**
 * A ready-made textured box house with a prism roof, merged into a single
 * mesh -- a direct port of the classic Babylon.js "village" tutorial house.
 * Has no configurable attributes; use `position`/`rotation`/`scale` to place
 * it, or copy its `updated()` body as a starting point for a custom variant.
 *
 * @example
 * ```html
 * <garden-house position="-6 0 -3"></garden-house>
 * ```
 *
 * @category Components - Prefabs
 */
@customElement("garden-house")
export class GardenHouse extends GardenMesh {
    updated() {
        // GardenElement/GardenMesh's update() never calls super.update(), so Lit's own
        // render()-into-renderRoot step (which would have built these from a template)
        // never runs for any component in this library -- built by hand instead, like
        // every other component here that needs child elements (see GardenButton,
        // GardenText, GardenInfo).
        if (this.children.length === 0) {
            let box = document.createElement("garden-box");
            box.setAttribute("position", "0 0.5 0");
            box.setAttribute("texture", "https://assets.babylonjs.com/environments/cubehouse.png");
            box.setAttribute("faceuv", "0.5 0.0 0.75 1.0,0.0 0.0 0.25 1.0,0.25 0 0.5 1.0,0.75 0 1.0 1.0");
            box.setAttribute("wrap", "true");

            let roofEl = document.createElement("garden-cylinder");
            roofEl.setAttribute("position", "0 0.72 0");
            roofEl.setAttribute("scale", "-0.25 0 0");
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