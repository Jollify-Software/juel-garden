import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";

// Screen-space info card anchored to the parent mesh. Rebuilt on plain DOM/CSS
// rather than @babylonjs/gui: pulling in @babylonjs/gui drags the whole modular
// @babylonjs/core engine alongside the monolithic 'babylonjs' package already used
// everywhere else, and bundling both together crashes Parcel outright (reproduces
// with nothing but `import "@babylonjs/gui"` in isolation -- not a code bug).
/**
 * A clickable info panel anchored above its parent mesh -- click the mesh
 * (via {@link GardenScene}'s pointer-pick, wired to `activate()`) to open a
 * screen-space card that tracks the mesh's position as the camera moves.
 * Hosts `<garden-text>`/`<garden-button>` rows as content.
 *
 * Attributes: `title`, `close-on-outside-click` (`"false"` to disable,
 * default enabled), `open` (start shown, instead of waiting for a click on
 * the parent mesh -- e.g. a permanent on-screen toolbar; pair with
 * `close-on-outside-click="false"` or any outside click/drag will hide it),
 * `pin` (`"top-left"|"top-right"|"bottom-left"|"bottom-right"`: fix the card
 * to that corner of the scene instead of tracking a mesh -- a venue's
 * directory, say; it needs no parent mesh). A pinned card's button folds it
 * to its title bar and back, rather than closing it.
 *
 * @example
 * ```html
 * <garden-column>
 *   <garden-info title="The North Column">
 *     <garden-text>Built in 1923.</garden-text>
 *   </garden-info>
 * </garden-column>
 * ```
 *
 * @category Components - GUI
 */
@customElement("garden-info")
export class GardenInfo extends GardenElement {
    @property() title: string;
    @property() pin: string;

    panel: HTMLDivElement;
    container: HTMLDivElement;
    marker: HTMLDivElement;

    private closeBtn: HTMLButtonElement;
    private renderObserver: Observer<Scene>;
    private parentMesh: GardenMesh;
    private anchor: Vector3;
    private visible = false;
    private outsideClickHandler = (evt: PointerEvent) => {
        let target = evt.target as Node;
        if (this.visible && !this.panel.contains(target) && !this.marker.contains(target))
            this.hide();
    };

