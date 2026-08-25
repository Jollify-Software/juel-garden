import { Animatable, Animation } from "babylonjs";
import { customElement, property } from "lit/decorators";
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
 * mesh), `property` (the mesh property path to animate, e.g. `"position"`),
 * `event` (`"load"` for auto-play), `type` (`"float"|"vector3"|"color3"|...|"skeleton"`),
 * `from`/`to` (frame numbers, or animation range for `type="skeleton"`),
 * `loop`, `loopmode` (`"constant"|"cycle"|"relative"`), `keyframes`
 * (`"frame value, frame value, ..."`), `speed`.
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

    // Built once and reused -- play() can be called repeatedly (e.g. by a
    // <garden-button> toggling it on/off), and re-pushing a fresh Animation onto
    // mesh.animations on every call would leave older ones still running underneath.
    private animation: Animation;

    play(el: GardenMesh): Animatable {
        let targetEl = el;
        if (this.target) {
            targetEl = document.getElementById(this.target) as GardenMesh;
        }
        let target: any;
        let scene = this.getScene();
        switch (this.type) {
            case "skeleton":
                target = (<GardenSkeletonMesh>targetEl).skeleton;
                return scene.beginAnimation(target, this.from, this.to, this.loop, this.speed);
            default:
                if (!this.animation) {
                    this.animation = new Animation("animation", this.property, this.speed,
                        StaticConvert.animationType(this.type), this.loopmode);
                    this.animation.setKeys(ObjectConverter.keyframeRay(this.keyframes));
                }
                if (!targetEl.mesh.animations)
                    targetEl.mesh.animations = []
                if (targetEl.mesh.animations.indexOf(this.animation) < 0)
                    targetEl.mesh.animations.push(this.animation);
                target = targetEl.mesh;
                return scene.beginAnimation(target, this.from, this.to, this.loop);
        }
    }

    stop(el: GardenMesh) {
        let targetEl = el;
        if (this.target) {
            targetEl = document.getElementById(this.target) as GardenMesh;
        }
        let target = this.type === "skeleton" ? (<GardenSkeletonMesh>targetEl).skeleton : targetEl.mesh;
        this.getScene().stopAnimation(target);
    }
}