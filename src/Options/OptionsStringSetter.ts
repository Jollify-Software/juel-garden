export function StringSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = attr.find(x => x.name == name).value;
    }
}