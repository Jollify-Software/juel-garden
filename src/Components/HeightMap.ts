import { GroundMesh, MeshBuilder } from "babylonjs";
import { customElement, property } from "lit/decorators";
import { GardenMesh } from "../GardenMesh";

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