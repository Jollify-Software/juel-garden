import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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
    }

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
    }

    async updated() {
        let sceneEl = this.parentElement as GardenScene
        let scene = sceneEl.scene

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