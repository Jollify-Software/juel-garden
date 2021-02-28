import { Control } from "babylonjs-gui";

export module UnitConvert {
    export var padding = (str: string) => {
        let rtn = {};
        str.split(' ').forEach((val: string, index: number) => {
            switch (index) {
                case 0: // Top
                    rtn['paddingTop'] = val;
                    break;
                case 1: // Right
                    rtn['paddingRight'] = val;
                    break;
                case 2: // Bottom
                    rtn['paddingBottom'] = val;
                    break;
                case 3: // Left
                    rtn['paddingLeft'] = val;
                    break;
            }
        });
    }
    export var justify = (str: string) => {
        let rtn = {};
        const name = "horizontalAlignment";
        switch (str) {
            case 'center':
            case 'centre':
                rtn[name] = Control.HORIZONTAL_ALIGNMENT_CENTER
                break;
            case 'left':
                rtn[name] = Control.HORIZONTAL_ALIGNMENT_LEFT
                break;
            case 'right':
                rtn[name] = Control.HORIZONTAL_ALIGNMENT_RIGHT
                break;
        }
    }
    export var align = (str: string) => {
        let rtn = {};
        const name = "verticalAlignment";
        switch (str) {
            case 'center':
            case 'centre':
                rtn[name] = Control.VERTICAL_ALIGNMENT_CENTER
                break;
            case 'top':
                rtn[name] = Control.VERTICAL_ALIGNMENT_TOP
                break;
            case 'bottom':
                rtn[name] = Control.VERTICAL_ALIGNMENT_BOTTOM
                break;
        }
    }
}