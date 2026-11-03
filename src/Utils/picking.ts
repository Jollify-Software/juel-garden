import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Sprite } from "@babylonjs/core/Sprites/sprite";
import "@babylonjs/core/Sprites/spriteSceneComponent";
import "@babylonjs/core/Culling/ray";
import { resolveElements } from "./resolveElements";

/**
 * What {@link GardenScene.pick} and {@link GardenScene.pickRay} hit (and what a
 * `garden-pick` event, a `ray` and `at-pointer` report).
 *
 * @category Utilities
 */
export interface PickHit {
    /** The element whose mesh (or one of its parts) or sprite was hit; null for a mesh no element built. */
    element: HTMLElement;
    /** The Babylon mesh hit, for a mesh. */
    mesh?: AbstractMesh;
    /** The Babylon sprite hit, for a `<garden-sprite>`. */
    sprite?: Sprite;
    /** For a sprite, which of the element's `sprites`; for a mesh with a `grid` of copies, which copy. */
    index?: number;
    /** Where, in world space. */
    point: Vector3;
    /** The surface's normal there (meshes only). */
    normal?: Vector3;
    /** How far from the ray's start (the camera, for a pointer pick). */
    distance: number;
}

/**
 * Options for picking: `ignore` leaves out elements (an element, a list of them, or a
 * selector) with all their parts; `sprites: false` looks at meshes only.
 *
 * @category Utilities
 */
export interface PickOptions {
    ignore?: HTMLElement | HTMLElement[] | string;
    sprites?: boolean;
}

/** The element a mesh (or sprite) was built for: its own, else its nearest parent node's. */
export function elementOfNode(node: any): HTMLElement | null {
    for (; node; node = node.parent)
        if (node.element) return node.element;
    return null;
}

function ignoredElements(ignore: PickOptions["ignore"]): HTMLElement[] {
    if (!ignore) return [];
    if (typeof ignore == "string") return resolveElements<HTMLElement>(ignore);
    return Array.isArray(ignore) ? ignore : [ignore];
}

/** Babylon's own test for a pickable mesh, less the meshes of the `ignore`d elements. */
function meshPredicate(ignore: HTMLElement[]) {
    return (mesh: AbstractMesh) => mesh.isPickable && mesh.isVisible && mesh.isEnabled() &&
        (ignore.length == 0 || !ignore.includes(elementOfNode(mesh)));
}

function spritePredicate(ignore: HTMLElement[]) {
    return (sprite: Sprite) => sprite.isPickable && (ignore.length == 0 || !ignore.includes((<any>sprite).element));
}

function hitOf(info: PickingInfo, ray: Ray): PickHit | null {
    if (!info?.hit) return null;
    let point = info.pickedPoint?.clone() ?? ray?.origin.add(ray.direction.scale(info.distance));
    if (info.pickedSprite) {
        let sprite = info.pickedSprite;
        let element = (<any>sprite).element ?? null;
        let index = element?.sprites?.indexOf(sprite);
        return { element, sprite, index: index >= 0 ? index : undefined, point, distance: info.distance };
    }
    let mesh = info.pickedMesh;
    return {
        element: elementOfNode(mesh),
        mesh,
        index: info.thinInstanceIndex >= 0 ? info.thinInstanceIndex : undefined,
        point,
        normal: info.getNormal(true, true) ?? undefined,
        distance: info.distance,
    };
}

function nearer(scene: Scene, meshInfo: PickingInfo, spriteInfo: PickingInfo, ray: Ray): PickHit | null {
    let mesh = hitOf(meshInfo, ray), sprite = hitOf(spriteInfo, ray);
    if (mesh && sprite) return sprite.distance < mesh.distance ? sprite : mesh;
    return mesh ?? sprite;
}

function hasPickableSprites(scene: Scene) {
    return scene.spriteManagers?.some(m => m.isPickable);
}

/** What's under the screen point `x`, `y` (canvas pixels), meshes and pickable sprites alike. */
export function pickAt(scene: Scene, x: number, y: number, options: PickOptions = {}): PickHit | null {
    let ignore = ignoredElements(options.ignore);
    let camera = scene.cameraToUseForPointers ?? scene.activeCamera;
    if (!camera) return null;
    let ray = scene.createPickingRay(x, y, null, camera);
    let meshInfo = scene.pickWithRay(ray, meshPredicate(ignore));
    let spriteInfo = options.sprites !== false && hasPickableSprites(scene)
        ? scene.pickSprite(x, y, spritePredicate(ignore), false, camera) : null;
    return nearer(scene, meshInfo, spriteInfo, ray);
}

/** The first thing along a ray from `origin` in `direction`, at most `length` away. */
export function pickAlong(scene: Scene, origin: Vector3, direction: Vector3, length = Number.POSITIVE_INFINITY, options: PickOptions = {}): PickHit | null {
    let ignore = ignoredElements(options.ignore);
    let ray = new Ray(origin.clone(), direction.normalizeToNew(), length);
    let meshInfo = scene.pickWithRay(ray, meshPredicate(ignore));
    let spriteInfo = options.sprites !== false && hasPickableSprites(scene) && scene.activeCamera
        ? scene.pickSpriteWithRay(ray, spritePredicate(ignore), false, scene.activeCamera) : null;
    return nearer(scene, meshInfo, spriteInfo, ray);
}
