import { Mesh, Scene, Sprite, SpriteManager, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

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
 * world units, default `1`), `flee-target` (selector of an element to scatter
 * away from once it comes within `flee-radius`), `flee-radius` (default `4`),
 * `flee-speed` (max flee speed, units/second, default `3`), `terrain`
 * (selector of a `<garden-height-map>` to rest on, resolved the same
 * asynchronous way as `suspension-terrain` -- see {@link BehaviourSuspension}),
 * `terrain-offset` (vertical clearance above the sampled ground, default `0`).
 *
 * @example
 * ```html
 * <garden-sprite url="data:image/png;base64,..." width="128" height="128"
 *     sprite-width="0.8" sprite-height="0.8" capacity="12" count="12"
 *     position="0 0 10" scatter-radius="6"
 *     flee-target="#buggy" flee-radius="5" flee-speed="4"
 *     terrain="#terrain" terrain-offset="0.3"></garden-sprite>
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
        let homes: Vector3[] = [];

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
                    homes.push(pos.clone());
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
                homes.push(pos.clone());
            }
        }

        this.animateFlock(scene, sprites, homes);
    }

    /**
     * Optional per-frame movement: flee from `flee-target` once it comes
     * within `flee-radius`, gently amble back toward each sprite's own spawn
     * point otherwise (keeping a scattered flock loosely together instead of
     * drifting off indefinitely), and -- with `terrain` set -- stay resting
     * on the terrain's own height throughout. A no-op when neither
     * `flee-target` nor `terrain` is set, since a plain static placement
     * (e.g. a stand of trees) needs no per-frame work at all.
     */
    private animateFlock(scene: Scene, sprites: Sprite[], homes: Vector3[]) {
        let fleeTargetSelector = this.getAttribute("flee-target");
        let terrainSelector = this.getAttribute("terrain");
        if (!fleeTargetSelector && !terrainSelector)
            return;

        let fleeRadius = Number(this.getAttribute("flee-radius") ?? 4);
        let fleeSpeed = Number(this.getAttribute("flee-speed") ?? 3);
        let terrainOffset = Number(this.getAttribute("terrain-offset") ?? 0);

        let target: Mesh = null;
        let terrain: { getHeightAtCoordinates(x: number, z: number): number } = null;

        (async () => {
            await GardenSprite.whenDocumentReady();
            if (fleeTargetSelector) {
                let [targetEl] = await GardenElement.resolveReady<GardenMesh>(fleeTargetSelector);
                target = targetEl?.mesh ?? null;
            }
            if (terrainSelector) {
                let [terrainEl] = await GardenElement.resolveReady<GardenMesh>(terrainSelector);
                terrain = <any>terrainEl?.mesh;
            }
        })().catch(err => console.error("[garden-sprite] failed to resolve flee-target/terrain", fleeTargetSelector, terrainSelector, err));

        let velocities = sprites.map(() => Vector3.Zero());
        let engine = scene.getEngine();

        scene.onBeforeRenderObservable.add(() => {
            let dt = Math.min(engine.getDeltaTime(), 50) / 1000;

            for (let i = 0; i < sprites.length; i++) {
                let pos = sprites[i].position;
                let velocity = velocities[i];
                let force = Vector3.Zero();

                if (target) {
                    let targetPosition = target.getAbsolutePosition();
                    let away = new Vector3(pos.x - targetPosition.x, 0, pos.z - targetPosition.z);
                    let distance = away.length();
                    // Tapers to nothing at fleeRadius (rather than a hard on/off snap
                    // right at the boundary) and gets stronger the closer the threat is.
                    if (distance > 0.0001 && distance < fleeRadius) {
                        force.addInPlace(away.normalize().scale((1 - distance / fleeRadius) * fleeSpeed * 8));
                    }
                }

                // A gentle pull back toward each sprite's own spawn point -- the same
                // spring-toward-a-point idea used elsewhere in this library (e.g. the
                // follow camera), just heavily damped, so a scattered flock ambles back
                // together afterwards instead of drifting off forever.
                let home = homes[i];
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

                if (terrain) {
                    let groundY = terrain.getHeightAtCoordinates(pos.x, pos.z);
                    if (Number.isFinite(groundY)) {
                        pos.y = groundY + terrainOffset;
                    }
                }
            }
        });
    }
}
