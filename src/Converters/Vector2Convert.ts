import { Tools, Vector2 } from "babylonjs";

export module Vector2Convert {
    var splityReg = /\s+(?=[^\])}]*([\[({]|$))/;
    function getFloat(s: string, rotation = false, i: number = 0) {
        if (s.indexOf('(') >= 0) {
            return (new Function('Math', 'i', `return ${s}`))(Math, i) as number;
        } else {
            return rotation ? Tools.ToRadians(parseFloat(s)) : parseFloat(s);
        }
    }
    export var fromString = (str: string, i: number = 0) => {
        if (!str) {
            return undefined;
        }
        let ray = str.trim().split(' ').map(s => getFloat(s, false, i));
        return new Vector2(ray[0], ray[1]);
    }
}