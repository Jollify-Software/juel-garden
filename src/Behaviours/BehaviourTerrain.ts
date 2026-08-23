import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { IBehaviourTarget } from "../IBehaviourTarget";

/**
 * Keeps a target resting on a `<garden-height-map>`'s own surface height,
 * sampled at its current (x, z) every frame -- no spring, no tilt, just a Y
 * snap (see {@link BehaviourSuspension} for the fuller wheeled-vehicle
 * version, with a damped spring per corner and chassis pitch/roll). Works
 * against any {@link IBehaviourTarget} -- a `GardenMesh`'s `Mesh`, or
 * (applied once per placed sprite -- see {@link GardenSprite}) one instance
 * of a `<garden-sprite>` group via {@link SpriteBehaviourTarget}. A no-op
 * unless `terrain` is set; combines freely with `flee-target` (see
 * {@link BehaviourFlee}) or `wander` (see {@link BehaviourWander}) on the
 * same element, since this only ever touches y, never x/z.
 *
 * Attributes: `terrain` (selector of the `<garden-height-map>` to rest on,
 * resolved the same asynchronous way as `suspension-terrain`),
 * `terrain-offset` (vertical clearance above the sampled ground, default `0`).
 *
 * @example
 * ```html
 * <garden-sprite terrain="#terrain" terrain-offset="0.3"></garden-sprite>
 * ```
 *
 * @category Behaviours
 */
export function BehaviourTerrain(el: GardenElement, target: IBehaviourTarget, attr: Attr[]) {
    let terrainSelector = el.getAttribute("terrain");
    if (!terrainSelector)
        return;

    let scene = el.getScene();
    let terrainOffset = Number(el.getAttribute("terrain-offset") ?? 0);

    let terrain: { getHeightAtCoordinates(x: number, z: number): number } = null;

    (async () => {
        await GardenElement.whenDocumentReady();
        let [terrainEl] = await GardenElement.resolveReady<GardenMesh>(terrainSelector);
        terrain = <any>terrainEl?.mesh;
    })().catch(err => console.error("[terrain] failed to resolve terrain", terrainSelector, err));

    scene.onBeforeRenderObservable.add(() => {
        if (!terrain)
            return;

        let pos = target.position;
        let groundY = terrain.getHeightAtCoordinates(pos.x, pos.z);
        if (Number.isFinite(groundY)) {
            pos.y = groundY + terrainOffset;
        }
    });
}
