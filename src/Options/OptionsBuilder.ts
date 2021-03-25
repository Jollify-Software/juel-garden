import { StaticConvert } from "../Converters/StaticConvert";
import { BooleanSetter } from "./BooleanSetter";
import { ConverterSetter } from "./OptionsConverterSetter";
import { OptionFaceUVSetter } from "./OptionsFaceUVSetter";
import { FloatSetter } from "./OptionsFloatSetter";
import { OptionsVector3ArraySetter } from "./OptionsVector3ArraySetter";

export module OptionsBuilder {
    var map = {
        'width': FloatSetter('width'),
        'height': FloatSetter('height'),
        'size': FloatSetter('size'),
        'depth': FloatSetter('depth'),
        'diameter': FloatSetter('diameter'),
        'maxdistance': FloatSetter('maxdistance', 'maxDistance'),
        'segments': FloatSetter('segments'),
        'tessellation': FloatSetter('tessellation'),
        'wrap': BooleanSetter('wrap'),
        'loop': BooleanSetter('loop'),
        'autoplay': BooleanSetter('autoplay'),
        'faceuv': OptionFaceUVSetter,
        'points': OptionsVector3ArraySetter('points'),
        'shape': OptionsVector3ArraySetter('shape'),
        'subdivisions': FloatSetter('subdivisions'),
        'minheigh': FloatSetter('minheight', 'minHeight'),
        'maxheight': FloatSetter('maxheight', 'maxHeight'),
        'sideorientation': ConverterSetter('sideorientation', 'sideOrientation', StaticConvert.sideOrientation)
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