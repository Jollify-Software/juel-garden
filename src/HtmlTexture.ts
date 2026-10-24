import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import html2canvas from "html2canvas";
import { GardenElement } from "./GardenElement";
import type { GardenMesh } from "./GardenMesh";

/** What an element's HTML texture is drawn from: its first light-DOM child, parked in a host under `<body>`. */
interface HtmlSource {
    host: HTMLDivElement;
    content: HTMLElement;
}

/**
 * Rasterises a mesh's own light-DOM content (its first child element) into a
 * `DynamicTexture` via `html2canvas`, for `texture="html"` (see
 * {@link ModifyTextureSetter}): the element's inner HTML, styled by the page's
 * CSS, becomes the mesh's surface.
 *
 * The child is moved out of the scene (where it would push the canvas down) into a
 * hidden host `<div class="garden-html-host">` at the top of `<body>`, so it stays in
 * the document: page stylesheets apply to it as to any element (selectors that go
 * through the mesh element itself, `garden-plane > div`, no longer match), scripts can
 * still find it, and any change to it (text, children, attributes) draws the texture
 * again after a short debounce. {@link render} (or the element's
 * {@link GardenMesh.renderHtml}) draws it again on demand, after a stylesheet change say.
 * Appending a new first child to the mesh element replaces the content. When the
 * element is removed for good, the content goes back inside it.
 *
 * Attributes on the mesh element:
 * - `html-size` -- `"width height"` in CSS pixels: the box the content is laid out in
 *   (it can fill it with `width: 100%; height: 100%`). Without it, the content's own size.
 * - `html-resolution` -- texture pixels per CSS pixel (default 1.5, at most 4). The
 *   texture is that size rounded to a power of two (shrunk by up to a quarter rather
 *   than doubled), at most `html-max-size` (default 2048) a side, with mipmaps and
 *   anisotropic filtering, so text stays sharp up close and doesn't shimmer far away.
 * - `html-background` -- the colour behind the content (default white, as before);
 *   `transparent` keeps the uncovered parts see-through (rounded corners, a cut-out
 *   shape), blended with the scene.
 * - `html-unlit` -- the surface ignores the scene's lights, so the content shows in its
 *   own colours whichever way it faces (a sign, a slide panel).
 *
 * The element fires `garden-html-rendered` (detail `{ width, height }`, the texture's
 * size) after each draw. Draws are queued one at a time across the page, so a scene
 * with many panels doesn't stall on all of them at once.
 *
 * @category Core
 */
export class HtmlTexture {
    texture: DynamicTexture;

    private static sources = new WeakMap<HTMLElement, HtmlSource>();
    private static current = new WeakMap<HTMLElement, HtmlTexture>();
    private static queue: Promise<void> = Promise.resolve();

    /** The default `html-resolution`. */
    static defaultResolution = 1.5;
    /** The default `html-max-size`. */
    static defaultMaxSize = 2048;

    private observer: MutationObserver;
    private childObserver: MutationObserver;
    private timer: number;
    private disposed = false;

    constructor(private element: GardenMesh, private prefix: string = "diffuse") {
        HtmlTexture.current.get(element)?.stop();
        HtmlTexture.current.set(element, this);
        let scene = element.getScene();
        this.texture = new DynamicTexture("HtmlTexture", { width: 4, height: 4 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
        this.texture.anisotropicFilteringLevel = 8;
        if (this.transparent) {
            this.texture.hasAlpha = true;
            this.texture.getContext().clearRect(0, 0, 4, 4);
            this.texture.update();
        }
        element.whenDisposed(() => this.stop());

        setTimeout(async () => {
            // A plain setTimeout(0) isn't a reliable guarantee that the parser has
            // even attached this element's own light-DOM children yet -- same
            // ordering hazard as everywhere else that reads another element's build
            // output, see GardenElement.whenDocumentReady.
            await GardenElement.whenDocumentReady();
            if (this.disposed)
                return;
            this.adopt();
            this.childObserver = new MutationObserver(() => {
                if (this.adopt())
                    this.schedule();
            });
            this.childObserver.observe(element, { childList: true });
            this.render();
        });
    }

    /** True with `html-background="transparent"`. */
    private get transparent() {
        return (this.element.getAttribute("html-background") ?? "").trim().toLowerCase() == "transparent";
    }

    /**
     * Takes the element's first non-`garden-*` child element as the content (moving it
     * into the host), if it has one; true when that changed the content.
     */
    private adopt(): boolean {
        let child = Array.from(this.element.children).find(c => !c.tagName.startsWith("GARDEN")) as HTMLElement;
        let source = HtmlTexture.sources.get(this.element);
        if (!child)
            return false;
        if (!source) {
            let host = document.createElement("div");
            host.className = "garden-html-host";
            Object.assign(host.style, {
                position: "fixed", left: "0", top: "0", zIndex: "-1",
                visibility: "hidden", pointerEvents: "none", overflow: "hidden",
            });
            document.body.prepend(host);
            source = { host, content: child };
            HtmlTexture.sources.set(this.element, source);
        } else {
            source.content.remove();
            source.content = child;
        }
        source.host.appendChild(child);
        this.observer?.disconnect();
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(child, { childList: true, subtree: true, characterData: true, attributes: true });
        return true;
    }

    private schedule() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.render(), 50) as unknown as number;
    }

