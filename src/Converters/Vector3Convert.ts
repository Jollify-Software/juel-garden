import { Tools, Vector3, Vector4 } from "babylonjs";
import { NameValue } from "../NameValue";
import { ShapeFunctions } from "../ShapeFunctions";

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
        if (!str) {
            return undefined;
        }
        let ray = str.trim().split(' ').map(s => getFloat(s));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
    export var rotationString = (str: string) => {
        let ray = str.trim().split(' ').map(s => getFloat(s, true));
        return new Vector3(ray[0], ray[1], ray[2]);
    }
    export var array = (str: string) => {
        let toInsert: {index: number, points: Vector3[]}[] = [];
        let ray = str.split(',').map((x, index) => {
            if (x.indexOf('(') >= 0) {
                let point = (new Function('Shape', `return ${x}`))(ShapeFunctions) as Vector3[];
                toInsert.push({
                    index: index,
                    points: point
                });
                return null;
            } else {
                let r = x.trim().split(' ').map(v => parseFloat(v));
                return new Vector3(r[0], r[1], r[2]);
            }
        });
        if (toInsert.length > 0) {
            for (var p of toInsert) {
                var args = [p.index, 1].concat(<any>p.points);
                Array.prototype.splice.apply(ray, args);
            }
        }
        return ray;
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