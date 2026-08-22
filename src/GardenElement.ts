import { Scene, TransformNode, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import {customElement, property} from 'lit/decorators.js';
import { GardenScene } from "./Components/Scene";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { OptionsBuilder } from "./Options/OptionsBuilder";
import { resolveElements } from "./Utils/resolveElements";

/**
 * Base class every Juel Garden custom element extends, directly or via
 * {@link GardenMesh}. Wraps a plain Babylon `TransformNode` and reads the three
 * attributes common to (almost) everything in the library: `position`,
 * `rotation` (degrees, e.g. `"0 90 0"`) and `scale`.
 *
 * Registered as `<garden-element>` in its own right too -- a plain,
 * mesh-less positioning container, most often used with the `parent`
 * attribute so its children become real Babylon scene-graph children (see
 * {@link GardenMesh.modifyMesh}) instead of each carrying a world-space
 * position by hand.
 *
 * @example
 * ```html
 * <garden-element parent position="0 -1 0">
 *   <garden-box position="-1 0.5 -3" colour="#4CC3D9"></garden-box>
 *   <garden-sphere position="0 1.25 -5" diameter="2.5" colour="#EF2D5E"></garden-sphere>
 * </garden-element>
 * ```
 *
 * @category Core
 */
@customElement("garden-element")
export class GardenElement extends LitElement {
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) rotation: Vector3;
    @property({ converter: Vector3Convert.fromString }) scale: Vector3;

    node: TransformNode;

    private _readyResolve: (() => void) | null = null;
    private _ready: Promise<void> = Promise.resolve();

    /** Resolves once this element's current build (mesh/node construction) has actually finished. */
    get whenReady(): Promise<void> {
        return this._ready;
    }

    /** Call at the start of an updated() that does async work before its mesh/node is usable. */
    protected beginBuild(): void {
        this._ready = new Promise(resolve => { this._readyResolve = resolve; });
    }

    /** Call once the build started by beginBuild() has truly finished. */
    protected endBuild(): void {
        this._readyResolve?.();
        this._readyResolve = null;
    }

    /**
     * Await before reading any child element's build output (a mesh, a material, a
     * texture -- anything only available after that child's own `updated()` has run).
     * Custom elements upgrade and get their first Lit `updated()` call as the parser
     * reaches them, with no ordering guarantee between a parent and a child declared in
     * the same initial markup -- a parent's `updated()` can run before its child's has
     * even started. Waiting for DOMContentLoaded sidesteps that: every element present
     * in the initial document has already been upgraded and had its first `updated()`
     * pass complete by the time that event's listeners run (its dispatch is a task, and
     * the microtasks Lit schedules for each element's first update -- queued while the
     * parser was still running -- have already drained by then). A no-op once the
     * document has already finished loading. Public: Behaviours are plain functions,
     * not GardenElement subclasses, but need this exact same guarantee before
     * resolving a cross-element reference (e.g. BehaviourSuspension's `suspension-terrain`).
     */
    static async whenDocumentReady(): Promise<void> {
        if (document.readyState === 'loading') {
            await new Promise<void>(resolve =>
                document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
            );
        }
    }

    /**
     * Resolve an attribute value naming one or more elements (see resolveElements) and
     * wait for each of them to be ready, instead of guessing with setTimeout. Elements
     * not yet present in the DOM are simply absent from the result -- callers that need
     * to resolve against a still-loading document should await that separately first.
     */
    static async resolveReady<T extends GardenElement = GardenElement>(selector: string, root: ParentNode = document): Promise<T[]> {
        let elements = resolveElements<T>(selector, root);
        await Promise.all(elements.map(el => el.whenReady));
        return elements;
    }

    getNode(): TransformNode {
        return this.node;
    }

    getPosition() {
        return this.node?.getAbsolutePosition().clone();
    }
    getRotation() {
        return this.node?.rotation;
    }
    getScale() {
        return this.node?.scaling;
    }

    setPosition(position: Vector3) {
        this.node.position = position;
    }
    setRotation(rotation: Vector3) {
        this.node.rotation = rotation;
    }
    setScale(scale: Vector3) {
        this.node.scaling = scale;
    }

    getScene(): Scene {
        if ('getScene' in this.parentElement) {
            return (<GardenElement>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    getSceneEl(): GardenScene {
        if ('getSceneEl' in this.parentElement) {
            return (<GardenElement>this.parentElement).getSceneEl();
        } else {
            return null;
        }
    }

    createRenderRoot() {
        return this;
    }

    updated() {
        this.node = new TransformNode(this.id ?? "node", this.getScene());
        (<any>this.node).element = this;
        if (this.position)
            this.node.position = this.position;
        if (this.rotation)
            this.node.rotation = this.rotation;
        if (this.scale)
            this.node.scaling = this.scale;
    }

    update() {
        if (!this.node)
            return;

        if (this.position)
            this.node.position = this.position;
        if (this.rotation)
            this.node.rotation = this.rotation;
        if (this.scale)
            this.node.scaling = this.scale;
    }

    buildOptions(): object {
        return OptionsBuilder.build(this);
    }

    activate() {
        
    }
}