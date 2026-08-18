import { customElement, property } from "lit/decorators";
import { GardenAnimation } from "../Animation";
import { GardenMesh } from "../../GardenMesh";
import { GardenControl } from "./Control";
import { GardenInfo } from "./Info";

// A toggle button inside a <garden-info> panel: plays a <garden-animation> by id on
// the first click, stops it on the next. The target animation should be left without
// event="load" (or given some other event value) so GardenMesh.modifyMesh() doesn't
// also auto-play it at build time.
@customElement("garden-button")
export class GardenButton extends GardenControl {
    @property() target: string;
    @property({ attribute: "stop-label" }) stopLabel: string = "Stop";

    private playing = false;

    async updated() {
        if (!(this.parentElement instanceof GardenInfo)) {
            console.warn("<garden-button> must be a child of <garden-info>.");
            return;
        }
        let info = this.parentElement;

        // <garden-info>.container is only built in its own updated() -- no ordering
        // guarantee that it's run before this child's. See GardenElement.whenDocumentReady.
        await GardenButton.whenDocumentReady();

        let label = this.textContent.trim();
        let btn = document.createElement("button");
        btn.textContent = label;
        Object.assign(btn.style, {
            display: "block",
            marginTop: "8px",
            padding: "6px 14px",
            background: "orange",
            color: "#123",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            font: "bold 13px sans-serif",
        });
        this.applyProperties(btn);

        btn.addEventListener("click", () => {
            let animationEl = document.getElementById(this.target) as GardenAnimation;
            if (!animationEl) {
                console.warn(`<garden-button target="${this.target}"> did not match a <garden-animation>.`);
                return;
            }

            let ownerMesh = info.parentElement as GardenMesh;
            if (this.playing) {
                animationEl.stop(ownerMesh);
                btn.textContent = label;
            } else {
                animationEl.play(ownerMesh);
                btn.textContent = this.stopLabel;
            }
            this.playing = !this.playing;
        });

        info.container.appendChild(btn);
    }
}
