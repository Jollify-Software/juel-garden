import { MeshBuilder, StandardMaterial, CubeTexture, Texture, Color3, Color4, Tools } from "babylonjs";
import { customElement, property } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";
import { Color3Convert } from "../Converters/Color3Convert";
import { tween } from "../Utils/tween";

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
 * @example
 * ```html
 * <garden-sky root="https://playground.babylonjs.com/textures/skybox" size="150"></garden-sky>
 * <garden-sky colour="#e8a46a" colour-to="#141a33" duration="120"></garden-sky>
 * ```
 *
 * @category Components
 */
@customElement("garden-sky")
export class GardenSky extends GardenMesh {
    @property() root: string;
    @property({ type: Number, attribute: "scroll-speed" }) scrollSpeed: number;

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
    scene.onBeforeRenderObservable.add(() => {
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
}

function parseColour(colour: string): Color3 {
    return colour.startsWith("#") ? Color3.FromHexString(colour) : Color3Convert.fromString(colour);
}
