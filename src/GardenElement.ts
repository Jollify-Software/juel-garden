import { Scene, TransformNode, Vector3 } from "babylonjs";
import { customElement, LitElement, property } from "lit-element";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { OptionsBuilder } from "./Options/OptionsBuilder";

@customElement("garden-element")
export class GardenElement extends LitElement {
    @property({ converter: Vector3Convert.fromString }) position: Vector3;
    @property({ converter: Vector3Convert.fromString }) rotation: Vector3;
    @property({ converter: Vector3Convert.fromString }) scale: Vector3;

    node: TransformNode;

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

    createRenderRoot() {
        return this;
    }

    updated() {
        this.node = new TransformNode("node", this.getScene());
        (<any>this.node).element = this;
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