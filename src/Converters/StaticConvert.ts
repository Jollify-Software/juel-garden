import { Animation } from "babylonjs";

export module StaticConvert {
    export var animationLoopMode = (str: string) => {
        switch (str) {
            case "constant":
                return Animation.ANIMATIONLOOPMODE_CONSTANT;
            case "cycle":
                return Animation.ANIMATIONLOOPMODE_CYCLE;
            case "relative":
                return Animation.ANIMATIONLOOPMODE_RELATIVE;
        }
    }
    export var animationType = (str: string) => {
        switch (str) {
            case "color3":
            case "colour3":
                return Animation.ANIMATIONTYPE_COLOR3;
            case "color4":
            case "colour4":
                return Animation.ANIMATIONTYPE_COLOR4;
            case "float":
                return Animation.ANIMATIONTYPE_FLOAT;
            case "matrix":
                return Animation.ANIMATIONTYPE_MATRIX;
            case "quaternion":
                return Animation.ANIMATIONTYPE_QUATERNION;
            case "size":
                return Animation.ANIMATIONTYPE_SIZE;
            case "vector2":
                return Animation.ANIMATIONTYPE_VECTOR2;
            case "vector3":
                return Animation.ANIMATIONTYPE_VECTOR3;
        }
    }
}