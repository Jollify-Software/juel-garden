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
}