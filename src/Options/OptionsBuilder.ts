import { OptionWidthSetter } from "./OptiionWidthSetter";
import { OptionHeightSetter } from "./OptionHeightSetter";

export module OptionsBuilder {
    var map = {
        'width': OptionWidthSetter,
        'height': OptionHeightSetter
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