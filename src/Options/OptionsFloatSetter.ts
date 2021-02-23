export function FloatSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = parseFloat(attr.find(x => x.name == name).value);
    }
}