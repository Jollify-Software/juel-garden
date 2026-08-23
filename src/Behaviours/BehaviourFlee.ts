import { Mesh, Vector3 } from "babylonjs";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { IBehaviourTarget } from "../IBehaviourTarget";

/**
 * Scatters a target away from `flee-target` once it comes within
 * `flee-radius`, gently springing back toward wherever it started (captured
 * once, at apply-time, as its "home") otherwise -- so a scattered group
 * ambles back together afterwards instead of drifting off indefinitely.
 * Works against any {@link IBehaviourTarget} -- a `GardenMesh`'s `Mesh`, or
 * (applied once per placed sprite -- see {@link GardenSprite}) one instance
 * of a `<garden-sprite>` group via {@link SpriteBehaviourTarget}. A no-op
 * unless `flee-target` is set. Pair with `terrain` (see
 * {@link BehaviourTerrain}) to also rest on a heightmap while fleeing --
 * the two run as independent observers over disjoint axes (this one only
 * ever touches x/z), so there's no ordering dependency between them.
 *
 * Attributes: `flee-target` (selector of the element to flee), `flee-radius`
 * (default `4`), `flee-speed` (max flee speed, units/second, default `3`).
 *
 * @example
 * ```html
 * <garden-sprite flee-target="#buggy" flee-radius="5" flee-speed="4"></garden-sprite>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourFlee(el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
    let fleeTargetSelector = el.getAttribute("flee-target");
    if (!fleeTargetSelector)
        return;

    let scene = el.getScene();
    let engine = scene.getEngine();

    let fleeRadius = Number(el.getAttribute("flee-radius") ?? 4);
    let fleeSpeed = Number(el.getAttribute("flee-speed") ?? 3);

    let home = target.position.clone();
    let threat: Mesh = null;

    (async () => {
        await GardenElement.whenDocumentReady();
        let [threatEl] = await GardenElement.resolveReady<GardenMesh>(fleeTargetSelector);
        threat = threatEl?.mesh ?? null;
    })().catch(err => console.error("[flee] failed to resolve flee-target", fleeTargetSelector, err));

    let velocity = Vector3.Zero();

    scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        let pos = target.position;
        let force = Vector3.Zero();

        if (threat) {
            let threatPosition = threat.getAbsolutePosition();
            let away = new Vector3(pos.x - threatPosition.x, 0, pos.z - threatPosition.z);
            let distance = away.length();
            // Tapers to nothing at fleeRadius (rather than a hard on/off snap right
            // at the boundary) and gets stronger the closer the threat is.
            if (distance > 0.0001 && distance < fleeRadius) {
                force.addInPlace(away.normalize().scale((1 - distance / fleeRadius) * fleeSpeed * 8));
            }
        }

        // A gentle pull back toward home -- the same spring-toward-a-point idea
        // used elsewhere in this library (e.g. the follow camera), just heavily
        // damped, so a scattered group ambles back together afterwards instead
        // of drifting off forever.
        force.addInPlace(new Vector3(home.x - pos.x, 0, home.z - pos.z).scale(0.5));

        velocity.addInPlace(force.scale(dt));
        // Frame-rate-independent damping (a fixed fraction of velocity lost per
        // *second*, not per frame), same idea as BehaviourDrive's friction.
        velocity.scaleInPlace(Math.pow(0.05, dt));
        let speed = velocity.length();
        if (speed > fleeSpeed) {
            velocity.scaleInPlace(fleeSpeed / speed);
        }

        pos.x += velocity.x * dt;
        pos.z += velocity.z * dt;
    });
}
