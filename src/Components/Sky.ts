import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Tools } from "@babylonjs/core/Misc/tools";
import { customElement, property } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";
import { GardenElement } from "../GardenElement";
import { Color3Convert } from "../Converters/Color3Convert";
import { PanoramaSky } from "../Nature/PanoramaSky";
import { tween } from "../Utils/tween";
import "@babylonjs/core/Helpers/sceneHelpers";

/**
 * A skybox: a large inward-facing cube with a cubemap reflection texture.
 *
 * Attributes: `root` (the cubemap's base URL/filename prefix, as Babylon's
 * `CubeTexture` expects it), `size` (plus the common {@link GardenMesh} set,
 * though colour/texture attributes are not used here -- the skybox always
 * uses `root`), `scroll-speed` (degrees/second -- continuously spins the
 * cubemap around Y via `CubeTexture.rotationY`, the property Babylon itself
 * exposes for rotating a reflection/panorama in place. Since the skybox mesh
 * is centred on the camera (`infiniteDistance`), this reads as the whole
 * starfield/backdrop sliding past a stationary viewer -- a cheap way to fake
 * forward motion through a scene with nothing else to judge speed against,
 * e.g. a starship "flying" through space).
 *
 * **A colour sky:** with `colour` and no `root`, the sky is that colour (the
 * scene's clear colour), and the fog takes the same colour unless the scene
 * sets `fog-colour`, so distant things fade into the sky. `colour-to` and
 * `duration` (seconds) fade it once the page opens -- dusk to night -- and
 * {@link fadeTo} does the same from code.
 *
 * **An environment:** `environment` (a prefiltered `.env` or `.dds` cube, as
 * Babylon's tools make them) is both the sky and the light that physically-based
 * materials reflect -- a glTF model's metal and gloss look right only with one.
 * `blur` (0 sharp … 1, default 0) softens the sky; `lighting="false"` keeps it
 * as a backdrop only; `backdrop="false"` uses it as light only (the background
 * is then `colour`); `turn` (degrees) turns it round the vertical. `size` as below (default 1000). `environment="default"` is
 * Babylon's own (`scene.createDefaultEnvironment()`): a soft backdrop, a ground
 * fading out round the origin (`ground="false"` for none) and its light --
 * a model viewer in one line. `element.environmentHelper` is Babylon's helper.
 *
 * **A photographed sky:** `panorama` (an equirectangular, 2:1 sky image) puts it on a dome round
 * the camera ({@link PanoramaSky}); `panorama-to` adds a second behind it, and `blend` (0 the
 * first … 1 the second; live) cross-fades between them, as `duration` (seconds) does once the
 * page opens, or {@link blendTo} from code. `tint` and `tint-to` darken each (`#rrggbb`; below
 * white turns a daylight photograph to evening). Thick scene fog hides the sky behind the fog's
 * colour (`haze-from`, default 0.02: the fog density it starts to fade at; `haze-range`, default
 * 0.06: how much more until it's gone), and a `<garden-lightning>` in the scene lights the first
 * panorama up when it strikes ({@link flash}). `size` is the dome's diameter (default 900). The
 * {@link PanoramaSky} is `element.panoramaSky`.
 *
 * @example
 * ```html
 * <garden-sky root="https://playground.babylonjs.com/textures/skybox" size="150"></garden-sky>
 * <garden-sky colour="#e8a46a" colour-to="#141a33" duration="120"></garden-sky>
 * <garden-sky panorama="storm.jpg" tint="#80808f" panorama-to="dusk.jpg" duration="60"></garden-sky>
 * ```
 *
 * @category Components
 */
@customElement("garden-sky")
export class GardenSky extends GardenMesh {
    @property() root: string;
    @property() environment: string;
    @property({ type: Number, attribute: "scroll-speed" }) scrollSpeed: number;
    @property() panorama: string;
    @property({ attribute: "panorama-to" }) panoramaTo: string;
    @property({ type: Number }) blend: number;

    /** The photographed sky, with `panorama`. */
    panoramaSky: PanoramaSky;

    /** Cross-fades the photographed sky to `blend` (0 the first panorama … 1 the second) over `seconds`. */
    blendTo(blend: number, seconds = 0): Promise<void> {
        let sky = this.panoramaSky;
        if (!sky) return Promise.resolve();
        let from = sky.blend;
        return tween(this.getScene(), seconds, k => sky.blend = from + (blend - from) * k);
    }

    /** Lightning: the first panorama lights up for a moment. */
    flash() {
        this.panoramaSky?.flash();
    }

    attributeChangedCallback(name: string, old: string, value: string) {
        super.attributeChangedCallback(name, old, value);
        // Elements here build once from their markup; `blend` stays live.
        if (name == "blend" && this.panoramaSky)
            this.panoramaSky.blend = Math.min(1, Math.max(0, Number(value) || 0));
    }

    /** The colour sky's colour now. */
    get skyColour(): Color3 {
        let c = this.getScene()?.clearColor;
        return c ? new Color3(c.r, c.g, c.b) : null;
    }

    /** Fades the colour sky (and a fog without its own colour) to `colour` over `seconds`. */
    fadeTo(colour: string | Color3, seconds: number): Promise<void> {
        let scene = this.getScene();
        let to = typeof colour == "string" ? parseColour(colour) : colour;
        let from = this.skyColour;
        let sceneEl = this.getSceneEl();
        return tween(scene, seconds, k => {
            let c = Color3.Lerp(from, to, k);
            scene.clearColor = new Color4(c.r, c.g, c.b, 1);
            if (!sceneEl?.fogColourSet) scene.fogColor = c.clone();
        });
    }

