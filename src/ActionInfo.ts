import { IAction, Mesh } from "babylonjs";

export interface ActionInfo {
    applyOn?: string
    target?: any
    value?: any
    action: (ownerMesh: Mesh, target: any, value: any) => IAction
}