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

export function StraightStairs(scene: Scene, width: number = 1, height: number = 2, depth: number = 2, stepType: StepType = StepType.NUM_STEPS, numSteps: number = 6, userStepHeight: number = .5, sides: boolean = true): Mesh {
    var verts = [];
    var faces = [];
    var uvs = [];

    width /= 2;

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

    var stepDepth = depth / numSteps;

    var f = 0;
    var uvyOffset = 0;


    //Draw steps
    for (var i = 0; i < numSteps; ++i) {
        verts.push([-width, i * stepHeight, i * stepDepth]);
        verts.push([width, i * stepHeight, i * stepDepth]);
        verts.push([-width, (i + 1) * stepHeight, i * stepDepth]);
        verts.push([width, (i + 1) * stepHeight, i * stepDepth]);

        if (i != 0) {
            faces.push([f + 0, f + 1, f - 1, f - 2]);
            uvs.push([
                [-width, uvyOffset + stepDepth],
                [-width, uvyOffset],
                [width, uvyOffset],
                [width, uvyOffset + stepDepth],
            ]);
            uvyOffset += stepDepth;
        }

        faces.push([f + 0, f + 2, f + 3, f + 1]);
        uvs.push([
            [-width, uvyOffset],
            [width, uvyOffset],
            [width, uvyOffset + stepHeight],
            [-width, uvyOffset + stepHeight],
        ]);

        uvyOffset += stepHeight;
        f += 4;
    }

    //Top of last step
    verts.push([-width, height, depth])
    verts.push([width, height, depth])
    faces.push([f + 0, f + 1, f - 1, f - 2])
    uvs.push([
        [-width, uvyOffset + stepDepth],
        [-width, uvyOffset],
        [width, uvyOffset],
        [width, uvyOffset + stepDepth],
    ]);

    if (sides) {
        verts.push([-width, 0, depth])
        verts.push([width, 0, depth])

        faces.push([f + 0, f + 2, f + 3, f + 1])
        uvs.push([
            [-width, height],
            [width, height],
            [width, 0],
            [-width, 0]
        ])


        faces.push([0, 1, f + 3, f + 2])
        uvs.push([
            [-width, depth],
            [-width, 0],
            [width, 0],
            [width, depth],
        ])

        //Side triangles
        for (var i = 0; i < numSteps; ++i) {
            var x = verts[i * 4 + 5][0]
            faces.push([i * 4 + 0, i * 4 + 4, i * 4 + 2])
            faces.push([i * 4 + 1, i * 4 + 3, i * 4 + 5])
            uvs.push([
                [verts[i * 4 + 0][0], verts[i * 4 + 0][2]],
                [verts[i * 4 + 4][0], verts[i * 4 + 4][2]],
                [verts[i * 4 + 2][0], verts[i * 4 + 2][2]],
            ])
            uvs.push([
                [verts[i * 4 + 1][0], verts[i * 4 + 1][2]],
                [verts[i * 4 + 3][0], verts[i * 4 + 3][2]],
                [verts[i * 4 + 5][0], verts[i * 4 + 5][2]],
            ])
        }

        // faces.push([0, (numSteps + 1) * 4, (numSteps + 1) * 4 + 2])
        // faces.push([1, (numSteps + 1) * 4 + 1, (numSteps + 1) * 4 + 3])
        faces.push([0, f + 2, f + 0])
        faces.push([1, f + 1, f + 3])
        uvs.push([
            [verts[0][0], verts[0][2]],
            [verts[f + 0][0], verts[f + 0][2]],
            [verts[f + 2][0], verts[f + 2][2]],
        ])
        uvs.push([
            [verts[1][0], verts[1][2]],
            [verts[f + 1][0], verts[f + 1][2]],
            [verts[f + 3][0], verts[f + 3][2]],
        ])

    }


    return buildMesh(scene, verts, faces, uvs);
}