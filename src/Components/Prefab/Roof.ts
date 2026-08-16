import { Color3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../../GardenMesh";
import { createDomeRoof } from "../../Utils/Mesh/createDomeRoof";
import { ColorConverter, GardenRoom } from "./Room";
import { GardenStructure } from "./Structure";

interface RoofContainer {
    node: TransformNode;
    width: number;
    depth: number;
    height: number;
    thickness: number;
    centerX: number;
    centerZ: number;
}

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
        let parent = this.parentElement;
        let container: RoofContainer;

        if (parent instanceof GardenRoom) {
            let room = parent;
            await room.whenReady;
            container = {
                node: room.getNode(),
                width: room.width,
                depth: room.depth,
                height: room.height,
                thickness: this.thickness ?? room.thickness,
                centerX: 0,
                centerZ: 0
            };
        } else if (parent instanceof GardenStructure) {
            container = await this.computeStructureContainer(parent);
            if (!container)
                return;
        } else {
            console.warn("<garden-roof> must be a child of <garden-room> or <garden-structure>.");
            return;
        }

        if (this.insideLight) {
            this.insideLight.dispose();
            this.insideLight = null;
        }

        this.beginBuild();
        try {
            let scene = this.getScene();
            let thickness = container.thickness;
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

                    mesh = createDomeRoof("roof", container.width, container.depth, scene, thickness, outsideMaterial, insideMaterial);

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
                        width: container.width,
                        height: thickness,
                        depth: container.depth
                    }, scene);
                    break;
            }

            mesh.parent = container.node;
            mesh.position = new Vector3(container.centerX, container.height, container.centerZ);

            this.setMesh(mesh);
        } finally {
            this.endBuild();
        }
    }

    /**
     * Size and centre the roof over every <garden-room> sibling under the same
     * <garden-structure>, instead of a single room, so one dome can cover several rooms
     * at once. Reads the rooms' declared position/width/depth attributes directly rather
     * than their built meshes -- those are available as soon as the document has parsed,
     * so there's no readiness dependency between the roof and its room siblings (which
     * matters: <garden-structure> itself waits on its room/stair children, so waiting on
     * the structure here would deadlock against that).
     */
    private async computeStructureContainer(structure: GardenStructure): Promise<RoofContainer | null> {
        // Children may not be parsed into the light DOM yet -- same reasoning as
        // <garden-structure>'s own updated().
        if (document.readyState === 'loading') {
            await new Promise<void>(resolve =>
                document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
            );
        }

        let rooms = (<Element[]>Array.prototype.slice.call(structure.children))
            .filter((el): el is GardenRoom => el instanceof GardenRoom);

        if (rooms.length === 0) {
            console.warn("<garden-roof> under <garden-structure> needs at least one <garden-room> sibling to size itself against.");
            return null;
        }

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxHeight = 0;
        for (let room of rooms) {
            let pos = room.position ?? Vector3.Zero();
            minX = Math.min(minX, pos.x - room.width / 2);
            maxX = Math.max(maxX, pos.x + room.width / 2);
            minZ = Math.min(minZ, pos.z - room.depth / 2);
            maxZ = Math.max(maxZ, pos.z + room.depth / 2);
            maxHeight = Math.max(maxHeight, room.height);
        }

        return {
            node: structure.getNode(),
            width: maxX - minX,
            depth: maxZ - minZ,
            height: maxHeight,
            thickness: this.thickness ?? GardenRoom.WallThickness,
            centerX: (minX + maxX) / 2,
            centerZ: (minZ + maxZ) / 2
        };
    }
}
