import { IAction } from "@babylonjs/core/Actions/action";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

/**
 * A registered `<garden-action type="set"|"increment">` waiting to be applied
 * to a mesh by {@link BehaviourAction} once an `action="..."` attribute
 * references it by id. See {@link GardenAction}.
 *
 * @category Core
 */
export interface ActionInfo {
    applyOn?: string
    target?: any
    value?: any
    action: (ownerMesh: Mesh, target: any, value: any) => IAction
}