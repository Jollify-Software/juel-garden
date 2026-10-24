import { IAnimationKey } from "@babylonjs/core/Animations/animationKey";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Parses `<garden-animation keyframes="...">`'s `"frame value, frame value, ..."`
 * syntax into Babylon `IAnimationKey[]`. A number value may be a literal or a
 * `(Math...)` expression. For a `type` with several parts (`vector2`,
 * `vector3`, `quaternion`, `color3`, `color4`) the value is its parts after
 * the frame, each a number or an expression without spaces:
 * `"0 0 0 0, 60 (Math.PI) 0 1.2"`, or in brackets, `"0 (0 0 0), 60 (3.14 0 1.2)"`.
 *
 * @category Converters
 */
export module ObjectConverter {
    let number = (value: string): number =>
        value.indexOf('(') >= 0 ? (new Function('Math', `return ${value}`))(Math) as number : Number(value);

    let parts: { [type: string]: (n: number[]) => any } = {
        vector2: (n) => new Vector2(n[0], n[1]),
        vector3: (n) => new Vector3(n[0], n[1], n[2]),
        quaternion: (n) => new Quaternion(n[0], n[1], n[2], n[3]),
        color3: (n) => new Color3(n[0], n[1], n[2]),
        color4: (n) => new Color4(n[0], n[1], n[2], n[3]),
        colour3: (n) => new Color3(n[0], n[1], n[2]),
        colour4: (n) => new Color4(n[0], n[1], n[2], n[3]),
    };

    export var keyframeRay = (str: string, type?: string): IAnimationKey[] => {
        let make = parts[(type ?? '').toLowerCase()];
        return str.split(', ').map(x => {
            let ray = x.trim().split(' ');
            let frame = Number(ray[0]);
            if (!make)
                return { frame, value: number(ray[1]) };
            // "(1 2 3)": brackets round the whole value, not an expression.
            let rest = ray.slice(1).join(' ').trim();
            if (rest.startsWith('(') && rest.endsWith(')') && /\s/.test(rest))
                rest = rest.slice(1, -1).trim();
            return { frame, value: make(rest.split(/\s+/).map(number)) };
        });
    }
}
