import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ModifyColourSetter } from "./ModifyColourSetter";
import { ModifyFloatSetter } from "./ModifyFloatSetter";
import { ModifyRotationSetter } from "./ModifyRotationSetter";
import { ModifyTextureSetter } from "./ModifyTextureSetter";
import { ModifyVector3Setter } from "./ModifyVector3Setter";

/**
 * Applies the visual/material attributes every {@link GardenMesh} shares
 * (`position`, `rotation`, `scale`, `colour` and friends, `texture` and
 * friends) onto a built Babylon mesh, dispatching each attribute to its
 * {@link ISetter}. Called by {@link GardenMesh.modifyMesh}.
 *
 * @category Modifiers
 */
export module Modifier {
    var map = {
        'position': ModifyVector3Setter('position'),
        'rotation': ModifyRotationSetter,
        'scale': ModifyVector3Setter('scale', 'scaling'),
        'colour': ModifyColourSetter(),
        'spec-colour': ModifyColourSetter("spec"),
        'emissive-colour': ModifyColourSetter("emissive"),
        'diffuse-colour': ModifyColourSetter("diffuse", "diffuse-colour"),
        'texture': ModifyTextureSetter(),
        'diffuse-texture': ModifyTextureSetter("diffuse", "diffuse-texture"),
        'texture-uscale': ModifyFloatSetter('texture-uscale', 'mat.diffuseTexture-uScale'),
        'texture-vscale': ModifyFloatSetter('texture-vscale', 'mat.diffuseTexture-vScale'),

        'bump-texture': ModifyTextureSetter("bump"),
        'bump-texture-uscale': ModifyFloatSetter('bump-texture-uscale', 'mat.bumpTexture-uScale'),
        'bump-texture-vscale': ModifyFloatSetter('bump-texture-vscale', 'mat.bumpTexture-vScale'),

        'reflection-texture': ModifyTextureSetter("reflection"),
        'reflection-texture-level': ModifyFloatSetter('reflection-texture-level', 'mat.reflectionTexture-level'),
        'reflection-texture-coordinates': ModifyFloatSetter('reflection-texture-coordinates', 'mat.reflectionTexture-coordinatesMode'),
    }

    /**
     * The `position`, `rotation` (radians) and `scaling` that {@link modifyMesh} will give `el`'s
     * mesh, parent element's share included, without touching a mesh: for an element that must
     * know where its geometry will end up while it builds it (a scatter or a wall sat on a ground).
     * Each is undefined when `el` lacks that attribute.
     */
    export var transformOf = function(el: HTMLElement): { position?: Vector3, rotation?: Vector3, scaling?: Vector3 } {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};
        for (let key of ['position', 'rotation', 'scale'])
            if (collection.some(x => x.name == key))
                map[key](el, collection, options);
        return options;
    }

    /**
     * The world frame of `el`'s mesh, given the `local` one built from {@link transformOf}: under a
     * `parent`-tagged element the mesh is really parented to that element's node, so its frame is
     * the node's world matrix on top of `local`. `yScale` is the frame's vertical scale, for turning
     * a world height back into the mesh's own units.
     */
    export var worldFrameOf = function(el: HTMLElement, local: Matrix): { frame: Matrix, yScale: number } {
        let frame = local;
        let parent = el.parentElement as HTMLElement & { getNode?(): TransformNode };
        let node = parent?.hasAttribute("parent") ? parent.getNode?.() : null;
        if (node)
            frame = local.multiply(node.computeWorldMatrix(true));
        let scale = new Vector3();
        frame.decompose(scale);
        return { frame, yScale: scale.y || 1 };
    }

    export var modifyMesh = function(el: HTMLElement, mesh: Mesh, exclude: string[] = null) {
        let collection = Array.prototype.slice.call(el.attributes) as Attr[];
        let options = {};

        for (let key in map) {
            if (exclude && exclude.indexOf(key) >= 0) {
                continue;
            }
            let attr = collection.find(x => x.name == key);
            if (attr) {
                map[key](el, collection, options);
            }
        }
        for (let key in options) {
            mesh[key] = options[key];
        }
    }
}