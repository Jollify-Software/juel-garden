import { Color3 } from "@babylonjs/core/Maths/math.color";
import { EnvironmentHelper } from "@babylonjs/core/Helpers/environmentHelper";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/core/Materials/Textures/Loaders/ddsTextureLoader";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";

/**
 * Babylon's default environment: an image-based lighting map that PBR
 * materials (most glTF models) need to look right, and optionally a soft
 * backdrop of a ground and a sky dome
 * ([`scene.createDefaultEnvironment`](https://doc.babylonjs.com/features/featuresDeepDive/scene/fastBuildWorld#create-default-environment)).
 * Its files come from Babylon's asset server unless given.
 *
 * Attributes:
 * - `texture` -- the lighting map (a `.env` or `.dds` cube), default Babylon's.
 * - `ground` (default on; `"false"` for none), `ground-size` (default 15),
 *   `ground-shadow` (the ground shows the shadows of a light's `shadows`),
 *   `ground-y` (moves the ground up or down, default 0).
 * - `sky` (default on; `"false"` for none), `sky-size` (default 20).
 * - `colour` -- the backdrop's main colour (Babylon's `setMainColor`).
 *
 * `element.helper` is the Babylon `EnvironmentHelper`.
 *
 * @example
 * ```html
 * <garden-environment colour="#808080" ground-shadow></garden-environment>
 * <garden-environment sky="false" ground="false"></garden-environment>
 * ```
 *
 * @category Components
 */
@customElement("garden-environment")
export class GardenEnvironment extends GardenElement {
    helper: EnvironmentHelper;
    private builtIn: any;

    protected unbuild() {
        this.disposeHelper();
        super.unbuild();
    }

    protected dispose() {
        this.disposeHelper();
        super.dispose();
    }

    private disposeHelper() {
        // Removed for good, it's out of the document: the scene it was built in.
        let scene = this.helper && this.builtIn;
        this.helper?.dispose();
        this.helper = null;
        if (scene) scene.environmentTexture = null;
    }

    updated() {
        let scene = this.getScene();
        if (!scene) return;
        let num = (name: string) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
        let on = (name: string) => this.getAttribute(name) != "false";
        let options: any = {
            createGround: on("ground"),
            createSkybox: on("sky"),
            groundSize: num("ground-size"),
            skyboxSize: num("sky-size"),
            enableGroundShadow: this.hasAttribute("ground-shadow") && on("ground-shadow"),
            environmentTexture: this.getAttribute("texture") ?? undefined,
        };
        for (let key in options)
            if (options[key] === undefined) delete options[key];
        this.builtIn = scene;
        this.helper = scene.createDefaultEnvironment(options);
        let colour = this.getAttribute("colour");
        if (colour && this.helper)
            this.helper.setMainColor(Color3.FromHexString(colour));
        let y = num("ground-y");
        if (y && this.helper?.ground)
            this.helper.ground.position.y += y;
    }
}
