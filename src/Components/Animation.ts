import { Animatable } from "@babylonjs/core/Animations/animatable.core";
import { Animation } from "@babylonjs/core/Animations/animation";
import { customElement, property } from "lit/decorators.js";
import { ObjectConverter } from "../Converters/ObjectConverter";
import { StaticConvert } from "../Converters/StaticConvert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { GardenSkeletonMesh } from "../GardenSkeletonMesh";

/**
 * A keyframe animation (mesh property or skeleton) that can be triggered by
 * `event="load"` (auto-plays once its owning mesh is built -- see
 * {@link GardenMesh.modifyMesh}), by a `<garden-button target="#id">`, or
 * called directly via `play()`/`stop()`.
 *
 * Attributes: `target` (id of the element to animate, defaults to the parent
 * mesh; an id that matches nothing logs a warning and plays nothing),
 * `property` (the mesh property path to animate, e.g. `"position"`),
 * `event` (`"load"` for auto-play), `type` (`"float"|"vector3"|"color3"|...|"skeleton"`),
 * `from`/`to` (frame numbers, or animation range for `type="skeleton"`),
 * `loop`, `loopmode` (`"constant"|"cycle"|"relative"`), `keyframes`
 * (`"frame value, frame value, ..."`), `speed` (frames per second for a keyframe
 * animation, default 30; the speed ratio for `type="skeleton"`, default 1).
 *
 * @example
 * ```html
 * <garden-box id="lid">
 *   <garden-animation event="load" property="position.y" type="float"
 *       from="0" to="30" loop="true" speed="30"
 *       keyframes="0 0, 15 (0.3), 30 0"></garden-animation>
 * </garden-box>
 * ```
 *
 * @category Components
 */
@customElement("garden-animation")
export class GardenAnimation extends GardenElement {
    @property() target: string;
    @property() property: string;
    @property() event: string;
    @property() type: string;
    @property({ type: Number }) from: number;
    @property({ type: Number }) to: number;
    @property({ type: Boolean }) loop: boolean = false;
    @property({ converter: StaticConvert.animationLoopMode }) loopmode: number;
    @property() keyframes: string;
    @property({ type: Number }) speed: number;

    /** Frames per second for a keyframe animation whose `speed` is unset (Babylon has no default: it would be NaN). */
    static readonly DefaultFramesPerSecond = 30;

    // Built once and reused -- play() can be called repeatedly (e.g. by a
    // <garden-button> toggling it on/off), and re-pushing a fresh Animation onto
    // mesh.animations on every call would leave older ones still running underneath.
    private animation: Animation;

    play(el: GardenMesh): Animatable | null {
        let targetEl = this.resolveTarget(el);
        if (!targetEl)
            return null;
        let target: any;
        let scene = this.getScene();
        switch (this.type) {
            case "skeleton":
                target = (<GardenSkeletonMesh>targetEl).skeleton;
                return scene.beginAnimation(target, this.from, this.to, this.loop, this.speed);
            default:
                if (!this.animation) {
                    this.animation = new Animation("animation", this.property, this.speed ?? GardenAnimation.DefaultFramesPerSecond,
                        StaticConvert.animationType(this.type), this.loopmode);
                    this.animation.setKeys(ObjectConverter.keyframeRay(this.keyframes, this.type));
                }
                // A light (or anything else with an animationTarget) animates that instead of a mesh.
                target = (<any>targetEl).animationTarget ?? targetEl.mesh;
                if (!target)
                    return null;
                if (!target.animations)
                    target.animations = []
                if (target.animations.indexOf(this.animation) < 0)
                    target.animations.push(this.animation);
                return scene.beginAnimation(target, this.from, this.to, this.loop);
        }
    }

    /**
     * `play()` once the target has finished building. The event="load" auto-play uses this:
     * a target declared later in the markup (e.g. a `garden-room`, which builds
     * asynchronously) may have no mesh yet when its animation's owner is built.
     */
    async playWhenReady(el: GardenMesh): Promise<Animatable | null> {
        let targetEl = this.resolveTarget(el);
        if (!targetEl)
            return null;
        await targetEl.whenReady;
        return this.play(el);
    }

    stop(el: GardenMesh) {
        let targetEl = this.resolveTarget(el);
        if (!targetEl)
            return;
        let target = this.type === "skeleton" ? (<GardenSkeletonMesh>targetEl).skeleton : (<any>targetEl).animationTarget ?? targetEl.mesh;
        this.getScene().stopAnimation(target);
    }

    /** The element named by `target`, or `el` when unset; null (with a warning) if no element has that id. */
    private resolveTarget(el: GardenMesh): GardenMesh | null {
        if (!this.target)
            return el;
        let targetEl = document.getElementById(this.target) as GardenMesh;
        if (!targetEl)
            console.warn(`<garden-animation target="${this.target}"> did not match any element.`);
        return targetEl;
    }
}
