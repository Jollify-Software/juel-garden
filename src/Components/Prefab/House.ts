import { Mesh } from "babylonjs";
import { html } from "lit";
import { customElement } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-house")
export class GardenHouse extends GardenMesh {
    updated() {
        let house = this.firstElementChild as GardenMesh;
        let roof = house.firstElementChild as GardenMesh;
        Promise.all([house.updateComplete, roof.updateComplete]).then(() => {
            this.setMesh(
                Mesh.MergeMeshes([house.mesh, roof.mesh], true, false, null, false, true)
            );

        });
    }
    render() {
        return html`
        <garden-box position="0 0.5 0"
                texture="https://assets.babylonjs.com/environments/cubehouse.png"
                faceuv="0.5 0.0 0.75 1.0,0.0 0.0 0.25 1.0,0.25 0 0.5 1.0,0.75 0 1.0 1.0" wrap="true">

                <garden-cylinder position="0 0.72 0" scale="-0.25 0 0" rotation="0 0 90"
                    diameter="1.3" height="1.2" tessellation="3"
                    texture="https://assets.babylonjs.com/environments/roof.jpg"></garden-cylinder>
            </garden-box>
        `;
    }
}