import { Tools, Vector3 } from "babylonjs";
import { NameValue } from "../NameValue";

export module Vector3Convert {
    var splityReg = /\s+(?=[^\])}]*([\[({]|$))/;
    function getFloat(s: string, rotation = false) {
        if (s.indexOf('(') >= 0) {
            return (new Function('Math', `return ${s}`))(Math) as number;
        } else {
            return rotation ? Tools.ToRadians(parseFloat(s)) : parseFloat(s);
        }
    }
    export var fromString = (str: string) => {
        let ray = str.trim().split(' ').map(s => getFloat(s));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
    export var rotationString = (str: string) => {
        let ray = str.trim().split(' ').map(s => getFloat(s, true));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
    export var keyedArray = (str: string): NameValue<Vector3>[] => {
        let ray = str.split(',').map(s => {
            let keyed = s.trim().split(':');
            return {
                name: keyed[0],
                value: fromString(keyed[1])
            };
        });
        return ray;
    }
    export var keyedRotationArray = (str: string): NameValue<Vector3>[] => {
        let ray = str.split(',').map(s => {
            let keyed = s.trim().split(':');
            return {
                name: keyed[0],
                value: rotationString(keyed[1])
            };
        });
        return ray;
    }
}