import { Camera, Scene } from "babylonjs";
import type { GardenCamera } from "../Components/Camera";
import { ICameraTypeStrategy } from "../ICameraTypeStrategy";
import { ArcCameraStrategy } from "./ArcCameraStrategy";
import { FreeCameraStrategy } from "./FreeCameraStrategy";

export module CameraTypeStrategies {
    var map: { [type: string]: ICameraTypeStrategy } = {
        'arc': ArcCameraStrategy,
        'free': FreeCameraStrategy
    }

    export var build = function(el: GardenCamera, scene: Scene): Camera {
        let strategy = map[el.type];
        return strategy ? strategy(el, scene) : null;
    }
}
