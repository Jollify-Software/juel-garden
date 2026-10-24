import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsEventType, PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
import HavokPhysics from "@babylonjs/havok";
import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import { customElement, property } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";

// Captured while the bundle's own <script> is executing -- the only moment
// document.currentScript points at juel-garden.js -- so the Havok WASM, which
// the build copies next to the bundle, can be found wherever the page lives.
const scriptSrc = (document.currentScript as HTMLScriptElement)?.src;
const defaultWasmUrl = scriptSrc
    ? new URL("HavokPhysics.wasm", scriptSrc).href
    : "HavokPhysics.wasm";

/** The element a physics body belongs to (set by {@link GardenMesh.setMesh}). */
export function elementOfBody(body: PhysicsBody): GardenElement {
    return (<any>body?.transformNode)?.element ?? null;
}

/** What {@link GardenPhysics.raycast} hit. */
export interface RaycastHit {
    /** The element whose body was hit. */
    element: GardenElement;
    /** Where, in world space. */
    point: Vector3;
    /** The surface's normal there. */
    normal: Vector3;
    /** How far from the ray's start. */
    distance: number;
    /** For a mesh with a `grid` of copies, which copy; else undefined. */
    instance?: number;
}

/**
 * Turns on rigid-body physics for its `<garden-scene>`, using the
 * [Havok](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin)
 * engine (WASM, loaded on demand -- scenes without this element never fetch
 * it). Shapes then opt in one by one with the `physics` attribute (see
 * {@link GardenMesh}).
 *
 * Attributes:
 * - `gravity` -- a `Vector3` in m/s², default `"0 -9.81 0"`. `"0 0 0"` for
 *   zero gravity (space, a ball floating inside a cube). Not the scene's own
 *   `gravity`, which only drives camera collisions.
 * - `timestep` -- seconds per physics step. Unset steps by each frame's real
 *   delta; set (e.g. `"0.0166"`) for a fixed, repeatable step.
 * - `rest-speed` -- the speed (units/s, and rad/s for spin) under which a
 *   dynamic body counts as stopped, default `0.05`. See `garden-rest` below.
 * - `wasm` -- URL of `HavokPhysics.wasm`, default: next to `juel-garden.js`.
 * - `debug` -- draws every body's collision shape as a wireframe (Babylon's
 *   `PhysicsViewer`), bodies made later included, for working on a scene;
 *   `debug="moving"` leaves out static ones (floors, walls).
 *
 * Events (all bubble, so one listener on the scene catches every body):
 * - `garden-rest` on this element -- every dynamic body has come to a stop
 *   after something moved. Turn-based games use it as "the shot is over";
 *   {@link atRest} is the same state as a property.
 * - `garden-collide` on a dynamic body's element when it starts touching
 *   another body. `detail`: `{ other, point, normal, impulse }`.
 * - `garden-trigger-enter` / `garden-trigger-exit` on a `physics="trigger"`
 *   element when a body enters or leaves it. `detail`: `{ other }`.
 *
 * **Raycasts** ({@link raycast}): the first body a line between two points
 * hits, from the physics world rather than the meshes (cheaper than picking
 * with many bodies, and it sees what the physics sees) -- an aim line, a line
 * of sight, what's under the cursor or in front of a character.
 *
 * @example
 * ```html
 * <garden-scene>
 *   <garden-physics gravity="0 0 0"></garden-physics>
 *   <garden-sphere physics restitution="0.9" velocity="2 0 1"></garden-sphere>
 *   <garden-box physics="static" width="10" height="1" depth="10" position="0 -3 0"></garden-box>
 * </garden-scene>
 * ```
 *
 * @category Components
 */
@customElement("garden-physics")
export class GardenPhysics extends GardenElement {
    @property({ converter: Vector3Convert.fromString }) gravity: Vector3;
    @property({ type: Number }) timestep: number;
    @property({ type: Number, attribute: "rest-speed" }) restSpeed = 0.05;
    @property() wasm: string;

    plugin: HavokPlugin;

    /** The loaded Havok WASM module. */
    havok: any;

    /** True while every dynamic body is stopped. */
    atRest = true;

    /** Resolves with the plugin once Havok is loaded and the scene's physics is on. */
    readonly ready: Promise<HavokPlugin>;
    private _resolveReady: (plugin: HavokPlugin) => void;

    private _dynamicBodies = new Set<PhysicsBody>();
    private _started = false;

    constructor() {
        super();
        this.ready = new Promise(resolve => { this._resolveReady = resolve; });
    }

