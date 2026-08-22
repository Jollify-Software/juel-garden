import { IAnimationKey } from "babylonjs";

/**
 * Parses `<garden-animation keyframes="...">`'s `"frame value, frame value, ..."`
 * syntax into Babylon `IAnimationKey[]` -- each value may be a literal number
 * or a `(Math...)` expression.
 *
 * @category Converters
 */
export module ObjectConverter {
    export var keyframeRay = (str: string): IAnimationKey[] => {
        return str.split(', ').map(x => {
            let ray = x.split(' ');
            return  {
                frame: Number(ray[0]),
                value: ray[1].indexOf('(') >= 0 ?
                    (new Function('Math', `return ${ray[1]}`))(Math) as number : Number(ray[1])
            }
        });
    }
}