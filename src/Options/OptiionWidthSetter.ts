import { ISetter } from "../ISetter";

export var OptionWidthSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['width'] = parseFloat(attr.find(x => x.name == 'width').value);
}