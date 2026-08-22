import { GardenElement } from "../../GardenElement";

/**
 * Base class for `<garden-info>` row controls ({@link GardenButton},
 * {@link GardenText}) -- maps a small set of CSS-flavoured attributes
 * (`padding`, `padding-top`/`-right`/`-bottom`/`-left`, `justify`, `width`,
 * `height`, `color`, `background`, `text-wrapping`) onto a plain DOM
 * element's inline style, via {@link GardenControl.applyProperties}.
 *
 * @category Components - GUI
 */
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
