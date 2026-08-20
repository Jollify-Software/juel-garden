import { ArcRotateCamera, Vector3 } from "babylonjs";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

export const ArcCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    return new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene);
}
