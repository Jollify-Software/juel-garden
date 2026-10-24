import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { customElement } from "lit/decorators.js";
import { GardenMesh } from "../GardenMesh";

/**
 * A torus knot: a tube wound round a ring, via Babylon's `MeshBuilder.CreateTorusKnot`.
 * Attributes: `radius` (default 2), `tube` (the tube's radius, default 0.5),
 * `radial-segments` (default 32), `tubular-segments` (default 32), `p` and `q`
 * (how many times it winds round the ring and through it; default 2 and 3), plus
 * the common {@link GardenMesh} set.
 * @example
 * ```html
 * <garden-torus-knot radius="2" tube="0.5" colour="green"></garden-torus-knot>
 * ```
 * @category Components
 */
@customElement("garden-torus-knot")
export class GardenTorusKnot extends GardenMesh {
    updated() {
        let number = (name: string) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
        this.setMesh(MeshBuilder.CreateTorusKnot(this.id || "torusKnot", {
            radius: number("radius"), tube: number("tube"),
            radialSegments: number("radial-segments"), tubularSegments: number("tubular-segments"),
            p: number("p"), q: number("q"),
            sideOrientation: (<any>this.buildOptions()).sideOrientation,
        }, this.getScene()));
        super.updated();
    }
}
