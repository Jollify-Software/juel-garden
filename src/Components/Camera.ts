import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { customElement, property } from "lit/decorators.js";
import { CameraTypeStrategies } from "../CameraTypes/CameraTypeStrategies";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { GardenScene } from "./Scene";

/**
 * The scene's camera -- exactly one belongs inside `<garden-scene>`, as a
 * sibling of `<garden-light>`. Which Babylon camera actually gets built is
 * chosen by `type`, delegated to {@link CameraTypeStrategies}:
 *
 * - `"arc"` (default) -- an orbiting `ArcRotateCamera` ({@link "CameraTypes/ArcCameraStrategy"!ArcCameraStrategy}).
 * - `"free"` -- WASD/touch-joystick free-fly, with optional `collisions`
 *   ({@link "CameraTypes/FreeCameraStrategy"!FreeCameraStrategy}).
 * - `"follow"` -- a spring-damped third-person chase camera locked to
 *   `target` ({@link "CameraTypes/FollowCameraStrategy"!FollowCameraStrategy}).
 * - `"device"` -- turns with the phone or tablet it's on (a phone in a viewer);
 *   a free camera on a desktop ({@link "CameraTypes/DeviceCameraStrategy"!DeviceCameraStrategy}).
 *
 * Attributes: `type`, `position`, `speed`, `target` (an element selector, for
 * `type="follow"` or any type exposing `chaseTarget`; for `type="arc"`, the
 * point it orbits, `"x y z"`, or an element to follow), `radius`,
 * `alpha`/`beta` (`type="arc"`: its angles round and down from the top, in
 * radians, as Babylon's ArcRotateCamera; with them `position` isn't needed),
 * `beta-lower`/`beta-upper` and `radius-lower`/`radius-upper` (its limits),
 * `height-offset`, `rotation-offset`, `look-offset`, `camera-stiffness`,
 * `camera-damping`, `free-look`, `look-pad`, `look-speed` (the last eight are `type="follow"`-specific), `ellipsoid`/`touch`
 * (`type="free"`-specific).
 *
 * `rotation` (degrees, `"x y z"`) turns a `free` (or other non-orbiting)
 * camera: `"0 90 0"` looks along +x, `"90 0 0"` straight down.
 *
 * **More than one camera** (a picture-in-picture view, a rear-view mirror, an
 * overhead map): give the extra camera a `viewport`, `"x y width height"` as
 * fractions of the canvas measured from its bottom-left corner, as Babylon's
 * `Viewport` (`"0.75 0.75 0.25 0.25"` is the top-right quarter). Every camera
 * with a viewport is drawn over the main one (the first without), in document
 * order, and pointer picking stays with the main camera. A camera with a
 * viewport takes no mouse or keyboard input unless it has `controls`;
 * `controls="false"` stops any camera taking input. `layer-mask` (a number,
 * `0x...` hex allowed) is the camera's Babylon `layerMask`: it sees only
 * meshes whose `layer-mask` shares a bit with it (a roof hidden from the
 * overhead camera but not from the player's).
 *
 * With `parent`, the meshes inside a camera ride with it (a player's avatar
 * seen in the overhead view, a held lamp).
 *
 * @example
 * ```html
 * <garden-camera type="follow" target="#car" radius="8" height-offset="3"></garden-camera>
 * ```
 *
 * @category Components
 */
