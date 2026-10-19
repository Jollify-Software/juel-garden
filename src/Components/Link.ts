import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { ExecuteCodeAction } from "@babylonjs/core/Actions/directActions";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
import { Vector3Convert } from "../Converters/Vector3Convert";
import { GardenElement } from "../GardenElement";
import { GardenMesh } from "../GardenMesh";
import { Navigation } from "../Navigation";
import { createInfoButton } from "./Gui/Button";
import { GardenInfo } from "./Gui/Info";

/**
 * A link -- Juel Garden's equivalent of A-Frame's `link` component. `href`
 * is either another page (a different scene, a website) or `#id` of an
 * element in this scene, which flies the camera there: the way into a shop
 * from a shopping-centre map. Each `#id` jump is a browser history entry, so
 * the back button flies back out, and another page can link straight to
 * `mall.html#shop-12`. In a headset the jump is an instant teleport, and a
 * browser with WebXR navigation keeps the visitor in VR across pages (see
 * {@link GardenWebXR}).
 *
 * Where it goes decides what it looks like:
 *
 * - **On its own** -- a portal: a glowing disc (showing `image`, if given)
 *   with a ring and the `title` above it, turned to face the camera.
 * - **Inside a mesh** (`<garden-box>`, `<garden-plane>`, a room...) -- no
 *   portal; the mesh itself becomes the link, outlined on hover.
 * - **Inside a `<garden-info>`** -- a button on the info card, labelled with
 *   `title` or the element's text.
 *
 * Before following, it dispatches a bubbling, cancelable `garden-navigate`
 * event (`detail.href`) -- call `preventDefault()` to handle it yourself.
 *
 * Attributes: `href`, `target` (a window name, e.g. `"_blank"` or `"_top"`,
 * for page links), `title`, `image`, `radius` (portal size, default 1),
 * `colour` (ring, default white), `highlighted-colour` (on hover, default
 * `#24CAFF`), `title-colour`, `billboard` (`"y"` default, `"all"`, or
 * `"none"` to keep the portal's own `rotation`), and for `#id` links
 * `offset` (added to the target's position, default `"0 1.6 0"` -- eye
 * height above a room's floor), `look-at` (selector or `"x y z"` to face on
 * arrival) and `duration` (flight time in ms, default 1000; 0 jumps).
 *
 * @example
 * ```html
 * <garden-link href="food-court.html" title="Food court" image="food-court.jpg" position="0 1.5 -4"></garden-link>
 *
 * <garden-plane width="3" height="0.6" position="10 3 -2" texture="shop-sign.png">
 *   <garden-link href="#shop-12" look-at="#shop-12-till"></garden-link>
 * </garden-plane>
 *
 * <garden-room id="shop-12" ...>
 *   <garden-info title="Bookshop">
 *     <garden-link href="https://example.com/bookshop" target="_blank">Website</garden-link>
 *   </garden-info>
 * </garden-room>
 * ```
 *
 * @category Components
 */
@customElement("garden-link")
export class GardenLink extends GardenMesh {
    @property() href: string;
    @property() target: string;
    @property() title: string;
    @property() image: string;
    @property({ type: Number }) radius: number = 1;
    @property({ attribute: "title-colour" }) titleColour: string = "white";
    @property() billboard: string = "y";
    @property({ converter: Vector3Convert.fromString }) offset: Vector3;
    @property({ attribute: "look-at" }) lookAt: string;
    @property({ type: Number }) duration: number;

    /** The portal's ring and title, rebuilt with it. */
    private parts: Mesh[] = [];
    private wired = false;

    async updated() {
        let parent = this.parentElement;
        if (parent instanceof GardenInfo) {
            await this.addToInfo(parent);
        } else if (parent instanceof GardenMesh) {
            await this.attachTo(parent);
        } else {
            this.buildPortal();
        }
    }

    /** Follow the link, as a click on it does. */
    follow() {
        if (!this.href)
            return;
        let evt = new CustomEvent("garden-navigate", {
            bubbles: true,
            cancelable: true,
            detail: { href: this.href }
        });
        if (!this.dispatchEvent(evt))
            return;

        if (this.href.startsWith("#")) {
            Navigation.goTo(this.getScene(), this.href, {
                offset: this.offset,
                lookAt: this.lookAt,
                duration: this.duration,
            });
        } else if (this.target && this.target != "_self") {
            window.open(this.href, this.target, this.target == "_blank" ? "noopener" : undefined);
        } else {
            location.assign(this.href);
        }
    }

    private async addToInfo(info: GardenInfo) {
        if (this.wired)
            return;
        this.wired = true;
        // <garden-info>.container is built in its own updated(); see GardenElement.whenDocumentReady.
        await GardenElement.whenDocumentReady();
        let btn = createInfoButton(this.title || this.textContent.trim() || this.href);
        btn.addEventListener("click", () => this.follow());
        info.container.appendChild(btn);
    }

