import { GardenMesh } from "../GardenMesh";

export function ModifyFloatSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let val = parseFloat(attr.find(x => x.name == name).value);
        if (property) {
            if (property.indexOf('.') >= 0) {
                let splitty = property.split('.');
                let obj: any;
                switch (splitty[0]) {
                    case 'mat':
                        obj = (<GardenMesh>el).getMaterial();
                        break;
                
                    default:
                        break;
                }
                if (obj) {
                    if (splitty[1].indexOf('-') >= 0) {
                        let props = splitty[1].split('-');
                        for (let i=0;i<props.length-1;i++) {
                            obj = obj[props[i]];
                        }
                        obj[props[props.length-1]] = val;
                    } else {
                        obj = val;
                    }
                }
            } else {
                options[property] = val;
            }
        } else {
            options[name] = val;
        }
    }
}