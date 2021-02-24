export function ConverterSetter(name: string, property: string = null, converter: (str: string) => any) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = converter(attr.find(x => x.name == name).value);
    }
}