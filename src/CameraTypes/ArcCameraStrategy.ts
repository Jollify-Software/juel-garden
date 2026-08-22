import { ArcRotateCamera, Vector3 } from "babylonjs";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";

/**
 * `type="arc"` (the default): an orbiting `ArcRotateCamera` -- drag to orbit,
 * scroll to zoom. See {@link GardenCamera}.
 *
 * @category Camera Types
 */
export const ArcCameraStrategy: ICameraTypeStrategy = (el, scene) => {
    return new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), scene);
}
