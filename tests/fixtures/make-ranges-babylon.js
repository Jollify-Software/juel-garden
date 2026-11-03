// Writes tests/fixtures/ranges.babylon: a triangle skinned to one bone whose animation is a
// single take of keyed matrices (as a .babylon rig keeps them), with two named ranges on the
// skeleton: "up" (frames 0-30, the bone rises 1) and "down" (30-60, back to 0); frames 60-90
// slide it 1 along x, for a <garden-clip from to> to cut. Run: node tests/fixtures/make-ranges-babylon.js
const fs = require("fs");
const path = require("path");

const at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scene = {
    meshes: [{
        name: "triangle", id: "triangle", position: [0, 0, 0], rotation: [0, 0, 0], scaling: [1, 1, 1],
        isVisible: true, isEnabled: true, checkCollisions: false, billboardMode: 0, receiveShadows: false,
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, -1, 0, 0, -1, 0, 0, -1], indices: [0, 1, 2],
        skeletonId: 0, matricesIndices: [0, 0, 0], matricesWeights: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        numBoneInfluencers: 4,
    }],
    skeletons: [{
        name: "rig", id: 0,
        bones: [{
            name: "root", index: 0, parentBoneIndex: -1, matrix: at(0, 0, 0),
            animation: {
                name: "take", property: "_matrix", framePerSecond: 30, dataType: 3, loopBehavior: 1,
                keys: [
                    { frame: 0, values: at(0, 0, 0) },
                    { frame: 30, values: at(0, 1, 0) },
                    { frame: 60, values: at(0, 0, 0) },
                    { frame: 90, values: at(1, 0, 0) },
                ],
            },
        }],
        ranges: [{ name: "up", from: 0, to: 30 }, { name: "down", from: 30, to: 60 }],
    }],
};
fs.writeFileSync(path.join(__dirname, "ranges.babylon"), JSON.stringify(scene));