    updated() {
        let scene = this.getScene();
        if (this.panorama) {
            this.buildPanorama();
            return;
        }
        if (this.environment == "default") {
            // Babylon's own: a soft backdrop sky, a ground that fades out round the
            // origin (`ground="false"` for none) and its environment for PBR light.
            let options = {
                createGround: this.getAttribute("ground") != "false",
                skyboxSize: Number(this.getAttribute("size")) || undefined,
            };
            let helper = scene.createDefaultEnvironment(options);
            (<any>this).environmentHelper = helper;
            this.setMesh(helper.skybox);
            // Babylon sizes the ground and sky to what's in the scene when they're made:
            // fit them again once the page's models have loaded, so the ground sits
            // under them rather than through them.
            GardenElement.whenDocumentReady().then(async () => {
                let models = Array.from(document.querySelectorAll("garden-mesh-model")) as GardenMesh[];
                await Promise.all(models.map(m => m.whenReady?.catch(() => null)));
                if ((<any>this).environmentHelper == helper)
                    helper.updateOptions(options);
            });
            return;
        }
        if (this.environment) {
            let texture = new CubeTexture(this.environment, scene);
            if (this.getAttribute("lighting") != "false")
                scene.environmentTexture = texture;
            let turn = Number(this.getAttribute("turn"));
            if (Number.isFinite(turn) && turn)
                texture.rotationY = Tools.ToRadians(turn);
            if (this.getAttribute("backdrop") == "false") {
                // Light only: the background is the sky's `colour` (or the scene's).
                let colour = this.getAttribute("colour");
                if (colour) this.fadeTo(colour, 0);
                return;
            }
            let size = Number(this.getAttribute("size")) || 1000;
            let blur = Number(this.getAttribute("blur")) || 0;
            let skybox = scene.createDefaultSkybox(texture, true, size, blur);
            this.setMesh(skybox);
            return;
        }
        let colour = this.getAttribute("colour");
        if (!this.root && colour) {
            this.fadeTo(colour, 0);
            let to = this.getAttribute("colour-to");
            if (to)
                this.fadeTo(to, Number(this.getAttribute("duration") ?? 60));
            return;
        }

        const skybox = MeshBuilder.CreateBox("skyBox", this.buildOptions(), scene);
const skyboxMaterial = new StandardMaterial("skyBox", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.reflectionTexture = new CubeTexture(this.root, scene);
skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
skyboxMaterial.specularColor = new Color3(0, 0, 0);
skybox.material = skyboxMaterial;

if (this.scrollSpeed) {
    let reflection = <CubeTexture>skyboxMaterial.reflectionTexture;
    let engine = scene.getEngine();
    let radiansPerSecond = Tools.ToRadians(this.scrollSpeed);
    this.observe(scene.onBeforeRenderObservable, () => {
        let dt = Math.min(engine.getDeltaTime(), 50) / 1000;
        reflection.rotationY -= radiansPerSecond * dt;
    });
}
// Without this, the skybox is just a normal fixed-size cube at the origin -- any
// camera that ends up further from the origin than the box's own half-size (a
// camera `radius`/`position` bigger than half of `size`, easy to hit on a large
// scene) sits outside it entirely, seeing a bizarre close-up sliver of its
// exterior wall instead of being enclosed by it. This is Babylon's standard
// skybox recipe: render it as if infinitely far away, always surrounding
// whatever camera is active regardless of that camera's actual position.
skybox.infiniteDistance = true;
this.setMesh(skybox);
    }

    private buildPanorama() {
        let scene = this.getScene();
        this.panoramaSky?.dispose();
        let tint = (name: string) => this.getAttribute(name) ? parseColour(this.getAttribute(name)) : undefined;
        let sky = this.panoramaSky = new PanoramaSky(scene,
            { url: this.panorama, tint: tint("tint") },
            this.panoramaTo ? { url: this.panoramaTo, tint: tint("tint-to") } : undefined,
            this.hasAttribute("size") ? Number(this.getAttribute("size")) || 900 : 900);
        for (let d of sky.domes) (<any>d.mesh).element = this;
        this.mesh = sky.domes[0].mesh;
        let number = (name: string) => this.hasAttribute(name) && Number.isFinite(Number(this.getAttribute(name))) ? Number(this.getAttribute(name)) : undefined;
        sky.hazeFrom = number("haze-from") ?? sky.hazeFrom;
        sky.hazeRange = number("haze-range") ?? sky.hazeRange;
        sky.blend = Math.min(1, Math.max(0, this.blend || 0));
        if (this.panoramaTo && this.hasAttribute("duration"))
            this.blendTo(1, Number(this.getAttribute("duration")) || 0);
        // One listener per build: a rebuild or a removal takes it back (it holds the old sky).
        let listening = new AbortController();
        this.getSceneEl()?.addEventListener("garden-lightning", () => {
            if (this.panoramaSky == sky) sky.flash();
        }, { signal: listening.signal });
        this.whenDisposed(() => listening.abort());
    }

    protected dispose() {
        // Both domes and the per-frame observer go with the element (`mesh` is only the first dome).
        this.panoramaSky?.dispose();
        this.panoramaSky = null;
        super.dispose();
    }
}

function parseColour(colour: string): Color3 {
    return colour.startsWith("#") ? Color3.FromHexString(colour) : Color3Convert.fromString(colour);
}
