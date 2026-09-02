import { Color3, HemisphericLight, Mesh, MeshBuilder, PolygonMeshBuilder, StandardMaterial, Texture, TransformNode, Vector2, Vector3 } from "babylonjs";
import { customElement, property } from "lit/decorators";
import earcut from "earcut";
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
    /** The room footprint in container-local XZ, when clipping is on and a curved room defines one. */
    outline?: Vector2[];
}

/**
 * A roof over a `<garden-room>` or, spanning every `<garden-room>` sibling at
 * once, a `<garden-structure>`. Types: `"flat"` (a simple box slab, the
 * default), `"dome"` (an ellipsoid vault with separate outside/inside shells and
 * materials, and a supplemental uplight so a painted ceiling doesn't read as
 * black -- see {@link createDomeRoof}), or `"cone"` (an apex/pitched roof --
 * a primitive hut over a rotunda).
 *
 * Attributes: `type` (`"flat"|"dome"|"cone"`), `thickness`, `overhang` (extend
 * the roof this far past the walls all round -- eaves; default `0`), `pitch`
 * (`"cone"` only -- rise as a multiple of the base radius, default `1`), `clip`
 * (default on; `clip="false"` lets the roof overhang square -- otherwise a
 * dome/slab is trimmed to a curved room's footprint plus `overhang`, so no
 * corners hang past the walls), and for `type="dome"`:
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
    /** Extend the roof this far past the walls all round (eaves / a "slight circular overlap"). */
    @property({ type: Number }) overhang = 0;
    /** `type="cone"` only: apex rise as a multiple of the base radius. */
    @property({ type: Number }) pitch = 1;
    // Default-on toggle: any value other than the string "false" clips the roof to a
    // curved room's footprint. (A plain Boolean property can't default to true and
    // still honour clip="false", so it's read as a string.)
    @property() clip: string;

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
                centerZ: 0,
                outline: this.clipping && room.wallLoop
                    ? room.wallLoop.map(p => new Vector2(p.x, p.z))
                    : undefined
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

            // Eaves: grow the footprint outward all round, and the clip outline with it.
            let over = Math.max(this.overhang || 0, 0);
            let rw = container.width + over * 2;
            let rd = container.depth + over * 2;
            let outline = this.expandOutline(container.outline, over);

            switch (this.type) {
                case "cone": {
                    // An apex roof: a cone whose base covers the (widened) footprint,
                    // rising `pitch` * base-radius. Baked base-at-y=0 so the shared
                    // positioning below drops it onto the wall top.
                    let radius = Math.max(rw, rd) / 2;
                    let rise = radius * (this.pitch || 1);
                    mesh = MeshBuilder.CreateCylinder("roof", {
                        // A hair of top diameter rather than a true point: a
                        // zero-radius apex collapses every top triangle into a
                        // degenerate fan that shades as a bright streak.
                        diameterTop: radius * 0.02,
                        diameterBottom: radius * 2,
                        height: rise,
                        // Deliberately low: faceted reads as hand-built, and the
                        // flat panels break up the smooth-shading band a
                        // single-colour cone would otherwise show.
                        tessellation: 12
                    }, scene);
                    mesh.convertToFlatShadedMesh();
                    mesh.position.y = rise / 2;
                    mesh.bakeCurrentTransformIntoVertices();
                    break;
                }

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

                    mesh = createDomeRoof("roof", rw, rd, scene, thickness,
                        outsideMaterial, insideMaterial, outsideTextureTransform, insideTextureTransform,
                        outline);

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
                    if (outline && outline.length >= 3) {
                        // Slab trimmed to the room footprint; PolygonMeshBuilder lays it at
                        // y = 0 extruding down, so lift it to straddle y = 0 like the box.
                        mesh = new PolygonMeshBuilder("roof", outline, scene, earcut).build(false, thickness);
                        mesh.position.y = thickness / 2;
                        mesh.bakeCurrentTransformIntoVertices();
                    } else {
                        mesh = MeshBuilder.CreateBox("roof", {
                            width: rw,
                            height: thickness,
                            depth: rd
                        }, scene);
                    }
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

        let centerX = (minX + maxX) / 2;
        let centerZ = (minZ + maxZ) / 2;

        // Clip to the room footprint only when there's a single curved room to trace
        // (the common "dome on a rotunda" case). A multi-room structure would need a
        // real polygon union; its rectangular cap is left alone. `wallLoop` is built
        // state, so wait for the room here -- safe, since the structure waits on its
        // rooms but nothing waits on this roof.
        let outline: Vector2[] | undefined;
        if (this.clipping && rooms.length === 1) {
            await rooms[0].whenReady;
            let loop = rooms[0].wallLoop;
            if (loop) {
                let pos = rooms[0].position ?? Vector3.Zero();
                outline = loop.map(p => new Vector2(p.x + pos.x - centerX, p.z + pos.z - centerZ));
            }
        }

        return {
            node: structure.getNode(),
            width: maxX - minX,
            depth: maxZ - minZ,
            height: maxHeight,
            thickness: this.thickness ?? GardenRoom.WallThickness,
            centerX,
            centerZ,
            outline
        };
    }

    /** Whether the roof is trimmed to a curved room's footprint (the `clip` attribute, default on). */
    private get clipping(): boolean {
        return this.clip !== "false";
    }

    /** Push every outline vertex `by` units out from the outline's centroid (eaves). */
    private expandOutline(outline: Vector2[] | undefined, by: number): Vector2[] | undefined {
        if (!outline || outline.length < 3 || by <= 0)
            return outline;
        let cx = 0, cz = 0;
        for (let p of outline) { cx += p.x; cz += p.y; }
        cx /= outline.length;
        cz /= outline.length;
        return outline.map(p => {
            let dx = p.x - cx, dz = p.y - cz;
            let d = Math.hypot(dx, dz) || 1;
            return new Vector2(p.x + dx / d * by, p.y + dz / d * by);
        });
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
