import { GroundMesh, MeshBuilder } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

/**
 * Terrain built from a greyscale heightmap image, via Babylon's
 * `MeshBuilder.CreateGroundFromHeightMap`. `whenReady` (see
 * {@link GardenElement.whenReady}) only resolves once the heightmap image has
 * actually finished loading and produced real height data -- important for
 * anything resolving this element by id and calling `getHeightAtCoordinates`
 * on its mesh, e.g. `<garden-box suspension-terrain="#id">` (see
 * {@link BehaviourSuspension}).
 *
 * Attributes: `url` (the heightmap image), `width`, `height`, `subdivisions`,
 * `minheight`, `maxheight`, `texture` (plus the common {@link GardenMesh} set).
 *
 * @example
 * ```html
 * <garden-height-map id="terrain" url="heightmap.png" width="100" height="100"
 *     subdivisions="60" minheight="0" maxheight="1.4" texture="grass.png"></garden-height-map>
 * ```
 *
 * @category Components
 */
@customElement("garden-height-map")
export class GardenHeightMap extends GardenMesh {
    @property() url: string;
    updated() {
        // CreateGroundFromHeightMap returns a real mesh immediately, but its actual
        // height data only lands once the heightmap image has finished loading over
        // the network -- getHeightAtCoordinates() returns garbage/non-finite until
        // then. whenReady must not resolve before that, or a consumer resolving this
        // element by id (e.g. <garden-box suspension-terrain="#id">) can start
        // querying heights before there are any real ones to query.
        this.beginBuild();
        let options: any = { ...this.buildOptions(), onReady: () => this.endBuild() };
        this.setMesh(
            MeshBuilder.CreateGroundFromHeightMap("largeGround", this.url, options, this.getScene()) as GroundMesh
        );
    }
}