import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsHelper, PhysicsRadialImpulseFalloff, PhysicsUpdraftMode } from "@babylonjs/core/Physics/physicsHelper";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { GardenPhysics } from "./Physics";

/**
 * A force on every physics body near a point (needs `<garden-physics>`): an
 * explosion that throws things outwards, a field that pulls them in, an
 * updraft, a whirlwind. Babylon's
 * [physics helpers](https://doc.babylonjs.com/features/featuresDeepDive/physics/physicsHelper),
 * declared.
 *
 * Attributes:
 * - `type` -- `explosion` (default: one push outwards, at once), `gravity`
 *   (pulls bodies towards `position` while it's on), `updraft` (lifts bodies
 *   in a cylinder `radius` wide and `height` tall above `position`) or
 *   `vortex` (spins them up round its axis, a whirlwind).
 * - `position` -- its centre (the cylinder's foot for `updraft`/`vortex`),
 *   world space.
 * - `radius` (default 5), `strength` (default 10), `height` (`updraft` and
 *   `vortex`, default 10).
 * - `falloff` -- `linear` (weaker towards the edge) or `constant` (default),
 *   for `explosion` and `gravity`; `mode="force"` makes an explosion a force
 *   over one step instead of an impulse; `updraft-mode="perpendicular"`
 *   lifts along the updraft's axis everywhere instead of away from its centre.
 * - `event="load"` -- goes off by itself once the bodies exist (after
 *   `delay` ms, default 0). Otherwise call {@link fire}.
 * - `duration` -- ms a field stays on once fired (unset: until {@link stop}).
 * - `show` -- a translucent sphere or cylinder shows where it reaches while
 *   it acts (the explosion's for `show` ms, default 1500), for working on a
 *   scene.
 *
 * `fire()` sets it off (an explosion again each time); `stop()` turns a field
 * off; `active` says whether a field is on. Fires `garden-force` (bubbling)
 * each time it goes off.
 *
 * @example
 * ```html
 * <garden-physics></garden-physics>
 * <garden-force id="blast" type="explosion" position="0 0 0" radius="8" strength="20" falloff="linear"></garden-force>
 * <garden-force type="updraft" position="10 0 10" radius="12" strength="2" height="20" event="load" duration="2000"></garden-force>
 * <button onclick="blast.fire()">Boom</button>
 * ```
 *
 * @category Components
 */
@customElement("garden-force")
export class GardenForce extends GardenElement {
    @property() type: string;
    @property() event: string;

    /** True while a field is on. */
    active = false;

    private helper: PhysicsHelper;
    private field: { enable(): void, disable(): void, dispose(): void };
    private shown: Mesh;
    private timers: number[] = [];

    protected unbuild() {
        this.stop();
        super.unbuild();
    }

    protected dispose() {
        this.stop();
        super.dispose();
    }

    async updated() {
        this.beginBuild();
        await GardenElement.whenDocumentReady();
        let physicsEl = GardenPhysics.forElement(this);
        if (!physicsEl) {
            console.warn("<garden-force> needs a <garden-physics> element in its <garden-scene>.");
            this.endBuild();
            return;
        }
        await physicsEl.ready;
        let scene = this.getScene();
        if (!scene) return;
        this.helper = new PhysicsHelper(scene);
        this.endBuild();
        if (this.event == "load") {
            // The bodies are made a frame or two after their meshes: let them all exist first.
            let delay = this.num("delay") ?? 0;
            scene.onAfterRenderObservable.addOnce(() =>
                this.later(() => this.fire(), delay));
        }
    }

    private num(name: string): number {
        return this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
    }

    private later(fn: () => void, ms: number) {
        let id = window.setTimeout(() => {
            this.timers = this.timers.filter(t => t != id);
            fn();
        }, ms);
        this.timers.push(id);
    }

    private origin(): Vector3 {
        return (this.position ?? Vector3.Zero()).clone();
    }

    /** Sets it off: an explosion pushes once; a field turns on (for `duration` ms, if set). */
    fire() {
        if (!this.helper) return;
        let type = (this.type || "explosion").toLowerCase();
        let origin = this.origin();
        let radius = this.num("radius") ?? 5;
        let strength = this.num("strength") ?? 10;
        let height = this.num("height") ?? 10;
        let falloff = (this.getAttribute("falloff") ?? "").toLowerCase() == "linear"
            ? PhysicsRadialImpulseFalloff.Linear : PhysicsRadialImpulseFalloff.Constant;
        let options: any = { radius, strength, falloff, height };
        switch (type) {
            case "explosion": {
                let event = this.getAttribute("mode") == "force"
                    ? this.helper.applyRadialExplosionForce(origin, options)
                    : this.helper.applyRadialExplosionImpulse(origin, options);
                event?.dispose();
                this.show(type, radius, height, this.num("show") || 1500);
                break;
            }
            case "gravity":
            case "updraft":
            case "vortex": {
                this.stop();
                if (type == "updraft" && this.getAttribute("updraft-mode") == "perpendicular")
                    options.updraftMode = PhysicsUpdraftMode.Perpendicular;
                this.field = type == "gravity" ? this.helper.gravitationalField(origin, options)
                    : type == "updraft" ? this.helper.updraft(origin, options)
                    : this.helper.vortex(origin, options);
                if (!this.field) return;
                this.field.enable();
                this.active = true;
                this.show(type, radius, height);
                let duration = this.num("duration");
                if (duration != null)
                    this.later(() => this.stop(), duration);
                break;
            }
            default:
                console.warn(`<garden-force> has unrecognized type "${this.type}".`);
                return;
        }
        this.dispatchEvent(new CustomEvent("garden-force", { bubbles: true, detail: { type } }));
    }

    /** Turns a field off (and hides `show`); an explosion has nothing to stop. */
    stop() {
        for (let id of this.timers.splice(0))
            clearTimeout(id);
        if (this.field) {
            this.field.disable();
            this.field.dispose();
            this.field = null;
        }
        this.active = false;
        this.hide();
    }

    private show(type: string, radius: number, height: number, ms?: number) {
        if (!this.hasAttribute("show")) return;
        this.hide();
        let scene = this.getScene();
        let mesh = type == "updraft" || type == "vortex"
            ? MeshBuilder.CreateCylinder("force", { height, diameter: radius * 2 }, scene)
            : MeshBuilder.CreateSphere("force", { diameter: radius * 2 }, scene);
        mesh.position = this.origin();
        if (type == "updraft" || type == "vortex")
            mesh.position.y += height / 2;
        let material = new StandardMaterial("force", scene);
        material.alpha = 0.5;
        material.diffuseColor = Color3.White();
        mesh.material = material;
        mesh.isPickable = false;
        this.shown = mesh;
        if (ms)
            this.later(() => this.hide(), ms);
    }

    private hide() {
        if (!this.shown) return;
        this.shown.material?.dispose();
        this.shown.dispose();
        this.shown = null;
    }
}
