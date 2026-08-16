import { Color3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";
import { createDomeRoof } from "../../Utils/Mesh/createDomeRoof";
import { ColorConverter, GardenRoom } from "./Room";

@customElement("garden-roof")
export class GardenRoof extends GardenMesh {
    @property() type: string;
    @property({ type: Number }) thickness: number;

    // Only used by type="dome" -- the flat roof keeps using the generic colour/texture
    // attributes (applied later by the base class), since it only has one visible face.
    @property({ attribute: "outside-colour", converter: ColorConverter }) outsideColour: Color3;
    @property({ attribute: "outside-texture" }) outsideTexture: string;
    @property({ attribute: "inside-colour", converter: ColorConverter }) insideColour: Color3;
    @property({ attribute: "inside-texture" }) insideTexture: string;

    // Only used by type="dome" -- a supplemental light scoped to just the dome mesh (see
    // the "dome" case below), disposed and recreated whenever the roof rebuilds.
    private insideLight: HemisphericLight;

    constructor() {
        super();
        this.type = "flat";
    }

    async updated() {
        let room = this.parentElement;
        if (!(room instanceof GardenRoom)) {
            console.warn("<garden-roof> must be a child of <garden-room>.");
            return;
        }

        if (this.insideLight) {
            this.insideLight.dispose();
            this.insideLight = null;
        }

        this.beginBuild();
        try {
            await room.whenReady;

            let scene = this.getScene();
            let thickness = this.thickness ?? room.thickness;
            let mesh: Mesh;

            switch (this.type) {
                case "dome": {
                    let outsideMaterial = new StandardMaterial("roof-outside", scene);
                    if (this.outsideColour)
                        outsideMaterial.diffuseColor = this.outsideColour;
                    if (this.outsideTexture)
                        outsideMaterial.diffuseTexture = new Texture(this.outsideTexture, scene);

                    // Normally lit (not disableLighting -- StandardMaterial's disableLighting
                    // skips the light loop entirely, which leaves diffuseColor/diffuseTexture
                    // permanently zeroed out regardless of their value, not just "unshaded").
                    let insideMaterial = new StandardMaterial("roof-inside", scene);
                    insideMaterial.diffuseColor = this.insideColour ?? Color3.White();
                    if (this.insideTexture) {
                        // The sphere builder's V=0 lands at the apex (top of the source image)
                        // and V=1 at the rim, but Babylon's texture-space V is flipped relative
                        // to image row order, so an un-adjusted mapping renders upside down.
                        let insideTexture = new Texture(this.insideTexture, scene);
                        insideTexture.vScale = -1;
                        insideMaterial.diffuseTexture = insideTexture;
                    }

                    mesh = createDomeRoof("roof", room.width, room.depth, scene, thickness, outsideMaterial, insideMaterial);

                    // The dome's inside faces mostly away from the scene's main overhead
                    // light (worst at the apex, where an inward normal points straight down),
                    // so under that light alone a painted ceiling reads as almost black. This
                    // supplemental light shines up into the dome from below to keep it well
                    // lit; scoping it to just this mesh (includedOnlyMeshes) keeps it from
                    // spilling onto the rest of the scene. Its diffuse/groundColor are kept
                    // moderate (not full white) so that, added to the main light's own
                    // contribution, the inside stays comfortably lit without clipping to a
                    // flat, curvature-hiding white everywhere.
                    this.insideLight = new HemisphericLight(`${mesh.name}-inside-light`, Vector3.Down(), scene);
                    this.insideLight.diffuse = new Color3(0.6, 0.6, 0.6);
                    this.insideLight.groundColor = new Color3(0.15, 0.15, 0.15);
                    this.insideLight.specular = Color3.Black();
                    this.insideLight.includedOnlyMeshes = [mesh];
                    break;
                }

                case "flat":
                default:
                    mesh = MeshBuilder.CreateBox("roof", {
                        width: room.width,
                        height: thickness,
                        depth: room.depth
                    }, scene);
                    break;
            }

            mesh.parent = room.getNode();
            mesh.position = new Vector3(0, room.height, 0);

            this.setMesh(mesh);
        } finally {
            this.endBuild();
        }
    }
}
