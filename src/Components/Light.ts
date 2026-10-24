import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Light } from "@babylonjs/core/Lights/light";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { ShadowLight } from "@babylonjs/core/Lights/shadowLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
import { Color3Convert } from "../Converters/Color3Convert";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenAnimation } from "./Animation";

/**
 * A light: `type="hemi"` (the default; ambient sky/ground light), `"point"`,
 * `"spot"` or `"directional"`.
 *
 * **Carried lights.** Inside a mesh element (a character, a lantern) a light
 * hangs on that mesh, at its `position` relative to the mesh, and goes where
 * it goes -- a guide carrying a pool of light across a dark desert.
 *
 * **Ground pool:** `pool="4"` (any type but directional) makes it a spot light shining straight down
 * from its `position`, opened so its circle on the ground is 4 m across
 * whatever the height -- a carried light that reads as a circle on the
 * ground even on a large terrain. Setting `pool` from code grows or shrinks
 * the circle.
 *
 * Attributes: `type`, `position` (default `0 1 0`; relative to the
 * carrying mesh), `direction` (spot/directional), `diffuse` or `colour`
 * (see {@link Color3Convert}, or `#rrggbb`), `specular` (the colour of its
 * highlights, the same way), `intensity`, `range` (how far a
 * point/spot light reaches), `angle` (spot cone, degrees, default 60),
 * `exponent` (spot: how fast the light fades towards the cone's edge, default
 * 2; 16 leaves no visible rim), `pool`, `shadows` (meshes cast and receive
 * shadows from this light; the value is the shadow-map size, default 1024 --
 * leave it off for phones). Every mesh casts except grounds and height maps,
 * which only receive (a terrain shading itself shows stripes of shadow acne);
 * a mesh's own `cast-shadows="false"` or `"true"`, or `receive-shadows="false"`,
 * overrides that. `cascades` (directional lights: 2–4, default 4 when given
 * without a number) splits the shadow map into cascades, sharp near the camera
 * and still there far off -- for big outdoor scenes, where one map is either
 * blurred or cut short.
 *
 * `intensity`, `range`, `pool` and `diffuse` can be set from code, or
 * animated by a `<garden-animation property="intensity">` (or `range`)
 * inside the light (`event="load"` to start at once).
 *
 * @example
 * ```html
 * <garden-mesh-model id="guide" src="robot.glb">
 *   <garden-light type="point" pool="5" position="0 2.4 0" intensity="1.5" diffuse="1 0.8 0.5"></garden-light>
 * </garden-mesh-model>
 * <garden-light type="point" position="0 4 0" range="10">
 *   <garden-animation event="load" property="intensity" type="float" loop="true" from="0" to="60" keyframes="0 1, 30 0.4, 60 1"></garden-animation>
 * </garden-light>
 * ```
 *
 * @category Components
 */
