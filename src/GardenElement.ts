import { Scene, TransformNode, Vector3 } from "babylonjs";
import { LitElement } from "lit";
import {customElement, property} from 'lit/decorators.js';
import { GardenScene } from "./Components/Scene";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { OptionsBuilder } from "./Options/OptionsBuilder";

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

    /** Resolve an element by id and wait for it to be ready, instead of guessing with setTimeout. */
    static async byId<T extends GardenElement = GardenElement>(id: string): Promise<T | null> {
        const el = document.getElementById(id) as T | null;
        if (!el) return null;
        await el.whenReady;
        return el;
    }

    getNode(): TransformNode {
        return this.node;
    }

    getPosition() {
        return this.node?.position;
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