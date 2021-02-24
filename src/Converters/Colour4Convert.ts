import { Color4 } from "babylonjs";

export module Colour4Convert {
    export var fromString = (str: string) => {
        let ray = str.trim().split(' ').map(s => Number(s));
        return new Color4(ray[0], ray[1], ray[2], ray[3]);
    }
}