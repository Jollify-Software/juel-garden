import { Scene, Sprite, Vector3 } from "babylonjs";
import { IBehaviourTarget } from "../IBehaviourTarget";

/**
 * Adapts one Babylon `Sprite` instance (from a `<garden-sprite>` group) to
 * {@link IBehaviourTarget}, so the same generic Behaviours that move a
 * `GardenMesh`'s single `Mesh` -- `track`/`drive`/`suspension`/`wander`/
 * `flee-target`/`terrain` -- can run once per sprite in the group instead.
 * See {@link GardenSprite}, which constructs one of these per placed sprite.
 *
 * `position` aliases the sprite's own live position object rather than
 * copying it: Behaviours mutate a target's position both in place
 * (`target.position.x += ...`, e.g. {@link BehaviourDrive}) and by whole-
 * vector reassignment (`target.position = ...`, e.g. {@link BehaviourTrack}) --
 * the getter returns the sprite's real `Vector3` so in-place writes land
 * directly, and the setter copies into that same object (rather than
 * replacing it) so a reassignment doesn't orphan the sprite from what this
 * adapter then hands out on the next read.
 *
 * `rotation` has no real backing on a sprite -- a billboard has no true 3D
 * orientation, only `.angle` (its roll around the view axis) -- so it's a
 * plain owned `Vector3` a Behaviour can read/write freely, bridged onto
 * `sprite.angle` (via its y component) by a render-loop observer that
 * {@link attachRotationSync} registers. Call that only *after* wiring up
 * whichever Behaviours will write to `rotation` (see
 * `Behaviours.applyToTarget`), so the sync observer -- registered later --
 * runs after theirs in the same frame (Babylon fires
 * `onBeforeRenderObservable` callbacks in registration order) and reads that
 * frame's freshly-written value instead of lagging a frame behind.
 *
 * @category Behaviours
 */
export class SpriteBehaviourTarget implements IBehaviourTarget {
    rotation = Vector3.Zero();

    constructor(private sprite: Sprite) { }

    get position(): Vector3 {
        return this.sprite.position as Vector3;
    }
    set position(v: Vector3) {
        (this.sprite.position as Vector3).copyFrom(v);
    }

    attachRotationSync(scene: Scene) {
        scene.onBeforeRenderObservable.add(() => {
            this.sprite.angle = this.rotation.y;
        });
    }
}
