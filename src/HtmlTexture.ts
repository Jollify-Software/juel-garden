import { DynamicTexture, StandardMaterial } from "babylonjs";
import html2canvas from "html2canvas";
import { GardenMesh } from "./GardenMesh";
import rasterizeHTML from "rasterizehtml";
import { borderBottomLeftRadius } from "html2canvas/dist/types/css/property-descriptors/border-radius";

/**
 * Rasterises a mesh's own light-DOM content (its first child element) into a
 * `DynamicTexture` via `html2canvas`, for `texture="html"` (see
 * {@link ModifyTextureSetter}) -- lets an element's inner HTML/CSS become the
 * mesh's surface texture instead of an image file.
 *
 * @category Core
 */
export class HtmlTexture {
    texture: DynamicTexture;

    constructor(private element: GardenMesh) {
        let scene = element.getScene();
        this.texture = new DynamicTexture("HtmlTexture", 512, scene, false);

        setTimeout(() => {
            let el = element.firstElementChild as HTMLElement;
            el.remove();
            document.body.prepend(el)

            let mat = element.getMaterial() as StandardMaterial;
            let ctx = this.texture.getContext();

            html2canvas(el, {
                height: 100,
                ignoreElements: (el) => {
                    if (el.tagName.startsWith("GARDEN")) {
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
                    //mat.diffuseTexture = this.texture;
                };
            });
        });
    }
}