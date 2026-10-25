import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ActionInfo } from "../ActionInfo";
import type { GardenAction } from "../Components/Action";
import { Color3Convert } from "../Converters/Color3Convert";
import { GardenElement } from "../GardenElement";
import { Utility } from "../Utility";

function applyAction(action: ActionInfo, mesh: Mesh, scene: Scene) {
    let target: any = null;
    if (action.target) {
        target = Utility.getPropertyValue(mesh, action.target);
    }
    let value: any = action.value;
    if (typeof value === "string") {
            value = Color3Convert.fromString(action.value);
            if (!value) {
                value = Utility.getPropertyValue(mesh, action.value);
            }
    }
    console.log('Target')
    console.log(target)
    console.log('Value')
    console.log(value)
    let act = action.action(target ? null : mesh, target, value ?? action.value);
    // Babylon only sends keys to the scene's action manager.
    let key = act.trigger == ActionManager.OnKeyDownTrigger || act.trigger == ActionManager.OnKeyUpTrigger;
    switch (key ? 'scene' : action.applyOn) {
        case 'scene':
            if (!scene.actionManager) {
                scene.actionManager = new ActionManager(scene);
            }
            scene.actionManager.registerAction(act);
            break;

        case 'mesh':
        default:
            if (!mesh.actionManager) {
                mesh.actionManager = new ActionManager(scene);
            }
            mesh.actionManager.registerAction(act);
            break;
    }
}

/**
 * Attaches one or more scene-level `<garden-action>`s (see
 * {@link GardenAction}) to this mesh, by id -- `action="myAction"` or
 * `action="a b c"` for several at once. The actions may come before or after
 * the mesh in the markup: this waits until every one has registered.
 *
 * @example
 * ```html
 * <garden-scene>
 *   <garden-action id="turnRed" type="set" property="colour" value="red"></garden-action>
 *   <garden-box action="turnRed"></garden-box>
 * </garden-scene>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourAction(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    setTimeout(async () => {
        // <garden-action>s register on the scene only after the document has parsed
        // (GardenAction.updated), whether they come before or after this mesh in the
        // markup: wait for all of them before looking the ids up.
        await GardenElement.whenDocumentReady();
        await Promise.all(Array.from(document.querySelectorAll("garden-action"),
            a => (<GardenAction>a).whenRegistered));
        let sceneEl = (<GardenElement>el).getSceneEl();
        if (sceneEl.actions) {
            let at = el.getAttribute('action');
            if (at.indexOf(' ') > 0) {
                let actions = at.split(' ');
                for (let action of actions) {
                    if (action in sceneEl.actions) {
                        let act = sceneEl.actions[action];
                        applyAction(act, mesh, sceneEl.scene);
                    }
                }
            } else {
                if (at in sceneEl.actions) {
                    let act = sceneEl.actions[at];
                    applyAction(act, mesh, sceneEl.scene);
                }
            }
        }
    });
}