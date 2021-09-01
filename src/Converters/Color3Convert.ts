import { Color3 } from "babylonjs";

export module Color3Convert {
    export var fromString = (str: string) => {
        if (str.indexOf(' ') > 0) {
        let ray = str.split(' ').map(s => parseFloat(s));
        return new Color3(ray[0], ray[1], ray[2]);
        } else {
            return Color3Convert.fromName(str);
        }
    }
    export var fromName = (name: string) => {
        switch (name) {
            case 'red':
                return Color3.Red();
                break;
            case 'green':
                return Color3.Green();
                break;
            case 'blue':
                return Color3.Blue();
                break;
            case 'black':
                return Color3.Black();
                break;
            case 'white':
                return Color3.White();
                break;
            case 'purple':
                return Color3.Purple();
                break;
            case 'magenta':
                return Color3.Magenta();
                break;
            case 'yellow':
                return Color3.Yellow();
                break;
            case 'gray':
                return Color3.Gray();
                break;
            case 'teal':
                return Color3.Teal();
                break;
            default:
                return null;
        }
    }
}