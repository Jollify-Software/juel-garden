import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable, Observer } from "@babylonjs/core/Misc/observable";
import { LitElement } from "lit";
import {customElement, property} from 'lit/decorators.js';
import { GardenScene } from "./Components/Scene";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { OptionsBuilder } from "./Options/OptionsBuilder";
import { resolveElements } from "./Utils/resolveElements";
import { BehaviourNear } from "./Behaviours/BehaviourNear";

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

    /**
     * The first element `selector` names, once it's ready, for when it may not be in the DOM
     * yet (a game adding its characters one by one): keeps looking every quarter of a second
     * for up to `timeout` ms, then gives null.
     */
    static async resolveEventually<T extends GardenElement = GardenElement>(selector: string, timeout = 30000, root: ParentNode = document): Promise<T | null> {
        let start = performance.now();
        for (;;) {
            let [el] = resolveElements<T>(selector, root);
            if (el) {
                await el.whenReady;
                return el;
            }
            if (performance.now() - start > timeout)
                return null;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
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

    /** The scene this element is in; null once it's removed (a queued update can still run then). */
    getScene(): Scene {
        if (this.parentElement && 'getScene' in this.parentElement) {
            return (<GardenElement>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    getSceneEl(): GardenScene {
        if (this.parentElement && 'getSceneEl' in this.parentElement) {
            return (<GardenElement>this.parentElement).getSceneEl();
        } else {
            return null;
        }
    }

    createRenderRoot() {
        return this;
    }

    private skippedFirstBuild = false;
    /** Removed after building; disposal runs in a microtask unless it's added back first (a move). */
    private disposeQueued = false;
    /** Its build was disposed (removed for good); adding it back rebuilds it. */
    private disposed = false;
    private builtUnder: Element = null;
    private disposers: (() => void)[] = [];
    /** A change came while it was out of the document; it's applied when it's back. */
    private changedWhileAway = false;

    /**
     * Attributes that aren't Lit properties (`colour`, `texture`, `physics`, `track`...) are
     * read straight from the element, so one observer for all elements turns their changes
     * into updates as well.
     */
    private static attributeWatcher = new MutationObserver(records => {
        for (let record of records) {
            let el = record.target as GardenElement;
            let name = record.attributeName;
            if (GardenElement.ignoredAttribute.test(name) ||
                (<any>el.constructor).observedAttributes?.includes(name))
                continue;
            el.requestUpdate(name, record.oldValue);
        }
    });
    private static ignoredAttribute = /^(id|class|style|slot|data-.*|aria-.*)$/;
    private static transformKeys = new Set<PropertyKey>(["position", "rotation", "scale"]);

    /**
     * True for an element whose `updated()` handles later changes itself (a light's
     * `intensity` set from code updates the light in place). Otherwise a change rebuilds
     * the element: {@link unbuild}, then `updated()` again.
     */
    protected get handlesChanges(): boolean {
        return false;
    }

    /**
     * True when a change of `position`, `rotation` or `scale` alone only needs
     * {@link applyTransform}, not a rebuild: a plain `<garden-element>` and the meshes.
     */
    protected get transformsInPlace(): boolean {
        return this.constructor == GardenElement;
    }

    /**
     * Skips the first build if the element was removed before it ran (added and
     * removed in one task): with no parent there is no scene, and a subclass's
     * `updated()` would build into the wrong scene or throw. Re-adding the
     * element builds it then.
     */
    protected shouldUpdate(changed: Map<PropertyKey, unknown>): boolean {
        if (!this.hasUpdated) {
            if (this.isConnected)
                return true;
            this.skippedFirstBuild = true;
            return false;
        }
        if (!this.isConnected) {
            // Applied on a move back in; a rebuild after disposal reads everything anyway.
            this.changedWhileAway = true;
            return false;
        }
        if (this.handlesChanges)
            return true;
        if (changed.size && this.transformsInPlace &&
            [...changed.keys()].every(key => GardenElement.transformKeys.has(key))) {
            this.applyTransform();
            return false;
        }
        return true;
    }

    /** Before a rebuild for a change (not the first build): see {@link unbuild}. */
    protected willUpdate(_changed: Map<PropertyKey, unknown>) {
        if (this.hasUpdated && !this.handlesChanges)
            this.unbuild();
    }

    /**
     * Gets ready for `updated()` to build again after a change: behaviours and other
     * {@link whenDisposed} work stop (the build re-applies them). Keeps the node, so
     * children parented to it stay; an override drops what its own `updated()` would
     * otherwise build a second time, and calls `super.unbuild()`.
     */
    protected unbuild() {
        for (let disposer of this.disposers.splice(0))
            disposer();
    }

    /** `position`, `rotation` and `scale` onto what the element built, without rebuilding it. */
    applyTransform() {
        this.transformNode();
    }

    /**
     * The element's own node only. The build calls this, not {@link applyTransform}: a mesh's
     * `updated()` calls `super.updated()` after its behaviours have placed the mesh (an
     * `orbit` re-parents it), and moving the mesh again there would undo that.
     */
    private transformNode() {
        if (!this.node)
            return;
        if (this.position)
            this.node.position = this.position;
        if (this.rotation)
            this.node.rotation = this.rotation;
        if (this.scale)
            this.node.scaling = this.scale;
    }

    /**
     * Moving an element (removing it and adding it back in the same task, as `appendChild`
     * and `insertBefore` do) keeps its build; under a new parent it calls {@link moved}.
     * Added back after its build was disposed, it builds again.
     */
    connectedCallback() {
        super.connectedCallback();
        if (this.skippedFirstBuild) {
            this.skippedFirstBuild = false;
            this.requestUpdate();
        } else if (this.disposeQueued) {
            this.disposeQueued = false;
            if (this.parentElement != this.builtUnder)
                this.moved();
            if (this.changedWhileAway)
                this.requestUpdate();
        } else if (this.disposed) {
            this.disposed = false;
            this.rebuild();
        }
        this.changedWhileAway = false;
        this.builtUnder = this.parentElement;
        GardenElement.attributeWatcher.observe(this, { attributes: true, attributeOldValue: true });
    }

    /**
     * Disposal waits a microtask, so a move keeps everything; once it runs, the element's
     * Babylon objects have left the scene (see {@link dispose}).
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        if (!this.hasUpdated || this.disposeQueued)
            return;
        this.disposeQueued = true;
        queueMicrotask(() => {
            if (!this.disposeQueued)
                return;
            this.disposeQueued = false;
            this.disposed = true;
            this.dispose();
        });
    }

    /**
     * Removes what the element built from the scene, after it was removed for good. An
     * override disposes its own objects and calls `super.dispose()`, and leaves the element
     * ready for {@link rebuild}.
     */
    protected dispose() {
        for (let disposer of this.disposers.splice(0))
            disposer();
        if (this.node && !this.node.isDisposed())
            this.node.dispose();
        this.node = null;
    }

    /** Builds again, after {@link dispose}, when the element is added back. */
    protected rebuild() {
        this.updated(new Map());
    }

    /**
     * Moved to a different parent with its build kept. `GardenMesh` re-parents its mesh;
     * an element whose geometry depends on where it sits overrides this to rebuild.
     */
    protected moved() {
    }

    /** Runs `disposer` when the element's build is disposed (see {@link dispose}). */
    whenDisposed(disposer: () => void) {
        this.disposers.push(disposer);
    }

    /** Adds `callback` to `observable` (for the events in `mask`) until the element's build is disposed: behaviours' per-frame work. */
    observe<T>(observable: Observable<T>, callback: (data: T) => void, mask?: number): Observer<T> {
        let observer = observable.add(callback, mask);
        this.whenDisposed(() => observable.remove(observer));
        return observer;
    }

    updated(_changed?: Map<PropertyKey, unknown>) {
        if (!this.node) {
            this.node = new TransformNode(this.id || "node", this.getScene());
            (<any>this.node).element = this;
        }
        this.transformNode();
        // A plain <garden-element near="..."> is a proximity point (meshes get it through Behaviours).
        if (this.hasAttribute("near"))
            BehaviourNear(this, this.node);
    }

    buildOptions(): object {
        return OptionsBuilder.build(this);
    }

    activate() {
        
    }
}