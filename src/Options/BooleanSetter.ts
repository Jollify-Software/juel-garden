/** {@link ISetter} factory for a `"true"`/`"false"`-valued attribute. @category Options */
export function BooleanSetter(name: string) {
    return function(el: HTMLElement, attr: Attr[], options: object) {
        let value = attr.find(x => x.name == name).value;
        options[name] = value == 'true';
    }
}