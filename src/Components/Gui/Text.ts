import { TextBlock } from "babylonjs-gui";
import { customElement, property } from "lit/decorators";
import { GardenInfo } from "./Info";
import { GardenControl } from "./Control";
import { DynamicTexture } from "babylonjs";
import { MeshBuilder } from "babylonjs";
import { Mesh } from "babylonjs";

@customElement("garden-text")
export class GardenText extends GardenControl {
    @property() font: string;

    constructor() {
        super();
        this.font = "bold 44px monospace";
    }
    updated() {
        setTimeout(() => {
            let scene =  this.getScene();
            let parent = this.parentElement;
            let text =  this.textContent.replace(/^\s+|\s+$/gm, '');
            if (parent instanceof GardenInfo) {
            var label = new TextBlock();
            label.text = text;
            
            this.applyProperties(label);

                (<GardenInfo>this.parentElement).container.addControl(label);
            } else {
                // var textureGround = new DynamicTexture("dynamic texture",
                //     {width:512, height:256}, this.getScene(), false); 
                // let ctx = textureGround.getContext();
                // let m = ctx.measureText(text);
                // console.log(m);
                // textureGround.drawText(text, 0, 10, this.font, "red", "white")
                // let plane = MeshBuilder.CreatePlane("plane", {
                //     width: 20,
                //     height: 10,
                //     sideOrientation: Mesh.DOUBLESIDE
                // }, scene);
                // let mat = new CustomMaterial("mat", scene);
                // mat.diffuseTexture = textureGround;
                // mat.alpha = 0.0;
                // mat.Fragment_Custom_Alpha(`
                //     float myAlpha = 1.0;
                //     if (baseColor.r == 1.0 && baseColor.g == 1.0 && baseColor.b == 1.0 || baseColor.r > 0.3 && baseColor.b > 0.3)
                //         myAlpha = 0.0;
                //     result = myAlpha;
                // `)
                // plane.material = mat;
            }
        });
    }
}