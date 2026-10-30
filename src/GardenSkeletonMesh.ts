import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { GardenMesh } from "./GardenMesh";

/**
 * A {@link GardenMesh} that additionally carries a Babylon `Skeleton`, for
 * imported rigged models ({@link "Components/MeshModel"!GardenMeshModel}) whose bones a
 * `<garden-animation type="skeleton">` can then play.
 *
 * @category Core
 */
export class GardenSkeletonMesh extends GardenMesh {
    skeleton: Skeleton;
}