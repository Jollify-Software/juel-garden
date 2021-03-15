import { DynamicTexture, StandardMaterial } from "babylonjs";
import html2canvas from "html2canvas";
import { GardenMesh } from "./GardenMesh";
import rasterizeHTML from "rasterizehtml";
import { borderBottomLeftRadius } from "html2canvas/dist/types/css/property-descriptors/border-radius";

export class HtmlTexture {
    texture: DynamicTexture;

    constructor(private element: GardenMesh) {
        let scene = element.getScene();
        this.texture = new DynamicTexture("HtmlTexture", 512, scene, false);

        setTimeout(() => {

            
            let mat = element.getMaterial() as StandardMaterial;
            
            let ctx = this.texture.getContext();

            html2canvas(document.getElementsByTagName("h2")[0], {
                height: 100,
                ignoreElements: (el) => {
                    if (el.tagName.startsWith("JUEL") || el.tagName.startsWith("GARDEN")) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }).then((canvas) => {
                document.body.append(canvas);
                let img = new Image();
                img.src = canvas.toDataURL();
                console.log(img.width + ' ' + img.width)
                img.onload = () => {
                    ctx.drawImage(img, 0, 0)//, 100, 100, 0, 0, 500, 1200);
                    this.texture.update();
                    mat.diffuseTexture = this.texture;
                };
            });
        });
    }
}