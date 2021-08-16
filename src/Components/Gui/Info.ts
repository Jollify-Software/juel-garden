import { DynamicTexture, MorphTargetsBlock, Observer } from "babylonjs";
import { AdvancedDynamicTexture, Button, Control, Ellipse, Grid, Line, Rectangle, ScrollViewer, TextBlock, Vector2WithInfo } from "babylonjs-gui";
import { customElement } from "lit/decorators";
import { GardenElement } from "../../GardenElement";
import { GardenMesh } from "../../GardenMesh";

@customElement("garden-info")
export class GardenInfo extends GardenElement {
    advTexture: AdvancedDynamicTexture

    info: Rectangle;
    target: Ellipse;
    line: Line;
    closeObserver: Observer<Vector2WithInfo>;

    container: Rectangle;

    updated() {
        let scene = this.getScene();
        this.advTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");

        this.info = new Rectangle();
        this.info.width = "25%";
        //rect1.adaptWidthToChildren = true;
        //rect1.adaptHeightToChildren = true;
        this.info.height = "40%";
        this.info.cornerRadius = 20;
        this.info.color = "Orange";
        this.info.thickness = 4;
        this.info.background = "green";
        this.advTexture.addControl(this.info);
        this.info.linkWithMesh(
            (<GardenMesh>this.parentElement).mesh
        );
        this.info.linkOffsetY = -150;

        let mainGrid = new Grid();
        mainGrid.width = "100%";
        mainGrid.height = "100%";
        mainGrid.addRowDefinition(0.10);
        mainGrid.addRowDefinition(0.90);
        this.info.addControl(mainGrid);

        let header = new Grid();
        header.addColumnDefinition(0.90);
        header.addColumnDefinition(0.10);
        mainGrid.addControl(header);

        let title = new TextBlock();
        title.text = this.title;
        header.addControl(title);

        let close = Button.CreateSimpleButton("closeBtn", "✖");
        if (!this.closeObserver) {
            this.closeObserver = close.onPointerClickObservable.add((evt) => {
                this.hide();
            });
        }
        header.addControl(close, 0, 1);

        let sv = new ScrollViewer();
        mainGrid.addControl(sv, 1, 0);

        this.container = sv;

        /*
        var label = new TextBlock();
        label.text = this.innerHTML;
        //label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        label.textWrapping = true;
        label.resizeToFit = true;
        rect1.addControl(label);
        */

        this.target = new Ellipse();
        this.target.width = "40px";
        this.target.height = "40px";
        this.target.color = "Orange";
        this.target.thickness = 4;
        this.target.background = "green";
        this.target.zIndex = -1;
        this.advTexture.addControl(this.target);
        this.target.linkWithMesh(
            (<GardenMesh>this.parentElement).mesh
        );

        this.line = new Line();
        this.line.lineWidth = 4;
        this.line.color = "Orange";
        this.line.y2 = 20;
        this.line.linkOffsetY = -20;
        this.line.zIndex = -1;
        this.advTexture.addControl(this.line);
        this.line.linkWithMesh(
            (<GardenMesh>this.parentElement).mesh
        );
        this.line.connectedControl = this.info;

        this.hide();

        (<GardenMesh>this.parentElement).activate = () => {
            this.show();
        }
    }

    show() {
        this.info.isVisible = true;
        this.line.isVisible = true;
        this.target.isVisible = true;
    }

    hide() {
        this.info.isVisible = false;
        this.line.isVisible = false;
        this.target.isVisible = false;
    }

}