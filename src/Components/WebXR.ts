import { AbstractMesh, WebXRDefaultExperience } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { GardenScene } from "./Scene";

/**
 * Adds a WebXR "enter VR/AR" button to the scene via Babylon's built-in default
 * experience. That button (and the rest of its UI) is plain DOM, not
 * @babylonjs/gui -- see the gui_babylonjs_gui_build_crash memory for why that
 * matters here. createDefaultXRExperienceAsync() degrades gracefully when the
 * browser/device has no WebXR support (the button just doesn't appear), so the
 * existing <garden-camera> keeps working as a mouse/keyboard fallback either way
 * -- no session ever takes over unless the user explicitly enters one.
 *
 * A sibling of <garden-camera> inside <garden-scene>, same as <garden-light>.
 *
 * Attributes: `mode` (`"vr"|"ar"`, default `"vr"`), `floor` (selector of
 * teleport-target meshes, defaults to every `<garden-ground>`), `teleportation`
 * (boolean, default `true`).
 *
 * @example
 * ```html
 * <garden-webxr></garden-webxr>
 * ```
 *
 * @category Components
 */
@customElement("garden-webxr")
export class GardenWebXR extends GardenElement {
    @property() mode: string;
    @property() floor: string;
    @property({ type: Boolean }) teleportation: boolean;

    xr: WebXRDefaultExperience;

    constructor() {
        super();
        this.mode = "vr";
        this.teleportation = true;
    }

    async updated() {
        this.beginBuild();
        try {
            let sceneEl = this.parentElement as GardenScene;
            let scene = sceneEl.scene;

            // `floor` may reference elements later in the document, and the default
            // (every <garden-ground>) needs the whole document present to query
            // reliably -- same DOMContentLoaded wait <garden-opening>/<garden-structure>
            // use before resolving cross-element references.
            await GardenElement.whenDocumentReady();

            let floorEls = this.floor
                ? await GardenElement.resolveReady<GardenMesh>(this.floor)
                : await GardenElement.resolveReady<GardenMesh>("garden-ground");
            let floorMeshes: AbstractMesh[] = floorEls.map(el => el.mesh).filter(mesh => !!mesh);

            try {
                this.xr = await scene.createDefaultXRExperienceAsync({
                    uiOptions: { sessionMode: this.mode === "ar" ? "immersive-ar" : "immersive-vr" },
                    floorMeshes,
                    disableTeleportation: !this.teleportation
                });
            } catch (err) {
                // No WebXR support (browser, device, or non-secure context) -- the desktop
                // camera is already a full fallback, so this is not fatal.
                console.warn("garden-webxr: WebXR experience unavailable.", err);
            }
        } finally {
            this.endBuild();
        }
    }
}
