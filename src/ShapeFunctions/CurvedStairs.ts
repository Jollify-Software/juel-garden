import { Scene, Mesh } from "babylonjs";
import { buildMesh } from "./BuildMesh";
import { StepType } from "./Stairs";

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

export function CurvedStairs(scene: Scene, height: number = 2, stepWidth: number = 1, stepType: StepType = StepType.NUM_STEPS, numSteps: number = 6, userStepHeight: number = .2, curvature: number = 60, innerRadius: number = 3, ccw: boolean = false, sides: boolean = true): Mesh {
    const toRadians = Math.PI / 180;

    var verts = [];
    var faces = [];
    var uvs = [];

    //Setup calculations
    var stepHeight: number;
    if (stepType == StepType.NUM_STEPS) {
        stepHeight = height / numSteps;
    }
    else {
        stepHeight = userStepHeight;
        numSteps = Math.max(Math.floor(height / userStepHeight), 1);
        height = stepHeight * numSteps;
    }

    var deltaAngle = curvature * toRadians / numSteps;
    var stepDepth = deltaAngle * (innerRadius + stepWidth / 2) / numSteps;

    var f = 0;

    var offsetX: number;
    if (ccw)
        offsetX = -innerRadius - stepWidth / 2;
    else
        offsetX = innerRadius + stepWidth / 2;

    //Draw steps
    for (var i = 0; i < numSteps + 1; ++i) {
        var x: number, z: number;
        if (ccw) {
            x = Math.cos(i * deltaAngle);
            z = Math.sin(i * deltaAngle);
        }
        else {
            x = -Math.cos(i * deltaAngle);
            z = Math.sin(i * deltaAngle);
        }

        var x0 = x * innerRadius + offsetX;
        var z0 = z * innerRadius;
        var x1 = x * (innerRadius + stepWidth) + offsetX;
        var z1 = z * (innerRadius + stepWidth);

        verts.push([x0, i * stepHeight, z0]);
        verts.push([x1, i * stepHeight, z1]);
        if (i != numSteps) {
            verts.push([x0, (i + 1) * stepHeight, z0])
            verts.push([x1, (i + 1) * stepHeight, z1])
        }
    }

    var uvyOffset = 0;

    for (var i = 0; i < numSteps; ++i) {
        faces.push([f + 0, f + 1, f + 3, f + 2])
        uvs.push([[0, uvyOffset], [stepWidth, uvyOffset], [stepWidth, uvyOffset + stepHeight], [0, uvyOffset + stepHeight]]);
        uvyOffset += stepHeight;

        faces.push([f + 2, f + 3, f + 5, f + 4])
        uvs.push([[0, uvyOffset], [stepWidth, uvyOffset], [stepWidth, uvyOffset + stepDepth], [0, uvyOffset + stepDepth]]);
        uvyOffset += stepDepth;

        f += 4;
    }


    if (sides) {
        for (var i = 1; i < numSteps + 1; ++i) {
            var x: number, z: number;
            if (ccw) {
                x = Math.cos(i * deltaAngle);
                z = Math.sin(i * deltaAngle);
            }
            else {
                x = -Math.cos(i * deltaAngle);
                z = Math.sin(i * deltaAngle);
            }

            var x0 = x * innerRadius + offsetX
            var z0 = z * innerRadius
            var x1 = x * (innerRadius + stepWidth) + offsetX
            var z1 = z * (innerRadius + stepWidth)

            verts.push([x0, 0, z0])
            verts.push([x1, 0, z1])
        }
    }

    //Side triangles
    for (var i = 0; i < numSteps; ++i) {
        var g = i * 4;
        faces.push([g + 0, g + 2, g + 4]);
        uvs.push([
            [i * stepDepth, verts[g + 0][2]],
            [i * stepDepth, verts[g + 2][2]],
            [(i + 1) * stepDepth, verts[g + 4][2]]
        ]);

        faces.push([g + 1, g + 5, g + 3]);
        uvs.push([
            [i * stepDepth, verts[g + 0][2]],
            [(i + 1) * stepDepth, verts[g + 4][2]],
            [i * stepDepth, verts[g + 2][2]]
        ]);
    }

    //Side of first step of stairs
    var bottomVertIdxStart = numSteps * 4 + 2;
    faces.push([0, 4, bottomVertIdxStart]);
    uvs.push([
        [0, verts[0][2]],
        [stepDepth, verts[4][2]],
        [stepDepth, verts[bottomVertIdxStart][2]],
    ]);

    faces.push([1, bottomVertIdxStart + 1, 5]);
    uvs.push([
        [0, verts[0][2]],
        [stepDepth, verts[bottomVertIdxStart][2]],
        [stepDepth, verts[4][2]]
    ]);

    //Side slats
    for (var i = 1; i < numSteps; ++i) {
        var g = i * 4
        var h = numSteps * 4 + 2 + (i - 1) * 2

        faces.push([h + 0, g + 0, g + 4, h + 2])
        uvs.push([
            [i * stepDepth, verts[h + 0][2]],
            [i * stepDepth, verts[g + 0][2]],
            [(i + 1) * stepDepth, verts[g + 4][2]],
            [(i + 1) * stepDepth, verts[h + 2][2]]
        ])

        faces.push([h + 1, h + 3, g + 5, g + 1])
        uvs.push([
            [i * stepDepth, verts[h + 0][2]],
            [(i + 1) * stepDepth, verts[h + 2][2]],
            [(i + 1) * stepDepth, verts[g + 4][2]],
            [i * stepDepth, verts[g + 0][2]]
        ])
    }

    //Bottom
    faces.push([0, bottomVertIdxStart, bottomVertIdxStart + 1, 1])
    uvs.push([
        [0, 0],
        [0, stepDepth],
        [stepWidth, stepDepth],
        [stepWidth, 0]
    ])

    for (var i = 1; i < numSteps; ++i) {
        var h = numSteps * 4 + 2 + (i - 1) * 2;
        faces.push([h + 0, h + 2, h + 3, h + 1])
        uvs.push([
            [0, i * stepDepth],
            [0, (i + 1) * stepDepth],
            [stepWidth, (i + 1) * stepDepth],
            [stepWidth, i * stepDepth]
        ])
    }

    //Back
    faces.push([bottomVertIdxStart - 2, bottomVertIdxStart - 1, numSteps * 6 + 1, numSteps * 6])
    uvs.push([
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0]
    ])

    return buildMesh(scene, verts, faces, uvs);
}