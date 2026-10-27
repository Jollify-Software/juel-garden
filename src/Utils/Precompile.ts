import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

/** How {@link precompile} picks what to compile first. */
export interface PrecompileOptions {
    /**
     * Which meshes a first screen (a title, the start of a level) shows: these compile before
     * the returned `first` resolves. Default: every mesh.
     */
    first?: (mesh: AbstractMesh) => boolean;
    /** Meshes to leave out altogether (the ones the game compiles itself later). */
    skip?: (mesh: AbstractMesh) => boolean;
}

/** What {@link precompile} returns: two stages, each a promise. */
export interface Precompiled {
    /** The first screen's shaders are compiled: show it. */
    first: Promise<void>;
    /** Every shader is compiled, and the scene is ready: start play. */
    all: Promise<void>;
    /** How many meshes each stage compiled. */
    counts: { first: number; rest: number };
}

/**
 * Compiles the scene's shaders before play, so nothing stalls once the player is moving, in
 * two stages: the meshes a first screen shows (see `first`), then the rest in the background
 * while that screen is up. Instanced meshes get their instanced shaders; `scene.whenReadyAsync()`
 * finishes the second stage.
 *
 * The rule that makes this worth doing: **set everything that changes a shader's defines
 * before a mesh first renders**, because a change afterwards compiles its shader again (with
 * ANGLE's Direct3D, hundreds of milliseconds each). That is the rendering pipeline and image
 * processing, every light the scene will have (make a light early and move it later, rather
 * than add it later), shadow generators and `receiveShadows`, fog mode, and the materials'
 * features (sheen, subsurface, alpha). A scene renders while it loads (behind a loading screen
 * too), so "first" can be the first frame after the scene exists. {@link toPBRMaterials} with
 * `vertexColours: false` removes another source of duplicate shaders in glTF models.
 *
 * Use `scene.getEngine()._compiledEffects` (its key count) to see how many shader variants a
 * scene really has: the same material compiles a different one for each set of mesh
 * attributes (extra UV sets, vertex colours, bones, instances) and each set of lights that
 * reach the mesh.
 *
 * @example
 * ```ts
 * const shaders = precompile(scene, { first: m => !!m.skeleton || m.name == "ground" || near(m) });
 * await shaders.first;   // show the title
 * await shaders.all;     // before play starts
 * ```
 *
 * @category Utilities
 */
export function precompile(scene: Scene, options: PrecompileOptions = {}): Precompiled {
    // (An instance shares its source's shader: the source compiles it, with `useInstances`.)
    let drawn = (m: AbstractMesh) => !!m.material && m.getTotalVertices() > 0 && m.getClassName() != "InstancedMesh" && !(options.skip?.(m) ?? false);
    let instanced = (m: AbstractMesh) => ((<Mesh>m).instances?.length ?? 0) > 0;
    let compile = (meshes: AbstractMesh[]) => Promise.all(meshes.map(m =>
        m.material!.forceCompilationAsync(m, { useInstances: instanced(m) }).catch(() => { })));
    let all = scene.meshes.filter(drawn);
    let firstMeshes = all.filter(m => options.first?.(m) ?? true);
    let counts = { first: firstMeshes.length, rest: all.length - firstMeshes.length };
    let first = compile(firstMeshes).then(() => { });
    let rest = first.then(async () => {
        await compile(all.filter(m => !firstMeshes.includes(m)));
        // Anything made since (a model that loaded during the first stage).
        await compile(scene.meshes.filter(m => drawn(m) && !all.includes(m)));
        await scene.whenReadyAsync();
    });
    return { first, all: rest, counts };
}

/** How many shader variants the engine has compiled so far (see {@link precompile}). */
export function compiledEffectCount(scene: Scene): number {
    let engine = <unknown>scene.getEngine() as { _compiledEffects?: object };
    return Object.keys(engine._compiledEffects ?? {}).length;
}
