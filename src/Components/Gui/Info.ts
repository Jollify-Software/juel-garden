import { Matrix, Observer, Scene, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";

// Screen-space info card anchored to the parent mesh. Rebuilt on plain DOM/CSS
// rather than @babylonjs/gui: pulling in @babylonjs/gui drags the whole modular
// @babylonjs/core engine alongside the monolithic 'babylonjs' package already used
// everywhere else, and bundling both together crashes Parcel outright (reproduces
// with nothing but `import "@babylonjs/gui"` in isolation -- not a code bug).
@customElement("garden-info")
export class GardenInfo extends GardenElement {
    @property() title: string;

    panel: HTMLDivElement;
    container: HTMLDivElement;
    marker: HTMLDivElement;

    private closeBtn: HTMLButtonElement;
    private renderObserver: Observer<Scene>;
    private visible = false;
    private outsideClickHandler = (evt: PointerEvent) => {
        let target = evt.target as Node;
        if (this.visible && !this.panel.contains(target) && !this.marker.contains(target))
            this.hide();
    };

    updated() {
        let scene = this.getScene();
        let parentMesh = this.parentElement as GardenMesh;

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
            this.updatePosition(scene, parentMesh);
        });

        // Capture phase so this runs *before* Babylon's own pointerdown handler on the
        // canvas (a bubble-phase listener) -- an outside click first hides an already-open
        // panel here, then the click's own pick/activate() (if any) can still open one on
        // the bubble pass back up, so clicking straight from one mesh to another still works.
        if (this.getAttribute("close-on-outside-click") !== "false")
            document.addEventListener("pointerdown", this.outsideClickHandler, { capture: true });

        this.hide();

        parentMesh.activate = () => {
            this.show();
        };
    }

    private updatePosition(scene: Scene, parentMesh: GardenMesh) {
        if (!this.visible || !parentMesh.mesh || !scene.activeCamera)
            return;

        let engine = scene.getEngine();
        let canvas = engine.getRenderingCanvas();
        let rect = canvas.getBoundingClientRect();
        let viewport = scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());

        let projected = Vector3.Project(
            parentMesh.mesh.getBoundingInfo().boundingSphere.centerWorld,
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
        this.panel.style.left = `${x}px`;
        this.panel.style.top = `${y}px`;
    }

    show() {
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
