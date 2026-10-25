import { Camera } from "@babylonjs/core/Cameras/camera";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";
import { Fsr1Sharpen, Fsr1Upscale, registerFsr1Shaders } from "../Shaders/Fsr1";

/** AMD's FSR 1 presets: how much smaller the scene is drawn. */
const fsrPresets: { [name: string]: number } = {
    "ultra-quality": 1.3,
    "quality": 1.5,
    "balanced": 1.7,
    "performance": 2,
};

/**
 * The finish on the picture: Babylon's `DefaultRenderingPipeline` on the scene's
 * cameras. Each effect is off unless its attribute is there.
 *
 * Attributes:
 * - `samples` (anti-aliasing samples, e.g. `4`), `fxaa` (cheap anti-aliasing for phones)
 * - `bloom` (glow round bright things; its value is the weight, default 0.15),
 *   `bloom-threshold` (default 0.9: only brighter than this glows), `bloom-kernel` (default 64)
 * - `sharpen` (amount, default 0.3)
 * - `grain` (film grain intensity, default 30), `vignette` (darkened edges, weight, default 1.5)
 * - `chromatic-aberration` (colour fringes, amount, default 30)
 * - `depth-of-field` (the focus distance in scene units: nearer and farther blur),
 *   `focal-length` (default 50), `f-stop` (default 1.4: smaller blurs more)
 * - `tone-mapping` (`aces` or `standard`), `exposure` (default 1), `contrast` (default 1)
 * - `fsr` (AMD's FidelityFX Super Resolution 1, for phones and tablets: the scene is
 *   drawn smaller and upscaled with its edges kept sharp; `ultra-quality` (1.3 times
 *   smaller), `quality` (1.5, the default), `balanced` (1.7), `performance` (2) or a
 *   number), `fsr-sharpness` (stops of sharpening taken off, default 0.2: 0 is the
 *   sharpest), `fsr-samples` (anti-aliasing samples on the small picture, default 4:
 *   FSR exaggerates jagged edges). Needs WebGL2; without it the scene is drawn full size.
 *   Cheaper still and plainer: `<garden-scene scaling="2">` draws everything at half
 *   size and lets the browser stretch it.
 *
 * Attribute changes apply at once. `element.pipeline` is the Babylon pipeline, and
 * `element.fsr` FSR's post-processes (the upscale then the sharpen on each camera).
 *
 * @example
 * ```html
 * <garden-pipeline samples="4" bloom="0.3" vignette tone-mapping="aces"></garden-pipeline>
 * ```
 *
 * @category Components
 */
@customElement("garden-pipeline")
export class GardenPipeline extends GardenElement {
    pipeline: DefaultRenderingPipeline;
    fsr: PostProcess[] = [];
    /** The scale FSR was built for (0 for none): a change rebuilds it. */
    private fsrScale = 0;

    /** Its `updated()` applies later changes in place. */
    protected get handlesChanges() {
        return true;
    }

    async updated() {
        let scene = this.getScene();
        if (!scene)
            return;
        if (this.pipeline) {
            if (this.fsrScale == this.fsrWanted()) {
                this.apply();
                return;
            }
            // FSR comes first in each camera's chain (it takes the scene drawn small): build both again.
            let cameras = this.pipeline.cameras.slice();
            this.disposeAll();
            this.build(cameras);
            return;
        }
        // The camera may come after this element in the markup.
        await GardenElement.whenDocumentReady();
        if (!scene.activeCamera)
            await new Promise<void>(resolve => scene.onActiveCameraChanged.addOnce(() => resolve()));
        if (this.pipeline || !this.getScene())
            return; // built by a later update while this one waited, or removed
        this.build(scene.cameras.slice());
    }

    private build(cameras: Camera[]) {
        this.buildFsr(cameras);
        this.pipeline = new DefaultRenderingPipeline(this.id || "pipeline", true, this.getScene(), cameras);
        this.apply();
    }

    /** `fsr` as a scale (how much smaller the scene is drawn), or 0 for none. */
    private fsrWanted(): number {
        if (!this.hasAttribute("fsr"))
            return 0;
        let value = (this.getAttribute("fsr") || "quality").trim().toLowerCase();
        let scale = fsrPresets[value] ?? Number(value);
        return scale > 1 ? scale : 0;
    }

