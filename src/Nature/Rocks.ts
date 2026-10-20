import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import { noise } from "../Utils/noise";

/**
 * A textured material from a colour texture and its normal map, repeating `uTiles` × `vTiles`
 * times per UV unit, with a faint specular: rock, bark, stone walls.
 *
 * @category Nature
 */
export function texturedMaterial(scene: Scene, name: string, colour: string, normal?: string, uTiles = 1, vTiles = uTiles): StandardMaterial {
    let m = new StandardMaterial(name, scene);
    let textures = [m.diffuseTexture = new Texture(colour, scene)];
    if (normal) textures.push(m.bumpTexture = new Texture(normal, scene));
    for (let t of textures) {
        (<Texture>t).uScale = uTiles;
        (<Texture>t).vScale = vTiles;
    }
    m.specularColor = new Color3(0.04, 0.04, 0.04);
    m.maxSimultaneousLights = 8;
    return m;
}

/**
 * A rock: an icosphere pushed in and out by noise, so no two `seed`s are alike and none is
 * round, with a flattened base so it sits on the ground. About 640 triangles. Scale it unevenly
 * for slabs and boulders, sink it a little into the ground, and merge many with
 * `Mesh.MergeMeshes` (one draw call) under one {@link texturedMaterial}.
 *
 * @category Nature
 */
export function rockMesh(scene: Scene, radius: number, seed: number, name = "rock"): Mesh {
    let rock = MeshBuilder.CreateIcoSphere(name, { radius: 1, subdivisions: 3, updatable: true }, scene);
    let p = rock.getVerticesData(VertexBuffer.PositionKind);
    for (let i = 0; i < p.length; i += 3) {
        let [x, y, z] = [p[i], p[i + 1], p[i + 2]];
        let k = radius * (0.78 + noise(x * 1.6 + seed, z * 1.6 - seed) * 0.32 + noise(y * 3.1 - seed, x * 3.1 + seed) * 0.14);
        p[i] = x * k;
        p[i + 1] = (y < -0.2 ? -0.2 + (y + 0.2) * 0.3 : y) * k;
        p[i + 2] = z * k;
    }
    let normals: number[] = [];
    VertexData.ComputeNormals(p, rock.getIndices(), normals);
    rock.updateVerticesData(VertexBuffer.PositionKind, p);
    rock.updateVerticesData(VertexBuffer.NormalKind, normals);
    return rock;
}

/** How {@link stoneWall} builds a wall. */
export interface StoneWallOptions {
    /** Default 1.05. */
    height?: number;
    /** Its width at the foot and the top. Default 0.72 and 0.54 (a dry-stone wall tapers). */
    footWidth?: number;
    topWidth?: number;
    /** The wall's material (it repeats per metre along and up the wall), and the capstones'. */
    material?: Material;
    capMaterial?: Material;
    /** One capstone every this many metres (0 for none). Default 0.55. */
    capEvery?: number;
}

/**
 * A dry-stone wall along `path` (points on the ground; it's sunk 5 cm into it), extruded from
 * a tapering cross-section, with rough capstones along the top and bigger ones at each end.
 * Give its material a stone-wall texture repeating about every 1.6 m. {@link arcPath} gives a
 * path round a circle (a sheepfold, a well), leaving a gap for a gate.
 *
 * @category Nature
 */
export function stoneWall(scene: Scene, path: Vector3[], options: StoneWallOptions = {}): { wall: Mesh, caps: Mesh } {
    let h = options.height ?? 1.05;
    let foot = (options.footWidth ?? 0.72) / 2, top = (options.topWidth ?? 0.54) / 2;
    let shape = [new Vector3(-foot, 0, 0), new Vector3(-top, h, 0), new Vector3(top, h, 0), new Vector3(foot, 0, 0)];
    let sunk = path.map(p => p.add(new Vector3(0, -0.05, 0)));
    let wall = MeshBuilder.ExtrudeShape("stone-wall", { shape, path: sunk, closeShape: true, cap: Mesh.CAP_ALL, sideOrientation: Mesh.DOUBLESIDE }, scene);
    if (options.material) wall.material = options.material;
    wall.isPickable = false;

    let caps: Mesh = null;
    let every = options.capEvery ?? 0.55;
    if (every > 0) {
        let length = 0;
        let along: number[] = [0];
        for (let i = 1; i < path.length; i++) along.push(length += Vector3.Distance(path[i - 1], path[i]));
        let count = Math.max(1, Math.round(length / every));
        let stones: Mesh[] = [];
        for (let i = 0; i <= count; i++) {
            let d = (i / count) * length;
            let j = Math.min(path.length - 2, along.findIndex(a => a >= d) - 1);
            j = Math.max(0, j);
            let t = (d - along[j]) / Math.max(1e-6, along[j + 1] - along[j]);
            let at = Vector3.Lerp(path[j], path[j + 1], t);
            let dir = path[j + 1].subtract(path[j]);
            let end = i == 0 || i == count;
            let s = end ? 0.3 : 0.24 + noise(i * 1.7, 3) * 0.08;
            let c = rockMesh(scene, s, i * 3.3, "capstone");
            c.scaling.set(1.3, end ? 1.2 : 0.7, 1);
            c.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
            c.position.set(at.x, at.y + h + (end ? 0.12 : 0.05), at.z);
            stones.push(c);
        }
        caps = Mesh.MergeMeshes(stones, true, true);
        if (options.capMaterial) caps.material = options.capMaterial;
        caps.isPickable = false;
    }
    return { wall, caps };
}

/**
 * Points round a circle every `step` metres, from angle `from` to `to` (radians; 0 is +z),
 * at the ground's height: a path for {@link stoneWall}. Leave a gap for a gate by going from
 * `gate + gap / 2` to `gate + 2π - gap / 2`.
 *
 * @category Nature
 */
export function arcPath(centre: { x: number, z: number }, radius: number, from: number, to: number,
    groundY: (x: number, z: number) => number = () => 0, step = 0.3): Vector3[] {
    let steps = Math.max(2, Math.ceil(((to - from) * radius) / step));
    let path: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
        let a = from + ((to - from) * i) / steps;
        let x = centre.x + Math.sin(a) * radius, z = centre.z + Math.cos(a) * radius;
        path.push(new Vector3(x, groundY(x, z), z));
    }
    return path;
}
