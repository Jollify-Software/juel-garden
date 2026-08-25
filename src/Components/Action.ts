import { ActionManager, IAction, IncrementValueAction, InterpolateValueAction, SetValueAction } from "babylonjs";
import { TargetCamera } from "babylonjs/Cameras/targetCamera";
import { Mesh } from "babylonjs/Meshes/mesh";
import { customElement, property } from "lit/decorators";
import { ActionInfo } from "../ActionInfo";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Utility } from "../Utility";
import { GardenScene } from "./Scene";

/**
 * Declares a reusable Babylon `ActionManager` action (`"set"`, `"increment"`,
 * or a raw `"beforeRender"` loop), registered by `id` on the scene so a
 * mesh's `action="id"` attribute (via {@link BehaviourAction}) can attach it,
 * or `<garden-button>` can trigger it. Loosely mirrors A-Frame's animation/
 * event-action pattern.
 *
 * Attributes: `type` (`"beforeRender"|"set"|"increment"|"interpolate"`),
 * `trigger` (`"enter"|"exit"|"frame"|"pointerOut"|"pointerOver"|"pick"|"leftPick"`),
 * `target`, `increment`, `parameter`, `property`, `value`, `duration`
 * (`type="interpolate"`-specific, milliseconds), `stop` (`type="interpolate"`-specific,
 * `"true"` to stop the mesh's other running animations when this one starts).
 *
 * @category Components
 */
@customElement("garden-action")
export class GardenAction extends GardenElement {
    @property() type: string;
    @property() trigger: string;
    @property() target: string;
    @property({ type: Number }) increment: number;
    @property() parameter: string;
    @property() property: string;
    @property() value: string;
    @property({ type: Number }) duration: number;
    @property() stop: string;

    constructor() {
        super();
        this.type = "beforeRender";
        this.target = null;
    }

    updated() {
        setTimeout(async () => {
            // `parameter`/`target` selectors (e.g. "#donut") can reference an element
            // declared later in the same markup than this <garden-action> -- wait for
            // the whole document before resolving them, same as GardenCamera's `target`.
            await GardenElement.whenDocumentReady();

            let scene = this.getScene();
            let el = document.querySelector(this.parameter) as GardenElement;
            let owner = this.parentElement as HTMLElement;
            let i = 0;
            let action: ActionInfo = null;
            let actionFactory: (ownerMesh: Mesh, target: any) => IAction|ActionInfo = null;

            let value: any = this.value;
            if (this.property) {
                if (this.property == "position" ||
                    this.property == "scaling" ||
                    this.property == "rotation") {
                        value = Vector3Convert.fromString(this.value);
                } else if (this.property.includes('.x') ||
                    this.property.includes('.y') ||
                    this.property.includes('.z')) {
                        value = Utility.getFloat(this.value);
                    }
            }

            switch (this.type) {
                case "beforeRender":
                    scene.registerBeforeRender(() => {
                        switch (this.property) {
                            case "position":
                                el.position = Vector3Convert.fromString(this.value, i);
                                break;

                            default:
                                break;
                        }
                        el.update();
                        i += this.increment;
                    });
                    break;

                case "set":
                    action = {
                        target: this.target,
                        value: value,
                        action: (ownerMesh: Mesh, target: any, value: any) => {
                            if (ownerMesh == null) {
                                console.log(this.getTrigger(this.trigger))
                                return new SetValueAction(this.getTrigger(this.trigger), target, this.property, value);
                            } else {
                                return new SetValueAction({
                                    trigger: this.getTrigger(this.trigger),
                                    parameter: target
                                }, ownerMesh, this.property, value);
                            }
                        }
                    };
                    break;

                case "increment":
                    action = {
                            applyOn: 'scene',
                            target: this.target,
                            value: value,
                            action: (ownerMesh: Mesh, target: any, value: any) => {
                                return new IncrementValueAction(
                                    this.getTrigger(this.trigger), ownerMesh, this.property, value
                                )
                            }
                    };
                    break;
                case "interpolate":
                    action = {
                        target: this.target,
                        value: value,
                        action: (ownerMesh: Mesh, target: any, value: any) => {
                            if (ownerMesh == null) {
                                return new InterpolateValueAction(
                                    this.getTrigger(this.trigger), target, this.property, value,
                                    this.duration, null, this.stop === "true"
                                );
                            } else {
                                return new InterpolateValueAction({
                                    trigger: this.getTrigger(this.trigger),
                                    parameter: target
                                }, ownerMesh, this.property, value, this.duration, null, this.stop === "true");
                            }
                        }
                    };
                    break;
            }
            if (action && 'mesh' in owner) {
                let meshEl = owner as GardenMesh;
                if (!meshEl.mesh.actionManager) {
                    meshEl.mesh.actionManager = new ActionManager(scene);
                }
                meshEl.mesh.actionManager.registerAction(
                    action.action(meshEl.mesh, (<GardenMesh>el).mesh, value) as IAction
                );
            } else if (action && 'actions' in owner) {
                let sceneEl = owner as GardenScene;
                sceneEl.actions[this.id] = action;
            }
        });
    }

    getTrigger(str: string) {
        switch (str) {
            case "enter":
                return ActionManager.OnIntersectionEnterTrigger;
            case "exit":
                return ActionManager.OnIntersectionExitTrigger;
            case "frame":
                return ActionManager.OnEveryFrameTrigger;
            case "pointerOut":
                return ActionManager.OnPointerOutTrigger;
            case "pointerOver":
                return ActionManager.OnPointerOverTrigger;
            case "pick":
                return ActionManager.OnPickTrigger;
            case "leftPick":
                return ActionManager.OnLeftPickTrigger;
        }
    }
}