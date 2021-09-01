import { ActionManager, IAction, IncrementValueAction, SetValueAction } from "babylonjs";
import { TargetCamera } from "babylonjs/Cameras/targetCamera";
import { Mesh } from "babylonjs/Meshes/mesh";
import { customElement, property } from "lit/decorators";
import { ActionInfo } from "../ActionInfo";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Utility } from "../Utility";
import { GardenScene } from "./Scene";

@customElement("garden-action")
export class GardenAction extends GardenElement {
    @property() type: string;
    @property() trigger: string;
    @property() target: string;
    @property({ type: Number }) increment: number;
    @property() parameter: string;
    @property() property: string;
    @property() value: string;

    constructor() {
        super();
        this.type = "beforeRender";
        this.target = null;
    }

    updated() {
        setTimeout(() => {
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
        }
    }
}