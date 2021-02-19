import { ISetter } from "../ISetter";

export var OptionHeightSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['height'] = parseFloat(attr.find(x => x.name == 'height').value);
}