    /**
     * `fsr`: on each camera, the EASU upscale (drawn at 1 / scale, so the scene is drawn that
     * small into it) and the RCAS sharpen after it, as Babylon 9's FSR1RenderingPipeline.
     */
    private buildFsr(cameras: Camera[]) {
        let scale = this.fsrWanted();
        let engine = this.getScene().getEngine();
        this.fsrScale = scale;
        if (!scale)
            return;
        if (engine.version < 2) {
            console.warn("<garden-pipeline fsr> needs WebGL2: drawing full size.");
            return;
        }
        registerFsr1Shaders();
        for (let camera of cameras) {
            let upscale = new PostProcess("fsr1Upscale", Fsr1Upscale, ["con0", "con1", "con2", "con3"], null, 1 / scale,
                camera, Texture.BILINEAR_SAMPLINGMODE, engine, false);
            upscale.samples = Math.max(1, this.number("fsr-samples", 4));
            upscale.onApplyObservable.add(effect => {
                // FsrEasuCon from FSR 1: the input (this post-process's size) against the output (the canvas).
                let inW = 1 / upscale.width, inH = 1 / upscale.height;
                let outW = engine.getRenderWidth(), outH = engine.getRenderHeight();
                effect.setFloat4("con0", upscale.width / outW, upscale.height / outH, 0.5 * upscale.width / outW - 0.5, 0.5 * upscale.height / outH - 0.5);
                effect.setFloat4("con1", inW, inH, inW, -inH);
                effect.setFloat4("con2", -inW, 2 * inH, inW, 2 * inH);
                effect.setFloat4("con3", 0, 4 * inH, 0, 0);
            });
            let sharpen = new PostProcess("fsr1Sharpen", Fsr1Sharpen, ["con"], null, 1,
                camera, Texture.BILINEAR_SAMPLINGMODE, engine, false);
            // FsrRcasCon: sharpness in stops, read live.
            sharpen.onApplyObservable.add(effect => effect.setFloat4("con", Math.pow(2, -this.number("fsr-sharpness", 0.2)), 0, 0, 0));
            this.fsr.push(upscale, sharpen);
        }
    }

    private number(name: string, fallback: number): number {
        let value = Number(this.getAttribute(name));
        return this.getAttribute(name) && Number.isFinite(value) ? value : fallback;
    }

    private apply() {
        for (let i = 0; i < this.fsr.length; i += 2)
            this.fsr[i].samples = Math.max(1, this.number("fsr-samples", 4));
        let p = this.pipeline;
        let has = (name: string) => this.hasAttribute(name);
        p.samples = Math.max(1, this.number("samples", 1));
        p.fxaaEnabled = has("fxaa");
        p.bloomEnabled = has("bloom");
        if (p.bloomEnabled) {
            p.bloomWeight = this.number("bloom", 0.15);
            p.bloomThreshold = this.number("bloom-threshold", 0.9);
            p.bloomKernel = this.number("bloom-kernel", 64);
        }
        p.sharpenEnabled = has("sharpen");
        if (p.sharpenEnabled)
            p.sharpen.edgeAmount = this.number("sharpen", 0.3);
        p.grainEnabled = has("grain");
        if (p.grainEnabled)
            p.grain.intensity = this.number("grain", 30);
        p.chromaticAberrationEnabled = has("chromatic-aberration");
        if (p.chromaticAberrationEnabled)
            p.chromaticAberration.aberrationAmount = this.number("chromatic-aberration", 30);
        p.depthOfFieldEnabled = has("depth-of-field");
        if (p.depthOfFieldEnabled) {
            p.depthOfField.focusDistance = this.number("depth-of-field", 10) * 1000; // Babylon wants millimetres
            p.depthOfField.focalLength = this.number("focal-length", 50);
            p.depthOfField.fStop = this.number("f-stop", 1.4);
        }
        let processing = has("vignette") || has("tone-mapping") || has("exposure") || has("contrast");
        p.imageProcessingEnabled = processing;
        if (processing) {
            let ip = p.imageProcessing;
            ip.vignetteEnabled = has("vignette");
            if (ip.vignetteEnabled)
                ip.vignetteWeight = this.number("vignette", 1.5);
            let tone = this.getAttribute("tone-mapping")?.toLowerCase();
            ip.toneMappingEnabled = !!tone;
            if (tone)
                ip.toneMappingType = tone == "aces" ? ImageProcessingConfiguration.TONEMAPPING_ACES : ImageProcessingConfiguration.TONEMAPPING_STANDARD;
            ip.exposure = this.number("exposure", 1);
            ip.contrast = this.number("contrast", 1);
        }
    }

    private disposeAll() {
        this.pipeline?.dispose();
        this.pipeline = null;
        for (let pp of this.fsr)
            pp.dispose();
        this.fsr = [];
        this.fsrScale = 0;
    }

    protected dispose() {
        this.disposeAll();
        super.dispose();
    }
}
