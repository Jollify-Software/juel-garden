import { Vector4 } from "babylonjs";

/** Parses a comma-separated list of `"x y z w"` into `Vector4[]`, used for `faceuv`. @category Converters */
export module Vector4Convert {
    export var array = (str: string) => {
        let ray = str.split(',').map(x => {
            let r = x.trim().split(' ').map(v => parseFloat(v));
            return new Vector4(r[0], r[1], r[2], r[3]);
        });
        return ray;
    }
}