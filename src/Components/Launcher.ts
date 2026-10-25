import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";

/**
 * Throws things where you point: each tap or click on the scene (or, in VR, each
 * pull of a controller's trigger) adds a copy of the launcher's `<template>` -- a ball,
 * a dart, a snowball -- at the start of the pointer's ray and sends it along the ray.
 * The copy is an ordinary element (put in the scene, after the launcher), so with
 * `physics` it flies, bounces and fires `garden-collide` like any other body.
 *
 * Attributes: `speed` (m/s along the ray, default 20; the copy's `velocity`),
 * `offset` (how far along the ray it starts, default 0.2 m: clear of the camera or
 * hand), `max` (how many copies stay; the oldest goes when another is thrown, default
 * 20), `hand` (in VR: `right` or `left` throws only from that hand's controller;
 * default any), `disabled`.
 *
 * Fires **`garden-launch`** on the launcher (it bubbles), `detail: { element }` the
 * copy. {@link fire} throws from code, {@link clear} removes them all, and
 * `element.launched` lists them.
 *
 * @example
 * ```html
 * <garden-launcher speed="40" max="10">
 *   <template><garden-sphere diameter="0.2" colour="#ff8800" physics mass="3"></garden-sphere></template>
 * </garden-launcher>
 * ```
 *
 * @category Components
 */
@customElement("garden-launcher")
export class GardenLauncher extends GardenElement {
    @property({ type: Number }) speed: number;
    @property({ type: Number }) offset: number;
    @property({ type: Number }) max: number;
    @property() hand: string;

    /** The copies thrown, oldest first. */
    launched: HTMLElement[] = [];

    /** Its `updated()` handles later changes in place: the attributes are read on each throw. */
    protected get handlesChanges() {
        return true;
    }

    private listening = false;

    updated() {
        if (this.listening)
            return;
        let scene = this.getScene();
        if (!scene)
            return;
        this.listening = true;
        this.observe(scene.onPointerObservable, info => {
            if (this.hasAttribute("disabled"))
                return;
            let evt = info.event as PointerEvent;
            if (this.hand && this.hand != "any") {
                // In VR, the hand that pulled the trigger (the mouse and touch count as any hand).
                let xr: any = this.getSceneEl()?.querySelector("garden-webxr");
                let controller = xr?.xr?.pointerSelection?.getXRControllerByPointerId?.(evt?.pointerId);
                let handedness = controller?.motionController?.handedness ?? controller?.inputSource?.handedness;
                if (handedness && handedness != this.hand)
                    return;
            }
            let ray: Ray = info.pickInfo?.ray;
            if (!ray) {
                let camera = scene.cameraToUseForPointers ?? scene.activeCamera;
                if (!camera) return;
                ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);
            }
            this.fire(ray.origin, ray.direction);
        }, PointerEventTypes.POINTERTAP);
        this.whenDisposed(() => this.listening = false);
    }

    /** Throws one copy of the template from `origin` along `direction` (world space). Returns the copy. */
    fire(origin: Vector3, direction: Vector3): HTMLElement | null {
        let template = this.querySelector("template");
        let source = template?.content.firstElementChild;
        if (!source) {
            console.warn("<garden-launcher> needs a <template> with the element to throw.");
            return null;
        }
        let dir = direction.normalizeToNew();
        let start = origin.add(dir.scale(this.offset ?? 0.2));
        let copy = source.cloneNode(true) as HTMLElement;
        let text = (v: Vector3) => `${v.x} ${v.y} ${v.z}`;
        copy.setAttribute("position", text(start));
        copy.setAttribute("velocity", text(dir.scale(this.speed ?? 20)));
        this.after(copy);
        this.launched.push(copy);
        let max = this.max ?? 20;
        while (this.launched.length > Math.max(1, max))
            this.launched.shift().remove();
        this.dispatchEvent(new CustomEvent("garden-launch", { bubbles: true, detail: { element: copy } }));
        return copy;
    }

    /** Removes every copy thrown. */
    clear() {
        for (let copy of this.launched.splice(0))
            copy.remove();
    }

    protected dispose() {
        this.clear();
        super.dispose();
    }
}
