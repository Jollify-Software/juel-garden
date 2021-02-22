import { Vector3 } from "babylonjs";

export module ShapeFunctions {
    export var triangle = () => {
        const points = [];
points.push(new Vector3(2, 0, 2));
points.push(new Vector3(2, 0, -2));
points.push(new Vector3(-2, 0, -2));
points.push(points[0]);
return points;
    }
    export var curve = () => {
        const points = [];
        for (let i = 0; i < 20; i++) {
            points.push(new Vector3(0.2 * Math.cos(i * Math.PI / 40), 0, 0.2 * Math.sin(i * Math.PI / 40) - 0.1));
        }
        return points;
    }
}