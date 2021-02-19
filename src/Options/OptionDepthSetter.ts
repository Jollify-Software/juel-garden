import { ISetter } from "../ISetter";

export var OptionWidthSetter : ISetter = function(el: HTMLElement, attr: Attr[], options: object) {
    options['depth'] = parseFloat(attr.find(x => x.name == 'depth').value);
}