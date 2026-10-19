import { Mesh, Observer, Scene, Tools } from "babylonjs";
import { GardenElement } from "../GardenElement";
import { turnYaw } from "../Utils/turnYaw";

/**
 * "The guide waits for you": when the element named by `follow-wait` (the
 * player) is more than `follow-wait-distance` away, this mesh stops -- its
 * `track`, `wander` or `follow` pauses -- and turns to face it. It carries on
 * once the player is back within 80% of that distance. Works on any mesh,
 * not only followers.
 *
 * Fires `garden-wait` when it stops and `garden-resume` when it carries on
 * (both bubble; `detail: { target, distance }`). `element.waiting` is true
 * meanwhile, and a game can set it too to hold the mesh where it is.
 *
 * Attributes: `follow-wait` (a selector), `follow-wait-distance` (default
 * `6`), `follow-wait-turn` (degrees/second, default `270`),
 * `follow-facing-offset` (degrees, as for `follow`).
 *
 * @example
 * ```html
 * <garden-line points="0 0 0, 0 0 40, 20 0 40">
 *   <garden-box id="guide" track track-step="0.03" follow-wait="#player" follow-wait-distance="8"></garden-box>
 * </garden-line>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourWait(el: GardenElement, mesh: Mesh, attr: Attr[]) {
    let selector = el.getAttribute("follow-wait");
    if (!selector)
        return;
    let previous: Observer<Scene> = (<any>el)._waitObserver;
    let scene = el.getScene();
    if (previous)
        scene.onBeforeRenderObservable.remove(previous);

    let engine = scene.getEngine();
    let num = (name: string, fallback: number) => el.hasAttribute(name) ? Number(el.getAttribute(name)) : fallback;
    let limit = num("follow-wait-distance", 6);
    let turnRate = Tools.ToRadians(num("follow-wait-turn", 270));
    let facingOffset = Tools.ToRadians(num("follow-facing-offset", 0));

    let other: GardenElement = null;
    (async () => {
        await GardenElement.whenDocumentReady();
        [other] = await GardenElement.resolveReady(selector);
        if (!other)
            console.warn(`follow-wait="${selector}" did not match any element.`);
    })().catch(err => console.error("[follow-wait] failed to resolve", selector, err));

    // Set by this behaviour, or by a game: either way track/wander/follow pause.
    let waitingHere = false;
    (<any>el).waiting ??= false;

    (<any>el)._waitObserver = scene.onBeforeRenderObservable.add(() => {
        let node = other?.getNode();
        if (!node || !mesh.isEnabled())
            return;
        let me = mesh.getAbsolutePosition(), them = node.getAbsolutePosition();
        let distance = Math.hypot(them.x - me.x, them.z - me.z);
        let detail = { target: other, distance };
        if (!waitingHere && distance > limit) {
            waitingHere = (<any>el).waiting = true;
            el.dispatchEvent(new CustomEvent("garden-wait", { bubbles: true, detail }));
        } else if (waitingHere && distance < limit * 0.8) {
            waitingHere = (<any>el).waiting = false;
            el.dispatchEvent(new CustomEvent("garden-resume", { bubbles: true, detail }));
        }
        if ((<any>el).waiting) {
            let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
            let wanted = Math.atan2(them.x - me.x, them.z - me.z);
            let heading = turnYaw(mesh.rotation.y - facingOffset, wanted, turnRate * dt);
            mesh.rotation.y = heading + facingOffset;
            (<any>mesh).drivingHeading = heading;
        }
    });
}
