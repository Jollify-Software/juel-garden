import { Animation } from "@babylonjs/core/Animations/animation";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import type { PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { customElement, property } from "lit/decorators.js";
import { StaticConvert } from "../Converters/StaticConvert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";

/**
 * Flies the parent camera between a set of target elements when the user
 * clicks one, or looks at one and holds still, animating position along the
 * way -- the mechanism behind the library's "educational VR tour" examples
 * (see the README's Waypoints example) and the Jollify app's VR presentations.
 * Must be a child of `<garden-camera>`.
 *
 * Attributes: `waypoints` (a selector resolving the tour stops, see
 * {@link "Utils/resolveElements"!resolveElements}), `offset` (a `Vector3` added to every stop's
 * position, e.g. eye height; none if unset), `speed` (the fly-to
 * animation's speed ratio: 1, the default, takes about 3.3 s, 2 twice as
 * fast; headsets want 2 or more), `dwell` (look-and-hold: milliseconds of
 * looking at a stop before flying there, with a reticle filling at the
 * centre of view meanwhile; 1500 by default, 0 turns it off),
 * `highlight-next` (a glowing ring round the next stop in order; on by
 * default, `highlight-next="false"` turns it off), `keys` (PageDown and
 * ArrowRight fly to the next stop, PageUp and ArrowLeft to the previous one,
 * which is what presentation clickers send; on by default, `keys="false"`
 * turns it off; keys typed into a form field or editable text, or pressed
 * with Ctrl, Alt or Meta, are left alone).
 *
 * A stop with a `look-at` attribute (a selector, or an `"x y z"` point) is faced on
 * arrival, the camera turning as it flies; without one the camera aims at the
 * scene's origin as it sets off (Parterre's slide platforms look at their panels).
 *
 * Methods: {@link next} and {@link previous} fly along the order;
 * {@link go} flies to a stop by its index. Each move fires
 * `waypoint-changed` with `{ index }`.
 *
 * @category Components
 */
@customElement("garden-waypoint")
export class GardenWaypoint extends GardenElement {
    @property() waypoints: GardenMesh[];
    @property({ converter: Vector3Convert.fromString }) offset: Vector3;
    @property({ type: Number }) speed: number;
    /** Look-and-hold time in ms (0: off). */
    @property({ type: Number }) dwell: number = 1500;
    /** A glowing ring round the next stop in order. */
    @property({ attribute: "highlight-next", converter: (v: string | null) => v !== "false" }) highlightNext: boolean = true;
    /** PageDown/ArrowRight: next stop, PageUp/ArrowLeft: previous (presentation clickers). */
    @property({ converter: (v: string | null) => v !== "false" }) keys: boolean = true;
    index: number = 0;
    prevWaypoint: GardenMesh;
    /** How far the look-and-hold reticle has filled, 0 to 1 (for tests and UIs). */
    dwellProgress: number = 0;
    private reticle: Mesh;
    private nextRing: Mesh;
    private looking: GardenMesh | undefined;
    private lookedMs = 0;
    /** The stops are being resolved: a second update meanwhile (another property set before the document was ready) leaves them to it. */
    private resolving = false;
    /** The `waypoints` selector last given, kept to build again after removal for good. */
    private selector: string;
    /** What a build added to the scene, for {@link dispose}. */
    private built: { scene: Scene, pointer: Observer<PointerInfo>, frame: Observer<Scene> } | null = null;
    /** The reticle's and next-stop ring's meshes. */
    private markers: Mesh[] = [];

    connectedCallback() {
        super.connectedCallback();
        // On the window, bubbling: a scene in an iframe gets keys while the iframe has focus,
        // and a host page handler that calls preventDefault() first wins.
        window.addEventListener("keydown", this.onKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("keydown", this.onKeyDown);
    }

    /** next()/previous() from the keys a presentation clicker sends (see `keys`). */
    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.keys || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
        const step = e.key === "PageDown" || e.key === "ArrowRight" ? 1
            : e.key === "PageUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!step || !this.waypoints?.length || typeof this.waypoints === "string") return;
        // The real target, inside any shadow root (focus in a component's own input counts).
        const t = (e.composedPath?.()[0] ?? e.target) as HTMLElement;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ""))) return;
        e.preventDefault();
        if (step > 0) this.next(); else this.previous();
    };

    async updated() {
        if (this.resolving)
            return;
        // A new selector builds; otherwise only an element added back after removal for good
        // (which disposed the last build) builds again from the one it had.
        if (typeof this.waypoints === 'string')
            this.selector = this.waypoints;
        else if (this.built || !this.selector)
            return;

        // Read before any await: by the time this one resumes, another update may have
        // replaced the string with the resolved stops (the `n.trim is not a function` race).
        const selector = this.selector;
        this.resolving = true;
        this.beginBuild();
        try {
            // Waypoints are resolved by id from anywhere in the document, so we can't
            // proceed until the whole document has actually been parsed.
            if (document.readyState === 'loading') {
                await new Promise<void>(resolve =>
                    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
                );
            }

            this.waypoints = await GardenElement.resolveReady<GardenMesh>(selector);

            let scene = this.getScene();
            this.setPosition(this.waypoints[this.index].getPosition());

            this.disposeBuilt();
            const pointer = scene.onPointerObservable.add((pointerInfo) => {
                switch (pointerInfo.type) {
                    case PointerEventTypes.POINTERDOWN:
                        if (pointerInfo.pickInfo.hit) {
                            let wp = this.stopOf(pointerInfo.pickInfo.pickedMesh);
                            if (wp) this.go(this.waypoints.indexOf(wp));
                        }
                        break;
                }
            });

            this.buildMarkers();
            const frame = scene.onBeforeRenderObservable.add(() => this.onFrame());
            this.built = { scene, pointer, frame };
        } finally {
            this.resolving = false;
            this.endBuild();
        }
    }

    /** Removed for good: its observers, reticle and next-stop ring leave the scene. */
    protected dispose() {
        this.disposeBuilt();
        super.dispose();
    }

    private disposeBuilt() {
        if (!this.built)
            return;
        // The scene it was built in: once removed, getScene() finds none up the page.
        const scene = this.built.scene;
        scene.onPointerObservable.remove(this.built.pointer);
        scene.onBeforeRenderObservable.remove(this.built.frame);
        this.built = null;
        for (const m of this.markers)
            if (!m.isDisposed()) m.dispose(false, true);
        this.markers = [];
        this.reticle = null;
        this.nextRing = null;
    }

    /** The stop a picked mesh belongs to (its own mesh, or one of its children). */
    private stopOf(mesh: AbstractMesh | null | undefined): GardenMesh | undefined {
        for (let m = mesh; m; m = m.parent instanceof AbstractMesh ? m.parent : null) {
            const wp = this.waypoints.find(x => x.mesh == m);
            if (wp) return wp;
        }
        return undefined;
    }

    /** The reticle (a faint ring and a disc that grows as you hold) and the next-stop ring. */
    private buildMarkers() {
        const scene = this.getScene();
        const camera = (<Camera>(<any>this.parentElement).camera);
        const unlit = (name: string, colour: string, alpha: number) => {
            const mat = new StandardMaterial(name, scene);
            mat.disableLighting = true;
            mat.emissiveColor = Color3.FromHexString(colour);
            mat.alpha = alpha;
            mat.backFaceCulling = false;
            return mat;
        };
        if (this.dwell > 0 && camera) {
            // Just beyond the near plane (Babylon's default minZ is 1: at 1 it would be clipped),
            // sized to the distance so it covers the same small angle (about 2.3 degrees).
            const d = Math.max(1, camera.minZ) * 1.5;
            const ring = MeshBuilder.CreateTorus("waypoint-reticle-ring", { diameter: 0.04 * d, thickness: 0.004 * d, tessellation: 32 }, scene);
            ring.rotation.x = Math.PI / 2;
            ring.material = unlit("waypoint-reticle-ring", "#ffffff", 0.6);
            this.reticle = MeshBuilder.CreateDisc("waypoint-reticle", { radius: 0.018 * d, tessellation: 32 }, scene);
            this.reticle.material = unlit("waypoint-reticle", "#ffffff", 0.85);
            this.reticle.scaling.setAll(0.001);
            // Dark edges just behind the white ring and disc, so the reticle reads on a white
            // platform or wall as well as on the sky (ClassVR's text panels and platforms are pale).
            const outline = MeshBuilder.CreateTorus("waypoint-reticle-outline", { diameter: 0.04 * d, thickness: 0.009 * d, tessellation: 32 }, scene);
            outline.rotation.x = Math.PI / 2;
            outline.material = unlit("waypoint-reticle-outline", "#1a1a1a", 0.5);
            const edge = MeshBuilder.CreateDisc("waypoint-reticle-edge", { radius: 0.0215 * d, tessellation: 32 }, scene);
            edge.material = unlit("waypoint-reticle-edge", "#1a1a1a", 0.6);
            for (const m of [outline, ring, edge, this.reticle]) {
                m.isPickable = false;
                m.renderingGroupId = 1;
                m.parent = camera;
            }
            outline.position.z = d * 1.002;
            ring.position.z = d;
            this.reticle.position.z = d * 0.999;
            // The edge grows with the disc: a child of it, a little behind.
            edge.parent = this.reticle;
            edge.position.z = d * 0.0005;
            this.markers.push(outline, ring, edge, this.reticle);
        }
        if (this.highlightNext) {
            this.nextRing = MeshBuilder.CreateTorus("waypoint-next", { diameter: 1.6, thickness: 0.08, tessellation: 48 }, scene);
            this.nextRing.material = unlit("waypoint-next", "#ffd166", 0.9);
            this.nextRing.isPickable = false;
            this.markers.push(this.nextRing);
            this.placeNextRing();
        }
    }

    private placeNextRing() {
        if (!this.nextRing || !this.waypoints?.length) return;
        const next = this.waypoints[(this.index + 1) % this.waypoints.length];
        this.nextRing.setEnabled(this.waypoints.length > 1);
        this.nextRing.position = next.getPosition().add(new Vector3(0, 0.05, 0));
    }

    /** Each frame: what's at the centre of view, and how long it's been there. */
    private onFrame() {
        const scene = this.getScene();
        if (this.nextRing?.isEnabled()) {
            const t = performance.now() / 1000;
            this.nextRing.scaling.setAll(1 + 0.08 * Math.sin(t * 2.5));
            this.placeNextRing();
        }
        if (!(this.dwell > 0) || !scene.activeCamera) return;
        const pick = scene.pickWithRay(scene.activeCamera.getForwardRay(200), m => m.isPickable && m.isEnabled());
        const wp = pick?.hit ? this.stopOf(pick.pickedMesh) : undefined;
        const current = this.waypoints[this.index];
        if (!wp || wp === current || wp !== this.looking) {
            this.looking = wp && wp !== current ? wp : undefined;
            this.lookedMs = 0;
        } else {
            this.lookedMs += scene.getEngine().getDeltaTime();
        }
        this.dwellProgress = this.looking ? Math.min(1, this.lookedMs / this.dwell) : 0;
        this.reticle?.scaling.setAll(Math.max(0.001, this.dwellProgress));
        if (this.looking && this.dwellProgress >= 1) {
            const target = this.looking;
            this.looking = undefined;
            this.lookedMs = 0;
            this.dwellProgress = 0;
            this.go(this.waypoints.indexOf(target));
        }
    }

    /** Flies to stop `index` (in `waypoints` order), leaving the current stop's orbit and joining the new one's. */
    go(index: number) {
        if (!this.waypoints?.length || index < 0 || index >= this.waypoints.length || index === this.index) return;
        const wp = this.waypoints[index];
        this.prevWaypoint = this.waypoints[this.index];
        if ('leave' in this.prevWaypoint) {
            (<any>this.prevWaypoint).leave(
                (<Camera>(<any>this.parentElement).camera)
            );
        }
        // Fly to the target's current (world-space) position first, and
        // only join its orbit once we've actually arrived -- entering the
        // orbit reparents the camera, so doing it before the fly-to
        // animation finishes would have the animation tween a value that's
        // suddenly local-to-the-pivot instead of world-space, causing a
        // jump and then a runaway drift.
        this.moveToPosition(wp.getPosition(), () => {
            if ('enter' in wp) {
                (<any>wp).enter((<Camera>(<any>this.parentElement).camera));
            }
        }, () => wp.getPosition(), this.lookPointOf(wp));
        this.index = index;
        this.placeNextRing();
        this.dispatchEvent(new CustomEvent("waypoint-changed", { detail: { index }, bubbles: true, composed: true }));
    }

    /**
     * Flies the camera from the current stop to `position` (plus `offset`). With `follow`, the
     * end of the fly is moved to `follow()` every frame, so a stop that moves while you fly (an
     * orbiting platform) is where you land, not where it was when the fly began.
     */
    moveToPosition(position: Vector3, onComplete?: () => void, follow?: () => Vector3 | undefined, lookAt?: Vector3) {
        let scene = this.getScene();
        let camera = (<Camera>(<any>this.parentElement).camera);
        // Unset `offset` means no offset, as in setPosition.
        let offset = this.offset ?? Vector3.Zero();
        // A stop with `look-at`: turn to face it while flying (not in a headset, whose head decides).
        let turn: Animation | null = null;
        let free = camera as any;
        if (lookAt && free.rotation && !free.rotationQuaternion) {
            let dir = lookAt.subtract(position.add(offset));
            let from = (free.rotation as Vector3).clone();
            let to = new Vector3(Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)), Math.atan2(dir.x, dir.z), 0);
            // Turn the short way round.
            to.y = from.y + Math.atan2(Math.sin(to.y - from.y), Math.cos(to.y - from.y));
            turn = new Animation("turn", "rotation", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE, false);
            turn.setKeys([{ frame: 0, value: from }, { frame: 100, value: to }]);
        } else {
            this.lookAtOrigin();
        }
        let anime = new Animation("anime", "position", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE, false);
        anime.setKeys([
            {
                frame: 0,
                value: this.waypoints[this.index].getPosition().add(offset)
            },
            {
                frame: 100,
                value: position.add(offset)
            }
        ]);
        camera.animations = [];
        camera.animations.push(anime);
        if (turn)
            camera.animations.push(turn);
        let speedRatio = this.speed > 0 ? this.speed : 1.0;
        let tracking: Observer<Scene> | null = null;
        if (follow) {
            const end = anime.getKeys()[1];
            tracking = scene.onBeforeRenderObservable.add(() => {
                const p = follow();
                if (p) end.value = p.add(offset);
            });
        }
        scene.beginAnimation(camera, 0, 100, false, speedRatio, () => {
            if (tracking) scene.onBeforeRenderObservable.remove(tracking);
            onComplete?.();
        });
    }

    /**
     * Where to face on arriving at `stop`: its `look-at` attribute, a selector (an element's
     * position) or an `"x y z"` point; undefined without one (the camera aims at the origin).
     */
    lookPointOf(stop: Element): Vector3 | undefined {
        let value = stop?.getAttribute("look-at")?.trim();
        if (!value)
            return undefined;
        if (/^[-+\d.eE\s]+$/.test(value))
            return Vector3Convert.fromString(value);
        let target = document.querySelector(value) as any;
        return target?.getPosition?.() ?? undefined;
    }

    setPosition(pos: Vector3) {
        if (this.offset)
            pos = pos.add(this.offset);

        (<any>this.parentElement).setPosition(pos);
        this.lookAtOrigin();
    }

    // A fresh FreeCamera keeps whatever rotation it was constructed with (facing
    // Babylon's default +Z) -- nothing ever points it at the scene, so simply
    // teleporting it to a waypoint can leave it staring at empty sky instead of
    // whatever that stop is meant to show. The waypoint markers/content in these
    // tours tend to sit near the world origin, so aiming there on every move is a
    // reasonable default look direction without needing a per-waypoint "look at".
    lookAtOrigin() {
        let camera = (<any>this.parentElement).camera;
        if (camera && 'setTarget' in camera)
            camera.setTarget(Vector3.Zero());
    }

    /** Flies to the next stop in order (after the last, the first). */
    next() {
        if (!this.waypoints?.length) return;
        this.go((this.index + 1) % this.waypoints.length);
    }

    /** Flies to the previous stop in order (before the first, the last). */
    previous() {
        if (!this.waypoints?.length) return;
        this.go((this.index - 1 + this.waypoints.length) % this.waypoints.length);
    }
}
