import { DynamicTexture } from "babylonjs";
import html2canvas from "html2canvas";
import { GardenElement } from "./GardenElement";
import { GardenMesh } from "./GardenMesh";

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

        setTimeout(async () => {
            // A plain setTimeout(0) isn't a reliable guarantee that the parser has
            // even attached this element's own light-DOM children yet -- same
            // ordering hazard as everywhere else that reads another element's build
            // output, see GardenElement.whenDocumentReady.
            await GardenElement.whenDocumentReady();
            let el = element.firstElementChild as HTMLElement;
            if (!el)
                return;
            el.remove();
            // html2canvas needs the element actually laid out in the document to
            // capture it correctly -- it was only ever a light-DOM child of this
            // (unrendered-as-a-box) custom element, so it's parked in <body> just
            // long enough to be captured, then removed again below rather than
            // left behind as a stray visible element on the page.
            document.body.prepend(el);

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
                el.remove();
                let img = new Image();
                img.src = canvas.toDataURL();
                img.onload = () => {
                    // Undrawn without a destination size, drawImage paints the capture
                    // at its own native pixel size in the texture's top-left corner --
                    // leaving the rest of the (512x512) DynamicTexture blank/black.
                    // Stretch it to fill instead.
                    let size = this.texture.getSize();
                    ctx.drawImage(img, 0, 0, size.width, size.height);
                    this.texture.update();
                };
            });
        });
    }
}