import { IAction, Mesh } from "babylonjs";

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