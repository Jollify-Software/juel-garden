/**
 * The `<garden-thumbstick>` elements on the page, and what each controls, so
 * `walk` and the follow camera can read them without importing the element
 * (which would make an import cycle through `GardenElement`).
 *
 * @category Utils
 */
export interface ThumbstickInput {
    /** A selector (the walker it moves) or `camera` (the follow camera's look). */
    controls: string;
    /** -1..1, right and up (forward). */
    x: number;
    y: number;
    active: boolean;
    /** False while the stick is hidden or disabled: it gives no input. */
    enabled: boolean;
}

export module ThumbstickRegistry {
    export const sticks = new Set<ThumbstickInput>();

    /** The thumbsticks controlling `target`: an element, or `"camera"`. */
    export function controlling(target: Element | "camera"): ThumbstickInput[] {
        let found: ThumbstickInput[] = [];
        for (let s of sticks) {
            let c = (s.controls ?? "").trim();
            if (!c) continue;
            if (target == "camera" ? c == "camera" : c != "camera" && safeMatches(target, c))
                found.push(s);
        }
        return found;
    }
}

function safeMatches(el: Element, selector: string): boolean {
    try {
        return el.matches(selector);
    } catch {
        return false;
    }
}
