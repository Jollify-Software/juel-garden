/**
 * The shape every entry in {@link OptionsBuilder}'s and {@link Modifier}'s
 * attribute maps implements: read one named attribute off `attr` and write
 * the converted value into `options` (mutated in place), ready to be spread
 * onto a Babylon `MeshBuilder` options object or assigned straight onto a
 * mesh/material.
 *
 * @category Core
 */
export interface ISetter {
    (el: HTMLElement, attr: Attr[], options: object): void
}