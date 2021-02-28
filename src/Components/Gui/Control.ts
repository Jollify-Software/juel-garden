import { UnitConvert } from "../../Converters/UnitConvert";
import { GardenElement } from "../../GardenElement";

export class GardenControl extends GardenElement {
    map = {
        'padding': UnitConvert.padding,
        'padding-top': 'paddingTop',
        'padding-right': 'paddingRight',
        'padding-bottom': 'paddingBottom',
        'padding-left': 'paddingLeft',
        'justify': UnitConvert.justify,
        'align': UnitConvert.align,
        'width': 'width',
        'height': 'height',
        'text-wrapping': 'textWrapping',
        'resize-to-fit': 'resizeToFit'
    }

    applyProperties(obj: object) {
        let collection = Array.prototype.slice.call(this.attributes) as Attr[];
        for (var key in this.map) {
            let attr = collection.find(x => x.name == key);
            if (attr) {
                let name = this.map[key];
                if (typeof name === "string") {
                    let val = attr.value;
                    let v: any;
                    if (val == 'true') {
                        v = true;
                    } else if (val == 'false') {
                        v = false;
                    } else if (!isNaN(Number(val))) {
                        v = Number(val);
                    } else {
                        v = val;
                    }
                    obj[name] = v;
                } else if (typeof name === "function") {
                    let res = name(attr.value);
                    obj = Object.assign({}, obj, res);
                }
            }
        }
    }
}