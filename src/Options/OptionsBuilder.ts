import { Color3Convert } from "../Converters/Color3Convert";
import { StaticConvert } from "../Converters/StaticConvert";
import { BooleanSetter } from "./BooleanSetter";
import { ConverterSetter } from "./OptionsConverterSetter";
import { OptionFaceUVSetter } from "./OptionsFaceUVSetter";
import { FloatSetter } from "./OptionsFloatSetter";
import { StringSetter } from "./OptionsStringSetter";
import { OptionsVector3ArraySetter } from "./OptionsVector3ArraySetter";

/**
 * Builds the plain options object handed to a Babylon `MeshBuilder.Create*`
 * call (and a few other shared numeric/converter attributes, like camera
 * tuning) from an element's attributes, dispatching each to its
 * {@link ISetter}. Called by {@link GardenElement.buildOptions}.
 *
 * @category Options
 */
export module OptionsBuilder {
    var map = {
        'width': FloatSetter('width'),
        'height': FloatSetter('height'),
        'size': FloatSetter('size'),
        'depth': FloatSetter('depth'),
        'state': StringSetter('state'),
        'diameter': FloatSetter('diameter'),
        'maxdistance': FloatSetter('maxdistance', 'maxDistance'),
        'segments': FloatSetter('segments'),
        'thickness': FloatSetter('thickness'),
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
        'sideorientation': ConverterSetter('sideorientation', 'sideOrientation', StaticConvert.sideOrientation),
        'diffuse': ConverterSetter('diffuse', 'diffuse', Color3Convert.fromString),
        'beta-lower': FloatSetter('beta-lower', 'lowerBetaLimit'),
        'beta-upper': FloatSetter('beta-upper', 'upperBetaLimit'),
        'radius-lower': FloatSetter('radius-lower', 'lowerRadiusLimit'),
        'radius': FloatSetter('radius'),
        'height-offset': FloatSetter('height-offset', 'heightOffset'),
        'rotation-offset': FloatSetter('rotation-offset', 'rotationOffset'),
        'look-offset': FloatSetter('look-offset', 'lookOffset'),
        'camera-stiffness': FloatSetter('camera-stiffness', 'cameraStiffness'),
        'camera-damping': FloatSetter('camera-damping', 'cameraDamping')
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