    /**
     * The first body the straight line from `from` to `to` hits (world space), or null.
     * `ignore` leaves out one element's body (the one doing the looking); `triggers`
     * counts `physics="trigger"` sensors too. The hit gives the `element`, the `point` and
     * surface `normal`, the `distance` from `from`, and for a `grid` of copies the
     * `instance` index of the one hit.
     */
    raycast(from: Vector3, to: Vector3, options: { ignore?: GardenElement, triggers?: boolean } = {}): RaycastHit | null {
        let engine: any = this.getScene()?.getPhysicsEngine();
        if (!engine) return null;
        let result = new PhysicsRaycastResult();
        let ignoreBody = (<any>options.ignore)?.physicsAggregate?.body;
        engine.raycastToRef(from, to, result, { shouldHitTriggers: !!options.triggers, ignoreBody });
        if (!result.hasHit) return null;
        return {
            element: elementOfBody(result.body),
            point: result.hitPointWorld.clone(),
            normal: result.hitNormalWorld.clone(),
            distance: Vector3.Distance(from, result.hitPointWorld),
            instance: result.bodyIndex,
        };
    }

    /** The `<garden-physics>` of the scene `el` is in, or null if it has none. */
    static forElement(el: GardenElement): GardenPhysics {
        return el.getSceneEl()?.querySelector("garden-physics") ?? null;
    }

    /** Called by {@link GardenMesh} for each dynamic body it creates or disposes. */
    trackDynamic(body: PhysicsBody, track: boolean) {
        if (track) {
            this._dynamicBodies.add(body);
        } else {
            this._dynamicBodies.delete(body);
        }
    }

    async updated() {
        // Engine settings are fixed once the world exists; later attribute
        // changes only update what can change live.
        if (this._started) {
            this.applySettings();
            return;
        }
        this._started = true;
        this.beginBuild();

        let scene = this.getScene();
        let wasmUrl = this.wasm ?? defaultWasmUrl;
        let havok = this.havok = await HavokPhysics({ locateFile: () => wasmUrl });

        this.plugin = new HavokPlugin(this.timestep == null, havok);
        scene.enablePhysics(this.gravity ?? new Vector3(0, -9.81, 0), this.plugin);
        this.applySettings();

        this.plugin.onTriggerCollisionObservable.add(ev => {
            let name = ev.type == PhysicsEventType.TRIGGER_ENTERED ? "garden-trigger-enter"
                : ev.type == PhysicsEventType.TRIGGER_EXITED ? "garden-trigger-exit"
                : null;
            if (!name) return;
            // Havok doesn't promise which side of the pair is the trigger.
            let a = elementOfBody(ev.collider), b = elementOfBody(ev.collidedAgainst);
            let [trigger, other] = a?.getAttribute("physics") == "trigger" ? [a, b] : [b, a];
            trigger?.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { other } }));
        });

        scene.onAfterPhysicsObservable.add(() => this.checkRest());
        if (this.hasAttribute("debug"))
            this.showBodies();

        this._resolveReady(this.plugin);
        this.endBuild();
    }

    /** `debug`: a wireframe on every body, checked twice a second for new ones. */
    private showBodies() {
        let scene = this.getScene();
        let viewer = new PhysicsViewer(scene);
        let shown = new Set<PhysicsBody>();
        let movingOnly = this.getAttribute("debug") == "moving";
        let check = () => {
            for (let node of (scene.transformNodes as any[]).concat(scene.meshes)) {
                let body = node.physicsBody as PhysicsBody;
                if (body && !shown.has(body) && !body.isDisposed &&
                    !(movingOnly && body.getMotionType() == PhysicsMotionType.STATIC)) {
                    shown.add(body);
                    viewer.showBody(body);
                }
            }
        };
        check();
        let timer = setInterval(check, 500);
        this.whenDisposed(() => { clearInterval(timer); viewer.dispose(); });
    }

    private applySettings() {
        let engine = this.getScene()?.getPhysicsEngine();
        if (!engine) return;
        if (this.gravity) engine.setGravity(this.gravity);
        if (this.timestep != null) engine.setTimeStep(this.timestep);
    }

    /**
     * True once Havok has put `body` to sleep. A sleeping body keeps
     * reporting the velocity it had when it fell asleep (often a slow spin
     * above `rest-speed`), so velocities alone never reach "at rest".
     */
    isAsleep(body: PhysicsBody): boolean {
        let id = (<any>body)._pluginData?.hpBodyId;
        if (!id) return false;
        let state = this.havok.HP_Body_GetActivationState(id)[1];
        return state == this.havok.ActivationState.INACTIVE;
    }

    private checkRest() {
        let moving = false;
        for (let body of this._dynamicBodies) {
            if (this.isAsleep(body))
                continue;
            if (body.getLinearVelocity().length() > this.restSpeed ||
                body.getAngularVelocity().length() > this.restSpeed) {
                moving = true;
                break;
            }
        }
        if (moving) {
            this.atRest = false;
        } else if (!this.atRest) {
            this.atRest = true;
            this.dispatchEvent(new CustomEvent("garden-rest", { bubbles: true }));
        }
    }
}
