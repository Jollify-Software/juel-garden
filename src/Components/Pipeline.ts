import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { customElement } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";

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
 *
 * Attribute changes apply at once. `element.pipeline` is the Babylon pipeline.
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

    /** Its `updated()` applies later changes in place. */
    protected get handlesChanges() {
        return true;
    }

    async updated() {
        let scene = this.getScene();
        if (!scene)
            return;
        if (this.pipeline) {
            this.apply();
            return;
        }
        // The camera may come after this element in the markup.
        await GardenElement.whenDocumentReady();
        if (!scene.activeCamera)
            await new Promise<void>(resolve => scene.onActiveCameraChanged.addOnce(() => resolve()));
        this.pipeline = new DefaultRenderingPipeline(this.id || "pipeline", true, scene, scene.cameras.slice());
        this.apply();
    }

    private number(name: string, fallback: number): number {
        let value = Number(this.getAttribute(name));
        return this.getAttribute(name) && Number.isFinite(value) ? value : fallback;
    }

    private apply() {
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

    protected dispose() {
        this.pipeline?.dispose();
        this.pipeline = null;
        super.dispose();
    }
}
