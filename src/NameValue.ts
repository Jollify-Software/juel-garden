/**
 * A generic name/value pair, e.g. one entry of {@link Vector3Convert.keyedArray}'s
 * `"a: 1 2 3, b: 4 5 6"` parse -- `{ name: "a", value: Vector3(1,2,3) }`.
 *
 * @category Core
 */
export interface NameValue<T> {
    name: string
    value: T
}