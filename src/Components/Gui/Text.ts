import { customElement, property } from "lit/decorators";
import { GardenControl } from "./Control";
import { GardenInfo } from "./Info";

// A text row inside a <garden-info> panel. For text written onto a mesh's own
// surface (in-world, not a screen-space HUD label) use <garden-canvas content="text">
// instead -- it already owns that job via DynamicTexture, so garden-text doesn't
// duplicate it.
@customElement("garden-text")
export class GardenText extends GardenControl {
    @property() font: string;

    async updated() {
        let parent = this.parentElement;
        if (!(parent instanceof GardenInfo)) {
            console.warn("<garden-text> must be a child of <garden-info>.");
            return;
        }

        // <garden-info>.container is only built in its own updated() -- no ordering
        // guarantee that it's run before this child's. See GardenElement.whenDocumentReady.
        await GardenText.whenDocumentReady();

        let text = this.textContent.replace(/^\s+|\s+$/gm, '');
        let el = document.createElement("div");
        el.textContent = text;
        if (this.font)
            el.style.font = this.font;
        this.applyProperties(el);

        parent.container.appendChild(el);
    }
}
