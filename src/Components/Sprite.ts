import { Sprite, SpriteManager } from "babylonjs";
import { customElement, property } from "lit-element";
import { GardenElement } from "../GardenElement";

@customElement("garden-sprite")
export class GardenSprite extends GardenElement {
    @property({ type: Number }) capacity: number;
    @property() url: string;
    @property({ type: Number }) count: number;
    @property() positions: string;

    updated() {
        let scene = this.getScene();
        const spriteManagerTrees = new SpriteManager("treesManager", this.url, this.capacity, this.buildOptions(), scene);

        let posGroups = this.positions.split(',').map(x => x.trim());
        for (var g=0;g<posGroups.length;g++) {
            for (var i=0;i<this.count;i++) {
                let ray = posGroups[g].split(' ').map(x => {
                    if (x.indexOf('(') >= 0) {
                        return (new Function('Math', `return ${x}`))(Math) as number;
                    } else {
                        return Number(x);
                    }
                });
                
                const tree = new Sprite("tree", spriteManagerTrees);
                tree.position.x = ray[0];
                tree.position.y = ray[1];
                tree.position.z = ray[2];
                
            }
        }
    }
}