    /** Draws the content into the texture again; resolves when it's on the surface (or there's nothing to draw). */
    render(): Promise<void> {
        let run = HtmlTexture.queue.then(() => this.draw()).catch(e => console.warn("texture=\"html\":", e));
        HtmlTexture.queue = run;
        return run;
    }

    private async draw() {
        let source = HtmlTexture.sources.get(this.element);
        if (this.disposed || !source)
            return;
        let { host } = source;
        let size = (this.element.getAttribute("html-size") ?? "").trim().split(/[\s,]+/).map(Number);
        if (size.length == 2 && size.every(n => n > 0)) {
            host.style.width = `${size[0]}px`;
            host.style.height = `${size[1]}px`;
        } else {
            host.style.width = host.style.height = "";
            host.style.display = "inline-block";
        }
        await document.fonts?.ready;
        let box = host.getBoundingClientRect();
        let width = Math.max(1, Math.ceil(box.width)), height = Math.max(1, Math.ceil(box.height));

        let resolution = Number(this.element.getAttribute("html-resolution"));
        resolution = resolution > 0 ? Math.min(resolution, 4) : HtmlTexture.defaultResolution;
        let maxSize = Number(this.element.getAttribute("html-max-size"));
        maxSize = maxSize > 0 ? maxSize : HtmlTexture.defaultMaxSize;
        let textureWidth = HtmlTexture.powerOfTwo(width * resolution, maxSize);
        let textureHeight = HtmlTexture.powerOfTwo(height * resolution, maxSize);
        // Captured at least as fine as the texture in both directions, then fitted to it.
        let scale = Math.max(textureWidth / width, textureHeight / height);

        let background = this.element.getAttribute("html-background");
        let transparent = this.transparent;
        let canvas = await html2canvas(host, {
            backgroundColor: transparent ? null : (background || "#ffffff"),
            scale,
            width,
            height,
            logging: false,
            useCORS: true,
            // Leave the scene (and its WebGL canvas) out of html2canvas's clone of the page.
            ignoreElements: el => el.tagName.startsWith("GARDEN"),
            onclone: (_doc, clone) => { clone.style.visibility = "visible"; },
        });
        if (this.disposed)
            return;

        let current = this.texture.getSize();
        if (current.width != textureWidth || current.height != textureHeight)
            this.texture.scaleTo(textureWidth, textureHeight);
        let ctx = this.texture.getContext();
        ctx.clearRect(0, 0, textureWidth, textureHeight);
        ctx.drawImage(canvas, 0, 0, textureWidth, textureHeight);
        this.texture.hasAlpha = transparent;
        this.texture.update(true, false, true);
        this.applyMaterial(transparent);
        this.element.dispatchEvent(new CustomEvent("garden-html-rendered", { detail: { width: textureWidth, height: textureHeight } }));
    }

    /** The diffuse texture's alpha and lighting, on the material wearing it. */
    private applyMaterial(transparent: boolean) {
        if (this.prefix != "diffuse")
            return;
        let material = this.element.getMaterial() as StandardMaterial;
        if (!material || material.diffuseTexture != this.texture)
            return;
        material.useAlphaFromDiffuseTexture = transparent;
        if (this.element.hasAttribute("html-unlit")) {
            // Unlit, a StandardMaterial is emissive × the diffuse texture: white shows the content
            // in its own colours. (The texture as emissiveTexture instead darkens the mid-tones.)
            material.disableLighting = true;
            material.emissiveColor = Color3.White();
        }
    }

    /**
     * `n` rounded to a power of two, at most `max`: down when that loses no more than a
     * quarter (1280 → 1024), else up (1440 → 2048).
     */
    static powerOfTwo(n: number, max: number = HtmlTexture.defaultMaxSize): number {
        let up = 1;
        while (up < n) up *= 2;
        let down = Math.max(1, up / 2);
        let pick = n <= down * 4 / 3 ? down : up;
        let limit = 1;
        while (limit * 2 <= max) limit *= 2;
        return Math.max(1, Math.min(pick, limit));
    }

    /** Stops watching; when the element has left the page for good, its content goes back inside it. */
    private stop() {
        if (this.disposed)
            return;
        this.disposed = true;
        clearTimeout(this.timer);
        this.observer?.disconnect();
        this.childObserver?.disconnect();
        if (HtmlTexture.current.get(this.element) == this)
            HtmlTexture.current.delete(this.element);
        // whenDisposed runs on a rebuild too: the content stays in its host for the next texture.
        queueMicrotask(() => {
            if (this.element.isConnected || HtmlTexture.current.has(this.element))
                return;
            let source = HtmlTexture.sources.get(this.element);
            if (!source)
                return;
            HtmlTexture.sources.delete(this.element);
            this.element.prepend(source.content);
            source.host.remove();
        });
    }

    /** The texture `element` wears from `texture="html"` now, if any. */
    static of(element: HTMLElement): HtmlTexture | undefined {
        return HtmlTexture.current.get(element);
    }
}