@customElement("garden-light")
export class GardenLight extends GardenElement {
    @property() type: string;
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) direction: Vector3;
    @property({ type: Number }) intensity: number;
    @property({ type: Number }) range: number;
    @property({ type: Number }) angle: number;
    @property({ type: Number }) exponent: number;
    @property({ type: Number }) pool: number;
    @property() shadows: string;

    light: Light;
    /** The shadow generator, with `shadows`. */
    shadowGenerator: ShadowGenerator;

    private _builtKey: string;

    constructor() {
        super();
        this.type = "hemi";
    }

    /** What a child `<garden-animation>` animates. */
    get animationTarget() {
        return this.light;
    }

    /** Its `updated()` handles later changes in place. */
    protected get handlesChanges() {
        return true;
    }

    async updated() {
        let scene = this.getScene();
        let type = this.pool > 0 && this.type != "directional" ? "spot" : this.type;
        let key = [type, this.hasAttribute("shadows"), this.shadows, this.getAttribute("cascades")].join("|");
        if (this.light && key == this._builtKey) {
            this.apply();
            return;
        }
        this._builtKey = key;
        this.shadowGenerator?.dispose();
        this.shadowGenerator = null;
        this.light?.dispose();
        this.light = null;

        let name = this.id || "light";
        let position = this.position ?? new Vector3(0, 1, 0);
        switch (type) {
            case "hemi":
                this.light = new HemisphericLight(name, position, scene);
                break;
            case "point":
                this.light = new PointLight(name, position, scene);
                break;
            case "spot":
                this.light = new SpotLight(name, position, this.direction ?? new Vector3(0, -1, 0),
                    Tools.ToRadians(this.angle ?? 60), 2, scene);
                break;
            case "directional":
                this.light = new DirectionalLight(name, this.direction ?? new Vector3(-1, -2, 1), scene);
                (<DirectionalLight>this.light).position = position.scale(1);
                break;
            default:
                console.warn(`<garden-light> has unrecognized type "${this.type}"; no light is built.`);
                return;
        }
        (<any>this.light).element = this;
        // `diffuse`, `state` and other options, as before.
        Object.assign(this.light, this.buildOptions());
        this.apply();

        if (this.hasAttribute("shadows") && this.light instanceof ShadowLight) {
            let size = Number(this.shadows) || 1024;
            let cascades = this.hasAttribute("cascades") && this.light instanceof DirectionalLight;
            let generator: ShadowGenerator;
            if (cascades) {
                let csm = new CascadedShadowGenerator(size, <DirectionalLight>this.light);
                csm.numCascades = Math.min(4, Math.max(2, Number(this.getAttribute("cascades")) || 4));
                (<DirectionalLight>this.light).autoCalcShadowZBounds = true;
                generator = csm;
            } else {
                generator = new ShadowGenerator(size, this.light);
            }
            this.shadowGenerator = generator;
            generator.usePercentageCloserFiltering = true;
            let add = (mesh: any) => {
                if (mesh.infiniteDistance || !mesh.isVisible) return; // not the sky
                // A mesh learns its element after it's made (GardenMesh.setMesh): decide
                // what it casts and receives on the next frame, once it knows.
                scene.onBeforeRenderObservable.addOnce(() => {
                    if (mesh.isDisposed?.()) return;
                    let el = GardenLight.elementOf(mesh);
                    let cast = el?.getAttribute("cast-shadows");
                    if (cast != null ? cast != "false" : !el?.matches("garden-ground, garden-height-map"))
                        generator.addShadowCaster(mesh, false);
                    mesh.receiveShadows = el?.getAttribute("receive-shadows") != "false";
                });
            };
            scene.meshes.forEach(add);
            scene.onNewMeshAddedObservable.add(add);
        }

        // Carried: hang on the parent's mesh once it is built.
        let parent = this.parentElement as GardenElement;
        if (parent && parent.localName != "garden-scene" && typeof parent.getNode == "function") {
            let light = this.light;
            await GardenElement.whenDocumentReady();
            await parent.whenReady;
            let node = parent.getNode();
            if (node && this.light == light && type != "hemi")
                light.parent = node;
        }

        await GardenElement.whenDocumentReady();
        for (let child of Array.from(this.children))
            if (child.matches("garden-animation") && (<GardenAnimation>child).event == "load")
                (<GardenAnimation>child).playWhenReady(<any>this);
    }

    /** The live-settable attributes. */
    /** The element a mesh was built for: its own, else its nearest parent node's. */
    static elementOf(mesh: any): HTMLElement | undefined {
        for (let node = mesh; node; node = node.parent)
            if (node.element) return node.element;
        return undefined;
    }

    private apply() {
        let light = this.light;
        if (!light) return;
        if (this.intensity != null) light.intensity = this.intensity;
        if (this.range != null) light.range = this.range;
        let colour = this.getAttribute("colour") ?? this.getAttribute("diffuse");
        if (colour)
            light.diffuse = colour.startsWith("#") ? Color3.FromHexString(colour) : Color3Convert.fromString(colour);
        let specular = this.getAttribute("specular");
        if (specular)
            light.specular = specular.startsWith("#") ? Color3.FromHexString(specular) : Color3Convert.fromString(specular);
        if (this.position && !(light instanceof HemisphericLight))
            (<any>light).position = this.position.clone();
        if (this.direction && (light instanceof SpotLight || light instanceof DirectionalLight))
            light.direction = this.direction.clone();
        if (light instanceof SpotLight) {
            if (this.pool > 0) {
                // Straight down, opened so the circle on the ground is `pool` across.
                let height = Math.max(0.1, this.position?.y ?? 2);
                light.direction = new Vector3(0, -1, 0);
                light.angle = 2 * Math.atan(this.pool / 2 / height) * 1.15; // a little wider: the edge fades
                light.exponent = 1;
                if (this.range == null) light.range = height * 3;
            } else if (this.angle != null) {
                light.angle = Tools.ToRadians(this.angle);
            }
            if (this.exponent != null && !(this.pool > 0))
                light.exponent = this.exponent;
        }
    }

    protected dispose() {
        this.shadowGenerator?.dispose();
        this.light?.dispose();
        this.light = null;
        this._builtKey = null;
        super.dispose();
    }
}
