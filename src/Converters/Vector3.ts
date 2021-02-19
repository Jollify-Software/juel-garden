import { Vector3 } from "babylonjs";

export module Vector3Convert {
    export var fromString = (str: string) => {
        let ray = str.split(' ').map(s => parseFloat(s));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
    export var rotationString = (str: string) => {
        let ray = str.split(' ').map(s => BABYLON.Tools.ToRadians(parseFloat(s)));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
}