    private async attachTo(owner: GardenMesh) {
        if (this.wired)
            return;
        this.wired = true;
        await GardenElement.whenDocumentReady();
        await owner.whenReady;
        // Some elements (e.g. <garden-canvas>) build their mesh a tick later still.
        if (!owner.mesh)
            await new Promise(resolve => this.getScene().onBeforeRenderObservable.addOnce(resolve));
        let mesh = owner.mesh;
        if (!mesh) {
            console.warn(`<garden-link> inside <${owner.localName}>: that element has no mesh to click.`);
            return;
        }
        let highlight = this.highlightColour();
        this.makeClickable(mesh, hover => {
            mesh.outlineColor = highlight;
            mesh.outlineWidth = 0.03;
            mesh.renderOutline = hover;
        });
    }

    private buildPortal() {
        let scene = this.getScene();
        let name = this.id || "link";
        let r = this.radius;

        for (let part of this.parts)
            part.dispose();
        this.parts = [];

        let disc = MeshBuilder.CreateDisc(`${name}-portal`, {
            radius: r,
            tessellation: 64,
            sideOrientation: Mesh.DOUBLESIDE
        }, scene);
        this.setMesh(disc);

        // Unlit, so the portal reads as a window onto somewhere else rather than a lit object.
        let discMat = new StandardMaterial(`${name}-portal-mat`, scene);
        discMat.disableLighting = true;
        if (this.image) {
            discMat.emissiveTexture = new Texture(this.image, scene);
            discMat.emissiveColor = Color3.White();
        } else {
            discMat.emissiveColor = Color3.FromHexString("#1d3557");
        }
        disc.material = discMat;

        let ringColour = this.colourOf("colour", Color3.White());
        let ringMat = new StandardMaterial(`${name}-ring-mat`, scene);
        ringMat.disableLighting = true;
        ringMat.emissiveColor = ringColour;
        let ring = MeshBuilder.CreateTorus(`${name}-ring`, {
            diameter: r * 2,
            thickness: r * 0.08,
            tessellation: 64
        }, scene);
        ring.rotation.x = Math.PI / 2;
        ring.material = ringMat;
        ring.parent = disc;
        this.parts.push(ring);

        if (this.title)
            this.parts.push(this.buildTitle(disc, name));

        disc.billboardMode = this.billboard == "none" ? Mesh.BILLBOARDMODE_NONE
            : this.billboard == "all" ? Mesh.BILLBOARDMODE_ALL
            : Mesh.BILLBOARDMODE_Y;

        let highlight = this.highlightColour();
        for (let mesh of [disc, ...this.parts]) {
            (<any>mesh).element = this;
            this.makeClickable(mesh, hover => {
                ringMat.emissiveColor = hover ? highlight : ringColour;
            });
        }
    }

    /** The `title` on a transparent plane just above the portal. */
    private buildTitle(disc: Mesh, name: string): Mesh {
        let scene = this.getScene();
        let r = this.radius;
        let width = 1024, height = 128;
        let texture = new DynamicTexture(`${name}-title-tex`, { width, height }, scene, true);
        texture.hasAlpha = true;
        let ctx = texture.getContext() as CanvasRenderingContext2D;
        let size = 72;
        ctx.font = `bold ${size}px sans-serif`;
        while (size > 24 && ctx.measureText(this.title).width > width - 32) {
            size -= 4;
            ctx.font = `bold ${size}px sans-serif`;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.strokeText(this.title, width / 2, height / 2);
        ctx.fillStyle = this.titleColour;
        ctx.fillText(this.title, width / 2, height / 2);
        texture.update();

        let mat = new StandardMaterial(`${name}-title-mat`, scene);
        mat.disableLighting = true;
        mat.emissiveTexture = texture;
        mat.opacityTexture = texture;
        mat.backFaceCulling = false;

        let label = MeshBuilder.CreatePlane(`${name}-title`, {
            width: r * 3,
            height: r * 3 * height / width
        }, scene);
        label.material = mat;
        label.position.y = r * 1.3;
        label.parent = disc;
        return label;
    }

    /** Click (or a controller's trigger, in a headset) follows the link; hover calls `onHover`. */
    private makeClickable(mesh: AbstractMesh, onHover: (hover: boolean) => void) {
        if (!mesh.actionManager)
            mesh.actionManager = new ActionManager(this.getScene());
        mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => this.follow()));
        mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => onHover(true)));
        mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => onHover(false)));
    }

    private highlightColour(): Color3 {
        return this.colourOf("highlighted-colour", Color3.FromHexString("#24CAFF"));
    }

    private colourOf(attribute: string, fallback: Color3): Color3 {
        let value = this.getAttribute(attribute);
        if (!value)
            return fallback;
        if (value.startsWith("#"))
            return Color3.FromHexString(value);
        // A CSS colour name: let the browser resolve it.
        let ctx = document.createElement("canvas").getContext("2d");
        ctx.fillStyle = value;
        return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? Color3.FromHexString(ctx.fillStyle) : fallback;
    }
}
