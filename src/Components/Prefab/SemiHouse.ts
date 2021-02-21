import { Mesh, MeshBuilder } from "babylonjs";
import { customElement, html } from "lit-element";
import { GardenMesh } from "../../GardenMesh";

@customElement("juel-semi-house")
export class JuelSemiHouse extends GardenMesh {
    firstUpdated() {
        let house = this.firstElementChild as GardenMesh;
        let roof = house.firstElementChild as GardenMesh;
        Promise.all([house.updateComplete, roof.updateComplete]).then(() => {
            this.mesh = Mesh.MergeMeshes([house.mesh, roof.mesh], true, false, null, false, true);
            this.modifyMesh();
        });
    }
    render() {
        return html`
        <juel-box merge position="0 0.5 0" width="2"
                texture="https://assets.babylonjs.com/environments/semihouse.png"
                faceuv="0.6 0.0 1.0 1.0,0.0 0.0 0.4 1.0,0.4 0 0.6 1.0,0.4 0 0.6 1.0" wrap="true">

                <juel-cylinder position="0 0.72 0" scale="-0.25 1 0" rotation="0 0 90"
                    diameter="1.3" height="1.2" tessellation="3"
                    texture="https://assets.babylonjs.com/environments/roof.jpg"></juel-cylinder>
            </juel-box>
        `;
    }
}