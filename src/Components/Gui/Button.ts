import { customElement, property } from "lit/decorators";
import { GardenAnimation } from "../Animation";
import { GardenMesh } from "../../GardenMesh";
import { GardenControl } from "./Control";
import { GardenInfo } from "./Info";

/**
 * A button inside a `<garden-info>` panel. With `target` set to a
 * `<garden-animation>` id, it's a toggle: plays the animation on the first
 * click, stops it on the next (the target animation should be left without
 * `event="load"`, or given some other event value, so
 * {@link GardenMesh.modifyMesh} doesn't also auto-play it at build time).
 * Without `target` -- or for any listener that wants the click regardless --
 * it's a plain button: every click dispatches a `click` event on the
 * `<garden-button>` element itself (bubbling, so an `onclick="..."` attribute
 * works too), for the host page to wire up to arbitrary behaviour.
 *
 * Attributes: `target` (id of the `<garden-animation>` to control),
 * `stop-label` (button text while playing, default `"Stop"`; the initial
 * label is the element's own text content). Also accepts {@link GardenControl}'s
 * styling attributes (`padding`, `width`, `color`, ...).
 *
 * @example
 * ```html
 * <garden-info title="Fountain">
 *   <garden-button target="#fountain-anim">Play</garden-button>
 *   <garden-button onclick="console.log('clicked')">Log</garden-button>
 * </garden-info>
 * ```
 *
 * @category Components - GUI
 */
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
            if (this.target) {
                let animationEl = document.getElementById(this.target) as GardenAnimation;
                if (!animationEl) {
                    console.warn(`<garden-button target="${this.target}"> did not match a <garden-animation>.`);
                } else {
                    let ownerMesh = info.parentElement as GardenMesh;
                    if (this.playing) {
                        animationEl.stop(ownerMesh);
                        btn.textContent = label;
                    } else {
                        animationEl.play(ownerMesh);
                        btn.textContent = this.stopLabel;
                    }
                    this.playing = !this.playing;
                }
            }

            // The internal <button> lives in <garden-info>'s own DOM (appended
            // to info.container, not to this element), so its click doesn't
            // naturally bubble through <garden-button> -- re-dispatch it here
            // so a host page can listen (or use onclick=) on this element like
            // any other button, independent of the target/animation behaviour above.
            this.dispatchEvent(new CustomEvent("click"));
        });

        info.container.appendChild(btn);
    }
}
