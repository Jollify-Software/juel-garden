import { DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Vector2 } from 'babylonjs';
import { customElement, property } from 'lit/decorators';
import { Vector2Convert } from '../Converters/Vector2Convert';
import { GardenMesh } from "../GardenMesh";

@customElement("garden-canvas")
export class GardenCanvas extends GardenMesh {
    @property() content: string;
    @property() font: string;
    @property() background: string;
    @property() foreground: string;
    @property({ converter: Vector2Convert.fromString }) point: Vector2;
    @property({ converter: Vector2Convert.fromString }) canvas: Vector2;

    fontSize: number;

    constructor() {
        super();
        this.content = "text";
        this.font = "bold 44px monospace";
        this.background = "transparent";
        this.foreground = "red";
        this.point = new Vector2();
        this.canvas = new Vector2(512, 256);
    }

    updated() {
        setTimeout(() => {
        let scene = this.getScene();
        let mesh: Mesh;
        if ('mesh' in this.parentElement) {
            mesh = (<GardenMesh>this.parentElement).mesh;
        } else {
            let options = this.buildOptions();
            options['sideOrientation'] = Mesh.DOUBLESIDE
            this.setMesh(
                MeshBuilder.CreatePlane(this.id ?? "canvas", options, scene)
            );
            mesh = this.mesh;
        }

        let mat: StandardMaterial;
        if (mesh.material) {
            mat = mesh.material as StandardMaterial;
        } else {
            mat = new StandardMaterial('mat', scene);
            mesh.material = mat;
        }
        let canvas = new DynamicTexture('canvas', {
            width: this.canvas.x,
            height: this.canvas.y
        }, scene);
        mat.diffuseTexture = canvas;
        if (this.background == "transparent") {
            canvas.hasAlpha = true;
        }

        let fontParts = this.font.split(' ');
        for (let f of fontParts) {
            if (f.endsWith("px")) {
                this.fontSize = parseFloat(f);
            }
        }

        this.drawOnCanvas(canvas);

        super.updated();
    });
    }

    drawOnCanvas(canvas: DynamicTexture) {
        switch (this.content) {
            case 'text':
                let lines = this.textContent.trim().split('\n');
                let p = this.point;
                p.y =+ 50;
                let colours = this.foreground.split(' ');
                for (var i = 0; i < lines.length; i++) {
                    let txt = lines[i].trim();
                    let clear = i == 0 ? this.background : null;
                    canvas.drawText(txt, p.x + 10, p.y, this.font,
                        colours && colours[i] ? colours[i] : this.foreground, clear, true, true);
                    p.y += this.fontSize;
                }
                break;
            case 'svg':
                var svg = new Blob([this.innerHTML], {type: 'image/svg+xml'});
                var DOMURL = window.URL || window.webkitURL;
                let ctx = canvas.getContext();
                var url = DOMURL.createObjectURL(svg);
                let img = new Image();
                img.onload = () => {
                    if (this.background == "transparent") {
                        ctx.clearRect(0, 0, this.canvas.x, this.canvas.y);
                    } else {
                        ctx.fillStyle = this.background;
                        ctx.fillRect(0, 0, this.canvas.x, this.canvas.y);
                    }
                   ctx.drawImage(img, this.point.x, this.point.y);
                   canvas.update();
                   DOMURL.revokeObjectURL(url);
                }
                img.src = url;
                break;
        }
    }
    
}