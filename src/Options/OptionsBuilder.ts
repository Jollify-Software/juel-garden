import { BooleanSetter } from "./BooleanSetter";
import { OptionFaceUVSetter } from "./OptionsFaceUVSetter";
import { FloatSetter } from "./OptionsFloatSetter";

export module OptionsBuilder {
    var map = {
        'width': FloatSetter('width'),
        'height': FloatSetter('height'),
        'depth': FloatSetter('depth'),
        'diameter': FloatSetter('diameter'),
        'tessellation': FloatSetter('tessellation'),
        'wrap': BooleanSetter('wrap'),
        'faceuv': OptionFaceUVSetter
    }

    export var build = function(el: HTMLElement): object {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};
        for (let key in map) {
            let attr = collection.find(x => x.name == key);
            if (attr) {
                map[key](el, collection, options);
            }
        }

        return options;
    }
}