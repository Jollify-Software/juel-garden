import { Camera, Scene } from "babylonjs";
import type { GardenCamera } from "./Components/Camera";

export interface ICameraTypeStrategy {
    (el: GardenCamera, scene: Scene): Camera;
}