@customElement("garden-camera")
export class GardenCamera extends GardenElement {
    @property() type: string;
    @property({ type: Number }) speed: number;
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) ellipsoid: Vector3;
    @property() touch: string;

    camera: Camera;

    constructor() {
        super();
        this.type = 'arc';
        this.speed = 0.4;
        this.ellipsoid = new Vector3(1, 1, 1);
        this.touch = 'true';
    }

    /** `"x y z"` as a point, or null for anything else (an element selector). */
    static point(value: string): Vector3 | null {
        let parts = value.trim().split(/[\s,]+/).map(Number);
        return parts.length == 3 && parts.every(Number.isFinite) ? new Vector3(parts[0], parts[1], parts[2]) : null;
    }

    getPosition() {
        return this.camera?.position;
    }

    /** The camera, for children of a `<garden-camera parent>` to ride on. */
    getNode(): TransformNode {
        return this.camera as any;
    }

    /** A `layer-mask` value: decimal or `0x` hex. */
    static mask(value: string): number {
        let n = Number(value.trim());
        return Number.isFinite(n) ? n >>> 0 : 0x0FFFFFFF;
    }

    /**
     * Puts the scene's cameras in order: when any has a `viewport`, the main camera (the first
     * without one) is drawn first and the viewport ones over it, in document order, with pointer
     * picking left to the main camera; with none, Babylon's single active camera as usual.
     */
    static arrange(sceneEl: Element, scene: Scene) {
        let els = Array.from(sceneEl.querySelectorAll("garden-camera")) as GardenCamera[];
        let built = els.filter(el => el.camera && !el.camera.isDisposed?.());
        let insets = built.filter(el => el.hasAttribute("viewport"));
        let main = built.find(el => !el.hasAttribute("viewport"));
        // Cameras a page put in scene.activeCameras itself are left alone unless this set them.
        let arranged = (<any>scene)._gardenArranged;
        if (!insets.length) {
            if (arranged)
                scene.activeCameras = [];
            (<any>scene)._gardenArranged = false;
            return;
        }
        (<any>scene)._gardenArranged = true;
        scene.activeCameras = (main ? [main.camera] : []).concat(insets.map(el => el.camera));
        if (main)
            scene.cameraToUseForPointers = main.camera;
    }

    setPosition(position: Vector3) {
        this.camera.position = position;
    }
    /** A `position` change moves the camera; any other change builds it again. */
    protected get transformsInPlace() {
        return true;
    }

    applyTransform() {
        if (!this.camera || !this.position)
            return;
        // ArcRotateCamera recomputes .position from its alpha/beta/radius
        // every frame, so a plain assignment gets silently overwritten on
        // the next render. setPosition() re-derives those from the given
        // point (keeping the current target) instead.
        if ("setPosition" in this.camera)
            (<any>this.camera).setPosition(this.position);
        else
            this.camera.position = this.position;
        this.applyRotation();
    }

    /** `rotation` in degrees, for a camera that has its own (not an orbiting arc camera). */
    private applyRotation() {
        let value = this.getAttribute("rotation");
        if (!value || !this.camera || "alpha" in this.camera || !("rotation" in this.camera))
            return;
        (<any>this.camera).rotation = Vector3Convert.rotationString(value);
    }

    /** The `<garden-scene>` it was built in. */
    private sceneEl: Element;

    /** Was the scene's active camera when it was last disposed, so its rebuild is too. */
    private wasActive = false;

    protected unbuild() {
        this.disposeCamera();
        super.unbuild();
    }

    protected dispose() {
        this.disposeCamera();
        super.dispose();
    }

    private disposeCamera() {
        if (!this.camera) return;
        let scene = this.camera.getScene();
        this.wasActive = scene.activeCamera == this.camera;
        this.camera.detachControl();
        this.camera.dispose();
        this.camera = null;
        // Removed for good, it's already out of the document: arrange the scene it was in.
        if (this.sceneEl)
            GardenCamera.arrange(this.sceneEl, scene);
    }

    async updated() {
        let sceneEl = this.parentElement as GardenScene
        let scene = sceneEl.scene
        this.sceneEl = sceneEl;

        this.camera = CameraTypeStrategies.build(this, scene);
        if (!this.camera) {
            console.warn(`<garden-camera> has unrecognized type "${this.type}".`);
            return;
        }
        if (this.wasActive) {
            scene.activeCamera = this.camera;
            this.wasActive = false;
        }

        // A target point. An arc camera takes it before `position`, which is then taken
        // round it (setPosition keeps the target and derives alpha, beta and radius);
        // a free or device camera moves first, then turns to look at it.
        let target = this.getAttribute("target");
        let point = target ? GardenCamera.point(target) : null;
        let aims = point && "setTarget" in this.camera && !("chaseTarget" in this.camera);
        let orbits = "setPosition" in this.camera;
        if (aims && orbits)
            (<any>this.camera).setTarget(point);

        if (!this.position)
            this.applyRotation();
        this.applyTransform();
        if (aims && !orbits)
            (<any>this.camera).setTarget(point);

        let opt = this.buildOptions();
        this.camera = Object.assign(this.camera, opt);
        if ("freeLook" in this.camera)
            (<any>this.camera).freeLook = this.hasAttribute("free-look");
        if ("lookPad" in this.camera && this.hasAttribute("look-pad"))
            (<any>this.camera).lookPad = this.getAttribute("look-pad");
        if ("lookSpeed" in this.camera && this.hasAttribute("look-speed"))
            (<any>this.camera).lookSpeed = Number(this.getAttribute("look-speed"));

        let viewport = this.getAttribute("viewport");
        if (viewport) {
            let [x, y, w, h] = viewport.trim().split(/[\s,]+/).map(Number);
            this.camera.viewport = new Viewport(x || 0, y || 0, w ?? 1, h ?? 1);
        }
        if (this.hasAttribute("layer-mask"))
            this.camera.layerMask = GardenCamera.mask(this.getAttribute("layer-mask"));
        GardenCamera.arrange(sceneEl, scene);

        let controls = this.getAttribute("controls");
        if (controls != "false" && (!viewport || controls != null))
            this.camera.attachControl(sceneEl.canvas, true);

        if (target && !point && "setTarget" in this.camera && !("chaseTarget" in this.camera)) {
            // An arc camera orbiting an element: it follows the mesh.
            this.beginBuild();
            try {
                await GardenElement.whenDocumentReady();
                let [targetEl] = await GardenElement.resolveReady<GardenMesh>(target);
                if (targetEl?.mesh)
                    (<any>this.camera).setTarget(targetEl.mesh);
            } finally {
                this.endBuild();
            }
        }
        if (target && "chaseTarget" in this.camera) {
            this.beginBuild();
            try {
                // The target (e.g. a drivable car) can be declared after this camera in
                // the markup, so its element may not even exist yet -- wait for the whole
                // document before resolving by id, same as <garden-waypoint>.
                await GardenElement.whenDocumentReady();
                let [targetEl] = await GardenElement.resolveReady<GardenMesh>(target);
                if (targetEl?.mesh) {
                    (<any>this.camera).chaseTarget = targetEl.mesh;
                }
            } finally {
                this.endBuild();
            }
        }
    }
}