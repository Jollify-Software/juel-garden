import { ActionManager, Scene } from "babylonjs";
import { Mesh } from "babylonjs/Meshes/mesh";
import { ActionInfo } from "../ActionInfo";
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
    switch (action.applyOn) {
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

export function BehaviourAction(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
    setTimeout(() => {
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