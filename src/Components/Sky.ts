import { MeshBuilder, StandardMaterial, CubeTexture, Texture, Color3 } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenMesh } from "../GardenMesh";

@customElement("garden-sky")
export class GardenSky extends GardenMesh {
    @property() root: string;

    updated() {
        let scene = this.getScene();

        const skybox = MeshBuilder.CreateBox("skyBox", this.buildOptions(), scene);
const skyboxMaterial = new StandardMaterial("skyBox", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.reflectionTexture = new CubeTexture(this.root, scene);
skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
skyboxMaterial.specularColor = new Color3(0, 0, 0);
skybox.material = skyboxMaterial;
this.setMesh(skybox);
    }
}