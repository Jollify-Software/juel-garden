import { Animation, Mesh, ParticleSystem } from "babylonjs";

/**
 * Maps a handful of string attribute values onto Babylon's own numeric enum
 * constants: animation loop mode/type (for `<garden-animation>`), mesh
 * side-orientation (`"default"|"front"|"back"|"double"`), and particle
 * billboard mode (`"all"|"y"|"stretched"`).
 *
 * @category Converters
 */
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
    export var sideOrientation = (str: string) => {
        switch (str) {
            case "default":
                return Mesh.DEFAULTSIDE;
            case "front":
                return Mesh.FRONTSIDE;
            case "back":
                return Mesh.BACKSIDE;
            case "double":
                return Mesh.DOUBLESIDE;
            default:
                return Mesh.DEFAULTSIDE;
        }
    }
    // "stretched" -- particles are stretched into streaks along their own
    // per-frame velocity, e.g. stars rushing past a moving viewpoint. See
    // GardenParticle's `billboard` attribute.
    export var particleBillboardMode = (str: string) => {
        switch (str) {
            case "y":
                return ParticleSystem.BILLBOARDMODE_Y;
            case "stretched":
                return ParticleSystem.BILLBOARDMODE_STRETCHED;
            case "all":
            default:
                return ParticleSystem.BILLBOARDMODE_ALL;
        }
    }
}