    async updated() {
        let scene = this.getScene();
        this.parentMesh = this.parentElement as GardenMesh;

        this.marker = document.createElement("div");
        Object.assign(this.marker.style, {
            position: "fixed",
            width: "14px",
            height: "14px",
            marginLeft: "-7px",
            marginTop: "-7px",
            borderRadius: "50%",
            border: "3px solid orange",
            background: "green",
            pointerEvents: "none",
            zIndex: "999",
        });

        this.panel = document.createElement("div");
        Object.assign(this.panel.style, {
            position: "fixed",
            minWidth: "220px",
            maxWidth: "320px",
            background: "rgba(20, 60, 20, 0.92)",
            color: "white",
            border: "3px solid orange",
            borderRadius: "16px",
            padding: "10px 12px",
            font: "14px/1.4 sans-serif",
            pointerEvents: "auto",
            zIndex: "1000",
            transform: "translate(-50%, calc(-100% - 24px))",
        });

        let header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
            fontWeight: "bold",
        });

        let titleEl = document.createElement("span");
        titleEl.textContent = this.title ?? "";

        this.closeBtn = document.createElement("button");
        this.closeBtn.textContent = "✖";
        Object.assign(this.closeBtn.style, {
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: "1",
        });
        if (this.pin) {
            // A pinned card has nothing to click to reopen it, so its button
            // folds it to the title bar and back instead of closing it.
            this.closeBtn.textContent = "▾";
            this.closeBtn.title = "Fold";
            this.closeBtn.addEventListener("click", () => {
                let folded = this.container.style.display == "none";
                this.container.style.display = folded ? "" : "none";
                this.closeBtn.textContent = folded ? "▾" : "▸";
                this.closeBtn.title = folded ? "Fold" : "Unfold";
            });
        } else
            this.closeBtn.addEventListener("click", () => this.hide());

        header.append(titleEl, this.closeBtn);

        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            overflowY: "auto",
            maxHeight: "220px",
        });

        this.panel.append(header, this.container);
        document.body.append(this.marker, this.panel);

        this.renderObserver = scene.onBeforeRenderObservable.add(() => {
            this.updatePosition(scene);
        });

        // Capture phase so this runs *before* Babylon's own pointerdown handler on the
        // canvas (a bubble-phase listener) -- an outside click first hides an already-open
        // panel here, then the click's own pick/activate() (if any) can still open one on
        // the bubble pass back up, so clicking straight from one mesh to another still works.
        if (this.getAttribute("close-on-outside-click") !== "false")
            document.addEventListener("pointerdown", this.outsideClickHandler, { capture: true });

        this.hide();

        this.parentMesh.activate = () => {
            this.show();
        };

        if (this.hasAttribute("open")) {
            // this.parentMesh.mesh may not exist yet -- there's no ordering
            // guarantee between a parent and a child declared in the same
            // initial markup, see GardenElement.whenDocumentReady -- and
            // show() silently no-ops its anchor without it.
            await GardenInfo.whenDocumentReady();
            this.show();
        }
    }

    private updatePosition(scene: Scene) {
        if (this.pin && this.visible) {
            this.placePinned(scene);
            return;
        }
        if (!this.visible || !this.anchor || !scene.activeCamera)
            return;

        let engine = scene.getEngine();
        let canvas = engine.getRenderingCanvas();
        let rect = canvas.getBoundingClientRect();
        let viewport = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());

        let projected = Vector3.Project(
            this.anchor,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            viewport
        );

        let behindCamera = projected.z < 0 || projected.z > 1;
        this.marker.style.display = behindCamera ? "none" : "block";
        this.panel.style.display = behindCamera ? "none" : "block";
        if (behindCamera)
            return;

        let x = rect.left + projected.x;
        let y = rect.top + projected.y;
        this.marker.style.left = `${x}px`;
        this.marker.style.top = `${y}px`;
        // The card sits centred above the marker, but is kept inside the
        // canvas: a tall mesh (a lift shaft, a tower) close up would otherwise
        // push it off the top of the screen.
        let margin = 8;
        let w = this.panel.offsetWidth, h = this.panel.offsetHeight;
        let left = Math.min(Math.max(x - w / 2, rect.left + margin), rect.right - w - margin);
        let top = Math.min(Math.max(y - h - 24, rect.top + margin), rect.bottom - h - margin);
        this.panel.style.transform = "none";
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
    }

    /** A pinned card sits in a corner of the canvas, with no marker. */
    private placePinned(scene: Scene) {
        let rect = scene.getEngine().getRenderingCanvas().getBoundingClientRect();
        let [v, h] = this.pin.split("-");
        let margin = 12;
        Object.assign(this.panel.style, {
            display: "block",
            transform: "none",
            left: h == "left" ? `${rect.left + margin}px` : "auto",
            right: h == "right" ? `${window.innerWidth - rect.right + margin}px` : "auto",
            top: v == "top" ? `${rect.top + margin}px` : "auto",
            bottom: v == "bottom" ? `${window.innerHeight - rect.bottom + margin}px` : "auto",
        });
        this.marker.style.display = "none";
    }

    show() {
        // Snapshot the mesh's world position once, rather than re-reading it every frame:
        // a running <garden-animation> (e.g. a bounce on position.y) would otherwise drag
        // the panel and its buttons around the screen with it, fighting the click the user
        // is trying to make. The panel still tracks the camera every frame below -- only
        // the mesh's own (possibly-animated) motion is deliberately ignored while it's open.
        let mesh = this.parentMesh?.mesh;
        if (mesh && mesh.getChildMeshes(false).length) {
            // An imported model: the element's own mesh is an empty holder,
            // so anchor to the centre of everything under it.
            let { min, max } = mesh.getHierarchyBoundingVectors(true);
            this.anchor = Vector3.Center(min, max);
        } else if (mesh)
            this.anchor = mesh.getBoundingInfo().boundingSphere.centerWorld.clone();
        this.visible = true;
    }

    hide() {
        this.visible = false;
        this.marker.style.display = "none";
        this.panel.style.display = "none";
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.renderObserver?.remove();
        document.removeEventListener("pointerdown", this.outsideClickHandler, { capture: true });
        this.marker?.remove();
        this.panel?.remove();
    }
}
