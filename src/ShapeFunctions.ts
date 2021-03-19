import { Vector3, Vector4 } from "babylonjs";
import { Tools } from "babylonjs";
import { Utility } from "./Utility";

export module ShapeFunctions {
    export var triangle = () => {
        const points = [];
points.push(new Vector3(2, 0, 2));
points.push(new Vector3(2, 0, -2));
points.push(new Vector3(-2, 0, -2));
points.push(points[0]);
return points;
    }
    export var curve = () => {
        const points = [];
        for (let i = 0; i < 20; i++) {
            points.push(new Vector3(0.2 * Math.cos(i * Math.PI / 40), 0, 0.2 * Math.sin(i * Math.PI / 40) - 0.1));
        }
        return points;
    }
    export var curvedStairs = (height, stepWidth, stepType, numSteps, stepHeight, curvature, innerRadius, ccw, sides) => {

    let verts: Vector3[] = []
    let faces = []
    let uvs = []
    let offsetX: number;
    
    if (stepType == "NUM_STAIRS") { 
        stepHeight = height / numSteps
    } else {
        numSteps = Math.max(Math.floor(height / stepHeight), 1)
        height = stepHeight * numSteps
    }

    let deltaAngle = Tools.ToRadians(curvature) / numSteps
    let stepDepth = 2 * Math.PI * (curvature / 360) * (innerRadius + stepWidth / 2) / numSteps

    let f = 0
    
    if (ccw) {
        offsetX = -innerRadius - stepWidth / 2
    } else {
        offsetX = innerRadius + stepWidth / 2
    }

    // Draw steps    
    for (let i of Utility.range(numSteps + 1)) {
        let x: number;
        let y:number;
        let x0: number;
        let y0:number;
        let x1: number;
        let y1:number;

        if (ccw) {
            x = Math.cos(i * deltaAngle)
            y = Math.sin(i * deltaAngle)
        } else {
            x = -Math.cos(i * deltaAngle)
            y = Math.sin(i * deltaAngle)
        }
        x0 = x * innerRadius + offsetX
        y0 = y * innerRadius
        x1 = x * (innerRadius + stepWidth) + offsetX
        y1 = y * (innerRadius + stepWidth)

        verts.push(new Vector3(x0, y0, i * stepHeight))
        
        verts.push(new Vector3(x1, y1, i * stepHeight))
        
        if (i != numSteps) {
            verts.push(new Vector3(x0, y0, (i + 1) * stepHeight))
            //verts.push(new Vector3(x0, y1, (i + 1) * stepHeight))
            verts.push(new Vector3(x1, y1, (i + 1) * stepHeight))
            //verts.push(new Vector3(x1, y0, (i + 1) * stepHeight))
        }
        verts.push(new Vector3(x0, y1, i * stepHeight))
        verts.push(new Vector3(x1, y0, i * stepHeight))
    }
    let uvyOffset = 0
        
    for (let i of Utility.range(numSteps)) {
        faces.push(new Vector4(f + 0, f + 1, f + 3, f + 2))
        //uvs.push(new Vector4((0, uvyOffset), (stepWidth, uvyOffset), (stepWidth, uvyOffset + stepHeight), (0, uvyOffset + stepHeight)))
        uvyOffset+= stepHeight

        faces.push(new Vector4(f + 2, f + 3, f + 5, f + 4))
        //uvs.append(((0, uvyOffset), (stepWidth, uvyOffset), (stepWidth, uvyOffset + stepDepth), (0, uvyOffset + stepDepth)))
        uvyOffset+= stepDepth

        f += 4
    }
    if (sides) {
        for (let i of Utility.range(1, numSteps + 1)) {
            let x: number;
        let y:number;
        let x0: number;
        let y0:number;
        let x1: number;
        let y1:number;

            if (ccw) {
                x = Math.cos(i * deltaAngle)
                y = Math.sin(i * deltaAngle)
            } else {
                x = -Math.cos(i * deltaAngle)
                y = Math.sin(i * deltaAngle)
            }
            x0 = x * innerRadius + offsetX
            y0 = y * innerRadius
            x1 = x * (innerRadius + stepWidth) + offsetX
            y1 = y * (innerRadius + stepWidth)

            verts.push(new Vector3(x0, y0, 0))
            verts.push(new Vector3(x1, y1, 0))
        }
        /*
        // Side trianges
        for (let i in Utility.range(0, numSteps)) {
            g = i * 4
            #triangle at step
            faces.append((g + 0, g + 2, g + 4))
            uvs.append(((i * stepDepth, verts[g + 0][2]), (i * stepDepth, verts[g + 2][2]), ((i + 1) * stepDepth, verts[g + 4][2])))
       
            faces.append((g + 1, g + 5, g + 3))
            uvs.append(((i * stepDepth, verts[g + 0][2]), ((i + 1) * stepDepth, verts[g + 4][2]), (i * stepDepth, verts[g + 2][2])))
        }
        // side of first step of stairs
        bottomVertIdxStart = numSteps * 4 + 2
        faces.append((0, 4, bottomVertIdxStart))
        uvs.append(((0, verts[0][2]), (stepDepth, verts[4][2]), (stepDepth, verts[bottomVertIdxStart][2])))
        
        faces.append((1, bottomVertIdxStart + 1, 5))
        uvs.append(((0, verts[0][2]), (stepDepth, verts[bottomVertIdxStart][2]), (stepDepth, verts[4][2])))
            
        // Side slats
        for (let i in Utility.range(1, numSteps)) {
            g = i * 4
            h = numSteps * 4 + 2 + (i - 1) * 2
            
            faces.append((h + 0, g + 0, g + 4, h + 2))
            uvs.append(((i * stepDepth, verts[h + 0][2]), (i * stepDepth, verts[g + 0][2]), ((i + 1) * stepDepth, verts[g + 4][2]), ((i + 1) * stepDepth, verts[h + 2][2])))

            faces.append((h + 1, h + 3, g + 5, g + 1))
            uvs.append(((i * stepDepth, verts[h + 0][2]), ((i + 1) * stepDepth, verts[h + 2][2]), ((i + 1) * stepDepth, verts[g + 4][2]), (i * stepDepth, verts[g + 0][2])))
        }       
        // bottom
        faces.append((0, bottomVertIdxStart, bottomVertIdxStart + 1, 1))
        uvs.append(((0, 0), (0, stepDepth), (stepWidth, stepDepth), (stepWidth, 0)))

        for (let i in Utility.range(1, numSteps)) {
            h = numSteps * 4 + 2 + (i - 1) * 2
            faces.append((h + 0, h + 2, h + 3, h + 1))
            uvs.append(((0, i * stepDepth), (0, (i + 1) * stepDepth), (stepWidth, (i + 1) * stepDepth), (stepWidth, i * stepDepth)))
        }
        // back
        faces.append((bottomVertIdxStart - 2, bottomVertIdxStart - 1, numSteps * 6 + 1, numSteps * 6))
        uvs.append(((0, 1), (1, 1), (1, 0), (0, 0)))
        */
    }    

    return verts;//, faces, uvs
}
}