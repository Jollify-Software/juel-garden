export function FloatSetter(name: string) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[name] = parseFloat(attr.find(x => x.name == name).value);
    }
}