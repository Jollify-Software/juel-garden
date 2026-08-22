import { Color3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Texture, TransformNode, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMaterial } from "../Material";
import { GardenMesh } from "../../GardenMesh";
import { Vector3Convert } from "../../Converters/Vector3Convert";
import { createDomeRoof, DEFAULT_DOME_TEXTURE_TRANSFORM, DomeTextureTransform } from "../../Utils/Mesh/createDomeRoof";
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

/**
 * A roof over a `<garden-room>` or, spanning every `<garden-room>` sibling at
 * once, a `<garden-structure>`. Two types: `"flat"` (a simple box slab, the
 * default) or `"dome"` (an ellipsoid vault with separate outside/inside
 * shells and materials, and a supplemental uplight so a painted ceiling
 * doesn't read as black -- see {@link createDomeRoof}).
 *
 * Attributes: `type` (`"flat"|"dome"`), `thickness`, and for `type="dome"`:
 * `outside-colour`/`outside-texture`/`inside-colour`/`inside-texture` (or a
 * `<garden-material slot="outside"|"inside">` child, which takes full
 * precedence), `outside-texture-center`/`outside-texture-rotation`/
 * `inside-texture-center`/`inside-texture-rotation` (recentre/rotate a dome
 * texture around its apex).
 *
 * @example
 * ```html
 * <garden-room id="r1">
 *   <garden-roof type="dome" outside-colour="#c9a" inside-colour="white"></garden-roof>
 * </garden-room>
 * ```
 *
 * @category Components - Prefabs
 */
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

    // Where the texture's own centre point (its "u v" coordinate, default the middle of
    // the image) should sit on the dome -- always the apex -- and how far to rotate it
    // around that point, in degrees. Lets a photo whose focal point isn't perfectly
    // centred in the source image be recentred, or a fresco be turned to face the door.
    @property({ attribute: "outside-texture-center", converter: Vector3Convert.fromString }) outsideTextureCenter: Vector3;
    @property({ type: Number, attribute: "outside-texture-rotation" }) outsideTextureRotation: number;
    @property({ attribute: "inside-texture-center", converter: Vector3Convert.fromString }) insideTextureCenter: Vector3;
    @property({ type: Number, attribute: "inside-texture-rotation" }) insideTextureRotation: number;

    // Only used by type="dome" -- a supplemental light scoped to just the dome mesh (see
    // the "dome" case below), disposed and recreated whenever the roof rebuilds.
    private insideLight: HemisphericLight;

    constructor() {
        super();
        this.type = "flat";
    }

    async updated() {
        // Needed before reading any child <garden-material>'s built `.material` below (and,
        // for the <garden-structure> parent case, before reading room siblings' declared
        // size) -- children may not be upgraded/parsed yet if the document is still loading.
        await GardenRoof.whenDocumentReady();

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
                    // A <garden-material slot="outside"/"inside"> child, if present, takes
                    // full precedence over the legacy outside-*/inside-* attributes below --
                    // it's built (and its own <garden-texture> children's centre/rotation
                    // read) as-is, with none of the flat-attribute defaults layered on top.
                    let outsideMaterialEl = this.getMaterialSlot("outside");
                    let insideMaterialEl = this.getMaterialSlot("inside");

                    let outsideMaterial: StandardMaterial;
                    let outsideTextureTransform: DomeTextureTransform;
                    if (outsideMaterialEl) {
                        await outsideMaterialEl.whenReady;
                        outsideMaterial = outsideMaterialEl.material;
                        outsideTextureTransform = GardenRoof.materialTextureTransform(outsideMaterialEl);
                    } else {
                        outsideMaterial = new StandardMaterial("roof-outside", scene);
                        if (this.outsideColour)
                            outsideMaterial.diffuseColor = this.outsideColour;
                        if (this.outsideTexture)
                            outsideMaterial.diffuseTexture = new Texture(this.outsideTexture, scene);
                        outsideTextureTransform = this.textureTransform(this.outsideTextureCenter, this.outsideTextureRotation);
                    }

                    let insideMaterial: StandardMaterial;
                    let insideTextureTransform: DomeTextureTransform;
                    if (insideMaterialEl) {
                        await insideMaterialEl.whenReady;
                        insideMaterial = insideMaterialEl.material;
                        insideTextureTransform = GardenRoof.materialTextureTransform(insideMaterialEl);
                    } else {
                        // Normally lit (not disableLighting -- StandardMaterial's disableLighting
                        // skips the light loop entirely, which leaves diffuseColor/diffuseTexture
                        // permanently zeroed out regardless of their value, not just "unshaded").
                        insideMaterial = new StandardMaterial("roof-inside", scene);
                        insideMaterial.diffuseColor = this.insideColour ?? Color3.White();
                        // A painted fresco is matte, not glossy -- StandardMaterial's default
                        // specular reflectivity otherwise puts a bright specular highlight right
                        // where the inward-facing normals happen to catch the scene lights best,
                        // which is almost exactly the apex from most viewing angles. With the
                        // texture now correctly centred on the apex (see createDomeRoof), that
                        // highlight would sit squarely on the artwork's focal point.
                        insideMaterial.specularColor = Color3.Black();
                        if (this.insideTexture)
                            insideMaterial.diffuseTexture = new Texture(this.insideTexture, scene);
                        insideTextureTransform = this.textureTransform(this.insideTextureCenter, this.insideTextureRotation);
                    }

                    mesh = createDomeRoof("roof", container.width, container.depth, scene, thickness,
                        outsideMaterial, insideMaterial, outsideTextureTransform, insideTextureTransform);

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

    private textureTransform(center: Vector3, rotationDegrees: number): DomeTextureTransform {
        return {
            centerU: center?.x ?? 0.5,
            centerV: center?.y ?? 0.5,
            rotation: (rotationDegrees ?? 0) * Math.PI / 180
        };
    }

    /** Direct <garden-material slot="..."> child only -- not any nested inside a further child. */
    private getMaterialSlot(slot: string): GardenMaterial | null {
        return (<Element[]>Array.prototype.slice.call(this.children))
            .find((el): el is GardenMaterial => el.matches(`garden-material[slot="${slot}"]`)) ?? null;
    }

    /** Reads a <garden-material>'s own diffuse <garden-texture> for the dome's polar-UV
     *  centre/rotation, since that mapping needs raw numbers to bake into custom UVs --
     *  it can't just apply the transform to the built Texture the way a plain mesh would. */
    private static materialTextureTransform(materialEl: GardenMaterial): DomeTextureTransform {
        let textureEl = materialEl.getTexture("diffuse");
        return textureEl
            ? { centerU: textureEl.centerU, centerV: textureEl.centerV, rotation: textureEl.rotationRadians }
            : DEFAULT_DOME_TEXTURE_TRANSFORM;
    }
}
