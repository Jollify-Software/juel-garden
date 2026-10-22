import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../../GardenElement";
import { resolveElements } from "../../Utils/resolveElements";

/**
 * A marker for something to head for: an icon floating over the `target`
 * while it is on screen, and an arrow at the edge of the screen pointing the
 * way to it while it is off screen or behind the camera. "Follow the guide",
 * "this way to the next room".
 *
 * Attributes:
 * - `target` -- the element to mark (a selector). Set the `target` property
 *   to a selector or an element to point somewhere else; empty hides it.
 * - `icon` -- text or an emoji over the target, default `▼`.
 * - `colour` -- default `#ffb000`.
 * - `label` -- a line of text under the icon (and by the arrow).
 * - `hide-within` -- hidden while `from` is closer than this (metres).
 * - `from` -- whose distance counts for `hide-within` and the shown
 *   distance: an element (the player) or the camera (`camera`, the default).
 * - `show-distance` -- adds the distance, e.g. "Guide · 23 m".
 * - `height` -- how far above the target's top the icon floats, default 0.3.
 *
 * `element.onScreen` says which way it is drawn. A DOM overlay over the
 * canvas, like `<garden-info>`; not drawn in a WebXR headset yet.
 *
 * @example
 * ```html
 * <garden-marker target="#guide" icon="★" label="Guide" hide-within="6" from="#player" show-distance></garden-marker>
 * ```
 *
 * @category Components - GUI
 */
@customElement("garden-marker")
export class GardenMarker extends GardenElement {
    @property() target: string | GardenElement;
    @property() icon: string;
    @property() colour: string;
    @property() label: string;
    @property({ type: Number, attribute: "hide-within" }) hideWithin: number;
    @property() from: string;
    @property({ type: Number }) height: number;

    /** True while the target is on screen (the icon), false while the arrow points to it, null while hidden. */
    onScreen: boolean = null;
    /** While off screen, the arrow's direction on screen, radians (0 = right, π/2 = down). */
    arrowAngle = 0;

    /** The overlay element. */
    box: HTMLDivElement;
    private iconEl: HTMLDivElement;
    private labelEl: HTMLDivElement;
    private arrowEl: HTMLDivElement;
    private observer: Observer<Scene>;
    private scene: Scene;

    update(changed?: Map<PropertyKey, unknown>) {
        this.liveUpdate(changed);
    }

    updated() {
        let scene = this.scene = this.getScene();
        if (!scene) return;
        if (!this.box)
            this.build();
        let colour = this.colour ?? "#ffb000";
        this.iconEl.textContent = this.icon ?? "▼";
        this.iconEl.style.color = colour;
        this.arrowEl.style.borderLeftColor = colour;
        if (!this.observer)
            this.observer = scene.onAfterRenderObservable.add(() => this.place());
    }

    private build() {
        let box = this.box = document.createElement("div");
        box.className = "garden-marker";
        Object.assign(box.style, {
            position: "fixed", left: "0", top: "0", zIndex: "998", pointerEvents: "none", display: "none",
            font: "bold 14px sans-serif", color: "white", textShadow: "0 1px 3px black", textAlign: "center",
            transform: "translate(-50%, -100%)", whiteSpace: "nowrap",
        });
        this.iconEl = document.createElement("div");
        Object.assign(this.iconEl.style, { fontSize: "26px", lineHeight: "1" });
        this.labelEl = document.createElement("div");
        this.arrowEl = document.createElement("div");
        Object.assign(this.arrowEl.style, {
            width: "0", height: "0", margin: "0 auto",
            borderTop: "14px solid transparent", borderBottom: "14px solid transparent", borderLeft: "26px solid",
            filter: "drop-shadow(0 1px 2px black)", display: "none",
        });
        box.append(this.iconEl, this.arrowEl, this.labelEl);
        document.body.appendChild(box);
    }

    private targetElement(): GardenElement {
        if (!this.target) return null;
        if (typeof this.target != "string") return this.target;
        return resolveElements<GardenElement>(this.target)[0] ?? null;
    }

    private place() {
        let scene = this.scene, camera = scene.activeCamera;
        let target = this.targetElement();
        let node = target?.getNode?.();
        if (!camera || !node || !this.isConnected) {
            this.hide();
            return;
        }

        // The point over the target's top.
        let { min, max } = node.getHierarchyBoundingVectors(true);
        let point = max.y > min.y
            ? new Vector3((min.x + max.x) / 2, max.y + (this.height ?? 0.3), (min.z + max.z) / 2)
            : node.getAbsolutePosition().add(new Vector3(0, this.height ?? 0.3, 0));

        let fromNode = this.from && this.from != "camera" ? resolveElements<GardenElement>(this.from)[0]?.getNode?.() : null;
        let fromPoint = fromNode?.getAbsolutePosition() ?? camera.globalPosition;
        let distance = Vector3.Distance(fromPoint, node.getAbsolutePosition());
        if (this.hideWithin > 0 && distance < this.hideWithin) {
            this.hide();
            return;
        }
        let text = this.label ?? "";
        if (this.hasAttribute("show-distance"))
            text = (text ? text + " · " : "") + `${Math.round(distance)} m`;
        this.labelEl.textContent = text;

        let engine = scene.getEngine();
        let canvas = engine.getRenderingCanvas();
        let rect = canvas.getBoundingClientRect();
        let w = engine.getRenderWidth(), h = engine.getRenderHeight();
        let sx = rect.width / w, sy = rect.height / h;
        let inCamera = Vector3.TransformCoordinates(point, camera.getViewMatrix());
        let projected = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(w, h));
        let margin = 40;
        let x = projected.x * sx, y = projected.y * sy;
        let inFront = inCamera.z > 0;
        let visible = inFront && x >= margin && x <= rect.width - margin && y >= margin && y <= rect.height - margin;

        this.box.style.display = "block";
        if (visible) {
            this.onScreen = true;
            this.iconEl.style.display = "block";
            this.arrowEl.style.display = "none";
            this.box.style.transform = "translate(-50%, -100%)";
            this.box.style.left = `${rect.left + x}px`;
            this.box.style.top = `${rect.top + y}px`;
            return;
        }

        // Off screen: an arrow on the edge, pointing the way. Screen y runs down.
        this.onScreen = false;
        let dx = inCamera.x, dy = -inCamera.y;
        if (!inFront) {
            // Behind: height means nothing; point down ("turn round"), leaning the way to turn.
            let side = Math.abs(dx) / (Math.abs(dx) + Math.abs(inCamera.z) + 1e-6);
            dx = Math.sign(dx) * side;
            dy = 1 - side;
        }
        let cx = rect.width / 2, cy = rect.height / 2;
        let length = Math.hypot(dx, dy) || 1;
        dx /= length; dy /= length;
        let reach = Math.min(Math.abs(dx) > 1e-6 ? (cx - margin) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? (cy - margin) / Math.abs(dy) : Infinity);
        let ax = cx + dx * reach, ay = cy + dy * reach;
        this.iconEl.style.display = "none";
        this.arrowEl.style.display = "block";
        this.arrowEl.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        this.box.style.transform = "translate(-50%, -50%)";
        this.box.style.left = `${rect.left + ax}px`;
        this.box.style.top = `${rect.top + ay}px`;
        this.arrowAngle = Math.atan2(dy, dx);
    }

    private hide() {
        this.onScreen = null;
        if (this.box) this.box.style.display = "none";
    }

    protected dispose() {
        this.scene?.onAfterRenderObservable.remove(this.observer);
        this.observer = null;
        this.box?.remove();
        this.box = null;
        super.dispose();
    }
}
