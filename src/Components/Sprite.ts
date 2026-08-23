import { Sprite, SpriteManager, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { Behaviours } from "../Behaviours/Behaviours";
import { SpriteBehaviourTarget } from "../Behaviours/SpriteBehaviourTarget";
import { GardenElement } from "../GardenElement";

/**
 * A batch of billboard sprites (e.g. a stand of trees, or a flock of animals)
 * from a single sprite sheet, via Babylon's `SpriteManager`. Placement is
 * either explicit (`positions`) or scattered randomly (`count` +
 * `scatter-radius`, around this element's own `position`); optionally, each
 * sprite can flee from another element and/or rest on a heightmap's terrain.
 *
 * Attributes: `url` (sprite sheet), `capacity`, `count` (sprites per
 * `positions` group, or total when scattering), `width`/`height` (the sprite
 * sheet's cell size in *pixels*, not world size -- see `sprite-width`/
 * `sprite-height` for that), `positions` (comma-separated groups of `"x y z"`
 * triples, each may use `(Math...)` expressions -- `count` sprites placed per
 * group, all at that exact point), `scatter-radius` (when `positions` is
 * omitted, scatters `count` sprites uniformly within this radius of
 * `position`), `sprite-width`/`sprite-height` (each sprite's on-screen size in
 * world units, default `1`).
 *
 * Per-frame movement is delegated entirely to the generic `Behaviours` --
 * see {@link BehaviourFlee} (`flee-target`/`flee-radius`/`flee-speed`),
 * {@link BehaviourTerrain} (`terrain`/`terrain-offset`), and
 * {@link BehaviourWander} (`wander`/`wander-radius`/`wander-speed`/
 * `points-of-interest`/`look-radius`/`look-chance`/`look-duration`) for
 * their exact attributes -- applied once per placed sprite via
 * {@link SpriteBehaviourTarget}, the same way `GardenMesh` applies them to
 * its own single `Mesh` (see {@link Behaviours}).
 *
 * @example
 * ```html
 * <garden-sprite url="data:image/png;base64,..." width="128" height="128"
 *     sprite-width="0.8" sprite-height="0.8" capacity="12" count="12"
 *     position="0 0 10" scatter-radius="6"
 *     flee-target="#buggy" flee-radius="5" flee-speed="4"
 *     terrain="#terrain" terrain-offset="0.3"></garden-sprite>
 *
 * <garden-sprite url="npc.png" width="64" height="64" sprite-width="1"
 *     sprite-height="1.8" capacity="6" count="6" position="0 0 0"
 *     scatter-radius="4" wander wander-radius="5" wander-speed="1.2"
 *     points-of-interest=".painting" look-radius="1.5"
 *     look-duration="3 7"></garden-sprite>
 * ```
 *
 * @category Components
 */
@customElement("garden-sprite")
export class GardenSprite extends GardenElement {
    @property({ type: Number }) capacity: number;
    @property() url: string;
    @property({ type: Number }) count: number;
    @property() positions: string;

    updated() {
        let scene = this.getScene();
        const manager = new SpriteManager(this.id ?? "sprites", this.url, this.capacity, this.buildOptions(), scene);

        let spriteWidth = Number(this.getAttribute("sprite-width") ?? 1);
        let spriteHeight = Number(this.getAttribute("sprite-height") ?? 1);

        let place = (pos: Vector3): Sprite => {
            let sprite = new Sprite(this.id ?? "sprite", manager);
            sprite.position = pos.clone();
            sprite.width = spriteWidth;
            sprite.height = spriteHeight;
            return sprite;
        };

        let sprites: Sprite[] = [];

        if (this.positions) {
            let posGroups = this.positions.split(',').map(x => x.trim());
            for (let g = 0; g < posGroups.length; g++) {
                let ray = posGroups[g].split(' ').map(x => {
                    if (x.indexOf('(') >= 0) {
                        return (new Function('Math', `return ${x}`))(Math) as number;
                    } else {
                        return Number(x);
                    }
                });
                let pos = new Vector3(ray[0], ray[1], ray[2]);
                for (let i = 0; i < this.count; i++) {
                    sprites.push(place(pos));
                }
            }
        } else if (this.count) {
            // Scattered placement: uniform over a disk (sqrt(random()) for the
            // radius, not plain random()) so points don't bunch up near the centre.
            let center = this.position ?? Vector3.Zero();
            let radius = Number(this.getAttribute("scatter-radius") ?? 3);
            for (let i = 0; i < this.count; i++) {
                let angle = Math.random() * Math.PI * 2;
                let r = Math.sqrt(Math.random()) * radius;
                let pos = new Vector3(center.x + Math.cos(angle) * r, center.y, center.z + Math.sin(angle) * r);
                sprites.push(place(pos));
            }
        }

        // Same generic Behaviours pipeline GardenMesh.modifyMesh applies to its
        // own single Mesh (see Behaviours.applyBehaviours) -- once per placed
        // sprite here instead, each through its own SpriteBehaviourTarget so
        // per-instance state (a wander target, a flee velocity, ...) stays
        // independent between sprites in the same group.
        let collection = Array.prototype.slice.call(this.attributes) as Attr[];
        for (let sprite of sprites) {
            let target = new SpriteBehaviourTarget(sprite);
            Behaviours.applyToTarget(this, target, collection);
            target.attachRotationSync(scene);
        }
    }
}
