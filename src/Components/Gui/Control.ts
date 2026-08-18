import { GardenElement } from "../../GardenElement";

export abstract class GardenControl extends GardenElement {
    map: { [attr: string]: string } = {
        'padding': 'padding',
        'padding-top': 'paddingTop',
        'padding-right': 'paddingRight',
        'padding-bottom': 'paddingBottom',
        'padding-left': 'paddingLeft',
        'justify': 'textAlign',
        'width': 'width',
        'height': 'height',
        'color': 'color',
        'background': 'background',
    }

    applyProperties(el: HTMLElement) {
        for (let attr in this.map) {
            if (!this.hasAttribute(attr))
                continue;

            let value = this.getAttribute(attr);
            let styleName = this.map[attr];

            if (attr == 'justify' && value == 'centre')
                value = 'center';

            (el.style as any)[styleName] = value;
        }

        if (this.hasAttribute('text-wrapping'))
            el.style.whiteSpace = this.getAttribute('text-wrapping') == 'false' ? 'nowrap' : 'normal';
    }
}
