import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { customElement, property } from "lit/decorators.js";
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
 * teleport-target meshes, defaults to every `<garden-ground>` and the ground of a
 * `<garden-sky environment="default">`), `teleportation`
 * (default on; `teleportation="false"` turns it off).
 *
 * Arriving from another page that was in VR -- through a `<garden-link>` --
 * re-enters VR straight away where the browser supports WebXR navigation
 * (the `sessiongranted` event, e.g. Meta Quest Browser), so a visitor can
 * walk from scene to scene without taking the headset off.
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
    /** The meshes you can teleport onto (from `floor`, or the defaults). */
    floorMeshes: AbstractMesh[] = [];
    // Default-on toggle: any value other than the string "false" turns it on. (A plain
    // Boolean property reads any present attribute, teleportation="false" included, as
    // true, so it could never be turned off from markup.) Same idea as GardenRoof's `clip`.
    @property({ converter: (value: string) => value !== "false" }) teleportation: boolean;

    xr: WebXRDefaultExperience;

    private sessionGranted = false;
    /** The `sessiongranted` listener has been added (it is never taken back: it fires once). */
    private listeningForGrant = false;
    /** The Babylon scene the XR experience was built in. */
    private builtIn: Scene;

    /**
     * Removed for good, the XR experience and its "enter VR/AR" button leave the page.
     * Babylon disposes the experience with its scene, but its button can stay behind
     * (it finds it through the engine's canvas), so the button is removed here either way.
     */
    protected dispose() {
        this.dropExperience();
        super.dispose();
    }

    /**
     * A change (`mode`, `teleportation`, `floor`) builds a new experience, so the old one
     * and its button go first: otherwise each change left another button on the page.
     */
    protected unbuild() {
        this.dropExperience();
        super.unbuild();
    }

    private dropExperience() {
        this.xr?.enterExitUI?.overlay?.remove();
        if (this.xr && !this.builtIn?.isDisposed)
            this.xr.dispose();
        this.xr = null;
        this.builtIn = null;
        this.floorMeshes = [];
    }

    constructor() {
        super();
        this.mode = "vr";
        this.teleportation = true;
    }

    async updated() {
        // Listen before any awaits: the browser grants the session as the page loads.
        let xrSystem = (<any>navigator).xr;
        if (xrSystem && !this.listeningForGrant) {
            // Once per element: a rebuild after a change doesn't add another.
            this.listeningForGrant = true;
            xrSystem.addEventListener("sessiongranted", () => {
                this.sessionGranted = true;
                this.enterGrantedSession();
            }, { once: true });
        }

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
            // The ground of <garden-sky environment="default"> is a floor too (by default).
            if (!this.floor)
                for (let sky of Array.from(document.querySelectorAll("garden-sky"))) {
                    let ground = (<any>sky).environmentHelper?.ground;
                    if (ground) floorMeshes.push(ground);
                }
            this.floorMeshes = floorMeshes;

            try {
                this.builtIn = scene;
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
            this.enterGrantedSession();
        } finally {
            this.endBuild();
        }
    }

    private enterGrantedSession() {
        if (!this.sessionGranted || !this.xr?.baseExperience)
            return;
        this.sessionGranted = false;
        this.xr.baseExperience.enterXRAsync(
            this.mode === "ar" ? "immersive-ar" : "immersive-vr", "local-floor", this.xr.renderTarget
        ).catch(err => console.warn("garden-webxr: could not resume the immersive session.", err));
    }
}
