/** {@link ISetter} factory for a plain string-valued attribute, copied through unchanged. @category Options */
export function StringSetter(name: string, property: string = null) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        options[property ?? name] = attr.find(x => x.name == name).value;
    }
}