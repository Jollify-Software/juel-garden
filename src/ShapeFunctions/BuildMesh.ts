import { Scene, Mesh, Vector3, VertexData } from "babylonjs";

/*
 * Copyright 2021 Stairs Generator (https://www.kitfox.com)
 * Copyright 2021 Mark McKay
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export function buildMesh(scene: Scene, verts: number[][], faces: number[][], uvsIn: number[][]): Mesh {

    var customMesh = new Mesh("custom", scene);
    var positions: number[] = [];
    var indices: number[] = [];
    var normals: number[] = [];
    var uvs: number[] = [];


    var indexPtr: number = 0;
    for (var i = 0; i < faces.length; ++i) {
        var face = faces[i];

        var p0: Vector3 = new Vector3(verts[face[0]][0], verts[face[0]][1], verts[face[0]][2])
        var p1: Vector3 = new Vector3(verts[face[1]][0], verts[face[1]][1], verts[face[1]][2])
        var p2: Vector3 = new Vector3(verts[face[2]][0], verts[face[2]][1], verts[face[2]][2])
        var d1: Vector3 = p1.subtract(p0);
        var d2: Vector3 = p2.subtract(p0);
        var n: Vector3 = d1.cross(d2);
        n.normalize();

        for (var j = 0; j < face.length; ++j) {
            for (var k = 0; k < 3; ++k)
                positions.push(verts[face[j]][k]);

            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            var uvIn = uvsIn[i];
            for (var k = 0; k < 2; ++k)
                uvs.push(uvIn[k]);
        }

        indices.push(indexPtr);
        indices.push(indexPtr + 2);
        indices.push(indexPtr + 1);


        if (face.length == 4) {
            indices.push(indexPtr + 0);
            indices.push(indexPtr + 3);
            indices.push(indexPtr + 2);
        }

        indexPtr += face.length;
    }

    var vertexData = new VertexData();
    vertexData.applyToMesh(customMesh);
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.indices = indices;
    vertexData.applyToMesh(customMesh);

    return customMesh;
}