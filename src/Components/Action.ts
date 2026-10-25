import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { IAction } from "@babylonjs/core/Actions/action";
import { IncrementValueAction, SetValueAction } from "@babylonjs/core/Actions/directActions";
import { InterpolateValueAction } from "@babylonjs/core/Actions/interpolateValueAction";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { customElement, property } from "lit/decorators.js";
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
 * `trigger` (`"enter"|"exit"|"frame"|"pointerOut"|"pointerOver"|"pick"|"leftPick"|"keydown"|"keyup"`),
 * `key` (for `keydown`/`keyup`: the keys, separated by spaces, any case -- `"a ArrowLeft"`,
 * `"space"`; empty for any key; a key held down repeats, as the browser repeats it),
 * `target`, `increment` (added to `i` each frame for `type="beforeRender"`, default 0), `parameter`, `property`, `value`, `duration`
 * (`type="interpolate"`-specific, milliseconds), `stop` (`type="interpolate"`-specific,
 * `"true"` to stop the mesh's other running animations when this one starts).
 *
 * A key action inside a mesh works on that mesh (keys go to the canvas, so it needs the focus,
 * as Babylon's own keyboard input does):
 *
 * ```html
 * <garden-sphere>
 *   <garden-action type="increment" trigger="keydown" key="a" property="position.x" value="-0.1"></garden-action>
 *   <garden-action type="increment" trigger="keydown" key="d" property="position.x" value="0.1"></garden-action>
 * </garden-sphere>
 * ```
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
    @property() key: string;

    /** What it registered, to take off again when it's rebuilt or removed. */
    private registered: [ActionManager, IAction][] = [];

    private resolveRegistered: () => void;
    /**
     * Resolves once this action has been built and registered (on the scene's
     * `actions`, or on its parent mesh). That happens only after the document has
     * parsed, so a mesh's `action="id"` ({@link BehaviourAction}) waits on it.
     */
    readonly whenRegistered = new Promise<void>(resolve => this.resolveRegistered = resolve);

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
                        // Now, not after the update Lit queues, which would land after this frame.
                        el.applyTransform();
                        i += this.increment ?? 0;
                    });
                    break;

                case "set":
                    action = {
                        target: this.target,
                        value: value,
                        action: (ownerMesh: Mesh, target: any, value: any) => {
                            if (ownerMesh == null) {
                                return new SetValueAction(this.triggerOptions(), target, this.property, value);
                            } else {
                                return new SetValueAction(this.triggerOptions(target), ownerMesh, this.property, value);
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
                                    this.triggerOptions(), ownerMesh, this.property, value
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
                                    this.triggerOptions(), target, this.property, value,
                                    this.duration, null, this.stop === "true"
                                );
                            } else {
                                return new InterpolateValueAction(this.triggerOptions(target),
                                    ownerMesh, this.property, value, this.duration, null, this.stop === "true");
                            }
                        }
                    };
                    break;
            }
            if (action && 'mesh' in owner) {
                let meshEl = owner as GardenMesh;
                await meshEl.whenReady;
                let act = action.action(meshEl.mesh, (<GardenMesh>el)?.mesh, value) as IAction;
                let manager = GardenAction.managerFor(act, meshEl.mesh, scene);
                manager.registerAction(act);
                this.registered.push([manager, act]);
            } else if (action && 'actions' in owner) {
                let sceneEl = owner as GardenScene;
                sceneEl.actions[this.id] = action;
            }
            this.resolveRegistered();
        });
    }

    /** Takes its actions off the meshes (or scene) they were registered on. */
    private unregister() {
        for (let [manager, act] of this.registered.splice(0))
            manager.unregisterAction(act);
    }

    protected unbuild() {
        this.unregister();
        super.unbuild();
    }

    protected dispose() {
        this.unregister();
        super.dispose();
    }

    /** The trigger for a Babylon action: the key test for a key trigger, else `parameter` (an intersection's other mesh) if given. */
    triggerOptions(parameter?: any): any {
        let trigger = this.getTrigger(this.trigger);
        if (GardenAction.isKeyTrigger(trigger)) {
            let keys = (this.key ?? "").trim().split(/\s+/).filter(Boolean)
                .map(k => k.toLowerCase() == "space" ? " " : k.toLowerCase());
            return { trigger, parameter: (evt: any) => !keys.length || keys.includes(String(evt.sourceEvent.key).toLowerCase()) };
        }
        return parameter === undefined ? trigger : { trigger, parameter };
    }

    static isKeyTrigger(trigger: number): boolean {
        return trigger == ActionManager.OnKeyDownTrigger || trigger == ActionManager.OnKeyUpTrigger;
    }

    /**
     * Where an action goes: the mesh's action manager, or the scene's for a key action (Babylon
     * only sends keys to the scene's). Made if there isn't one yet.
     */
    static managerFor(act: IAction, mesh: Mesh, scene: Scene): ActionManager {
        let onScene = GardenAction.isKeyTrigger(act.trigger) || !mesh;
        let host: { actionManager: any } = onScene ? scene : mesh;
        if (!host.actionManager)
            host.actionManager = new ActionManager(scene);
        return host.actionManager;
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
            case "keydown":
                return ActionManager.OnKeyDownTrigger;
            case "keyup":
                return ActionManager.OnKeyUpTrigger;
        }
    }
}