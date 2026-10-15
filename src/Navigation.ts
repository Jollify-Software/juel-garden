import { Animation, ArcRotateCamera, EasingFunction, Scene, SineEase, TargetCamera, Vector3 } from "babylonjs";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { GardenElement } from "./GardenElement";

/**
 * Where the camera is, in a form `history.state` can hold: `position` and
 * `rotation` for a free/follow camera, `target` for an arc camera.
 *
 * @category Navigation
 */
export interface CameraPose {
    position?: number[];
    rotation?: number[];
    target?: number[];
}

/** Options for {@link Navigation.goTo}. */
export interface GoToOptions {
    /** Added to the target's position -- default eye height, `0 1.6 0`. */
    offset?: Vector3;
    /** Where to face on arrival: an element selector, or an `"x y z"` point. */
    lookAt?: string;
    /** Flight time in milliseconds; 0 jumps. Always 0 in a headset. */
    duration?: number;
    /** `false` to leave the browser history alone (back/forward and deep links use this). */
    history?: boolean;
}

/**
 * Moves the camera around a scene from a link -- the in-scene half of
 * {@link GardenLink}. A jump to an element by id flies the camera there and
 * pushes a `#id` history entry carrying the camera pose, so the browser's back
 * button flies back to where the visitor was, and a page opened as
 * `mall.html#shop-12` starts inside that shop. {@link GardenScene} installs
 * the history handling once its camera is ready.
 *
 * @category Navigation
 */
export module Navigation {
    export const defaultOffset = new Vector3(0, 1.6, 0);
    export const defaultDuration = 1000;

    /** Fly the active camera to `target` (an element or a selector such as `#shop-12`). */
    export async function goTo(scene: Scene, target: GardenElement | string, options: GoToOptions = {}): Promise<void> {
        let el = typeof target == "string"
            ? (await GardenElement.resolveReady(target))[0]
            : target;
        if (!el) {
            console.warn(`Juel Garden: no element matches "${target}".`);
            return;
        }
        await el.whenReady;
        let camera = scene.activeCamera as TargetCamera;
        let base = el.getPosition();
        if (!camera || !base)
            return;

        let offset = options.offset ?? defaultOffset;
        // A headset camera's height is the visitor's real head height above the
        // floor -- keep it, rather than putting their eyes at offset.y.
        let realHeight = (<any>camera).realWorldHeight;
        let position = typeof realHeight == "number"
            ? new Vector3(base.x + offset.x, base.y + realHeight, base.z + offset.z)
            : base.add(offset);

        let pose = poseAt(camera, position, await resolvePoint(options.lookAt));
        if (options.history !== false && el.id) {
            history.replaceState({ ...history.state, gardenCamera: getPose(camera) }, "");
            history.pushState({ gardenCamera: pose }, "", "#" + encodeURIComponent(el.id));
        }
        await applyPose(scene, pose, options.duration);
    }

    /** The camera's current pose. */
    export function getPose(camera: TargetCamera): CameraPose {
        if (camera instanceof ArcRotateCamera)
            return { target: camera.target.asArray() };
        let pose: CameraPose = { position: camera.position.asArray() };
        if (!camera.rotationQuaternion)
            pose.rotation = camera.rotation.asArray();
        return pose;
    }

    /** The pose that puts the camera at `position`, facing `lookAt` (or its current direction). */
    export function poseAt(camera: TargetCamera, position: Vector3, lookAt?: Vector3): CameraPose {
        if (camera instanceof ArcRotateCamera)
            return { target: position.asArray() };
        let pose: CameraPose = { position: position.asArray() };
        if (camera.rotationQuaternion)
            return pose; // a headset: the visitor's head decides where they face
        let rotation = camera.rotation.clone();
        if (lookAt) {
            let dir = lookAt.subtract(position);
            rotation = new Vector3(
                Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)),
                Math.atan2(dir.x, dir.z),
                0);
        }
        pose.rotation = rotation.asArray();
        return pose;
    }

    /** Move the active camera to `pose`, eased over `duration` ms (instantly in a headset). */
    export function applyPose(scene: Scene, pose: CameraPose, duration = defaultDuration): Promise<void> {
        let camera = scene.activeCamera as TargetCamera;
        if (!camera)
            return Promise.resolve();
        // Gliding someone through space in a headset makes them sick; teleport instead.
        if (camera.getClassName() == "WebXRCamera")
            duration = 0;

        let tweens: [string, Vector3, Vector3][] = [];
        if (camera instanceof ArcRotateCamera) {
            if (pose.target)
                tweens.push(["target", camera.target.clone(), Vector3.FromArray(pose.target)]);
        } else {
            if (pose.position)
                tweens.push(["position", camera.position.clone(), Vector3.FromArray(pose.position)]);
            if (pose.rotation && !camera.rotationQuaternion) {
                let from = camera.rotation.clone();
                let to = Vector3.FromArray(pose.rotation);
                // Turn the short way round.
                to.y = from.y + Math.atan2(Math.sin(to.y - from.y), Math.cos(to.y - from.y));
                tweens.push(["rotation", from, to]);
            }
        }

        scene.stopAnimation(camera);
        if (duration <= 0) {
            for (let [property, , to] of tweens)
                (<any>camera)[property] = to;
            return Promise.resolve();
        }

        let fps = 60;
        let frames = Math.max(1, Math.round(duration / 1000 * fps));
        let ease = new SineEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        let animations = tweens.map(([property, from, to]) => {
            let animation = new Animation(`garden-goto-${property}`, property, fps,
                Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
            animation.setKeys([{ frame: 0, value: from }, { frame: frames, value: to }]);
            animation.setEasingFunction(ease);
            return animation;
        });
        return new Promise(resolve =>
            scene.beginDirectAnimation(camera, animations, 0, frames, false, 1, () => resolve()));
    }

    /**
     * Back/forward and deep links: `#id` in the address names a scene element
     * to start at, and a history entry pushed by {@link goTo} carries the exact
     * pose to return to. Called by {@link GardenScene} once its camera exists.
     */
    export function install(scene: Scene) {
        let follow = (state: any, duration?: number) => {
            if (state?.gardenCamera) {
                applyPose(scene, state.gardenCamera, duration);
                return;
            }
            let el = elementOfHash();
            if (el)
                goTo(scene, el, { history: false, duration });
        };
        follow(history.state, 0);
        window.addEventListener("popstate", evt => follow(evt.state));
    }

    /** The scene element the address's `#id` names, if any -- other hashes (an app's `#/route`) are left alone. */
    function elementOfHash(): GardenElement {
        if (location.hash.length < 2)
            return null;
        let el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        return el instanceof GardenElement ? el : null;
    }

    async function resolvePoint(value: string): Promise<Vector3> {
        if (!value)
            return undefined;
        if (/^[-+\d.\s]+$/.test(value))
            return Vector3Convert.fromString(value);
        let [el] = await GardenElement.resolveReady(value);
        await el?.whenReady;
        return el?.getPosition();
    }
}
