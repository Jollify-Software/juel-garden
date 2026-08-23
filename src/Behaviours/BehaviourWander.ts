import { Vector3 } from "babylonjs";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { IBehaviourTarget } from "../IBehaviourTarget";

/**
 * Ambles a target to random points within `wander-radius` of wherever it
 * started (captured once, at apply-time, as its "home"), occasionally
 * picking an element matched by `points-of-interest` instead and walking to
 * within `look-radius` of it, pausing there for a random duration in the
 * `look-duration` range ("min max" seconds) as if looking at it, then
 * resuming. Works against any {@link IBehaviourTarget} -- a `GardenMesh`'s
 * `Mesh`, or (applied once per placed sprite -- see {@link GardenSprite})
 * one instance of a `<garden-sprite>` group via
 * {@link SpriteBehaviourTarget}. A no-op unless the `wander` attribute is
 * present.
 *
 * Purely position-based -- unlike {@link BehaviourTrack}/{@link
 * BehaviourDrive}, it never touches `rotation`, since a `<garden-sprite>`'s
 * billboard has no facing that a horizontal wander direction could
 * meaningfully turn (its `SpriteBehaviourTarget.rotation` bridges only onto
 * `sprite.angle`, a camera-relative roll -- turning that with the wander
 * heading would visibly tip a billboard NPC sideways rather than "face" it
 * the way a real yaw would on a `GardenMesh`).
 *
 * Attributes: `wander-radius` (default `5`), `wander-speed` (units/second,
 * default `1.2`), `points-of-interest` (selector of one or more elements to
 * occasionally walk to instead of a random point), `look-radius` (how close
 * counts as "arrived" at a point of interest, default `1.5`), `look-chance`
 * (probability of picking a point of interest over a random wander point at
 * each decision, default `0.4`), `look-duration` ("min max" seconds paused
 * at a point of interest, default `"2 5"`).
 *
 * @example
 * ```html
 * <garden-sprite wander wander-radius="5" wander-speed="1.2"
 *     points-of-interest=".painting" look-radius="1.5" look-duration="3 7"></garden-sprite>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourWander(el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
    if (!el.hasAttribute("wander"))
        return;

    let scene = el.getScene();
    let engine = scene.getEngine();

    let wanderRadius = Number(el.getAttribute("wander-radius") ?? 5);
    let wanderSpeed = Number(el.getAttribute("wander-speed") ?? 1.2);
    let lookRadius = Number(el.getAttribute("look-radius") ?? 1.5);
    let lookChance = Number(el.getAttribute("look-chance") ?? 0.4);
    let [lookMin, lookMax] = (el.getAttribute("look-duration") ?? "2 5").split(/\s+/).map(Number);
    let poiSelector = el.getAttribute("points-of-interest");

    const ARRIVE_WANDER = 0.3;

    let home = target.position.clone();
    let pointsOfInterest: Vector3[] = [];

    let phase: "move" | "look" = "move";
    let atPoi = false;
    let timer = 0;
    let waypoint: Vector3;

    let pickTarget = (): Vector3 => {
        if (pointsOfInterest.length && Math.random() < lookChance) {
            atPoi = true;
            return pointsOfInterest[Math.floor(Math.random() * pointsOfInterest.length)];
        }
        atPoi = false;
        // Same uniform-disk sampling (sqrt(random()) for the radius, not plain
        // random()) as GardenSprite's own scattered-placement.
        let angle = Math.random() * Math.PI * 2;
        let r = Math.sqrt(Math.random()) * wanderRadius;
        return new Vector3(home.x + Math.cos(angle) * r, home.y, home.z + Math.sin(angle) * r);
    };
    waypoint = pickTarget();

    if (poiSelector) {
        (async () => {
            await GardenElement.whenDocumentReady();
            let elements = await GardenElement.resolveReady<GardenMesh>(poiSelector);
            pointsOfInterest = elements.filter(poi => poi.mesh).map(poi => poi.mesh.getAbsolutePosition().clone());
        })().catch(err => console.error("[wander] failed to resolve points-of-interest", poiSelector, err));
    }

    scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        let pos = target.position;

        if (phase === "look") {
            timer -= dt;
            if (timer <= 0) {
                waypoint = pickTarget();
                phase = "move";
            }
            return;
        }

        let toTarget = new Vector3(waypoint.x - pos.x, 0, waypoint.z - pos.z);
        let distance = toTarget.length();
        let arrival = atPoi ? lookRadius : ARRIVE_WANDER;

        if (distance <= arrival) {
            if (atPoi) {
                phase = "look";
                timer = lookMin + Math.random() * Math.max(0, lookMax - lookMin);
            } else {
                waypoint = pickTarget();
            }
            return;
        }

        let step = Math.min(wanderSpeed * dt, distance);
        pos.x += (toTarget.x / distance) * step;
        pos.z += (toTarget.z / distance) * step;
    });
}
