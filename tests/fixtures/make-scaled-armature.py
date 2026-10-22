# Makes tests/fixtures/scaled-armature.glb for tests/model-skinned.js: a 1.8 m figure drawn by a
# skinned box 0.018 tall in its own vertices, under an armature scaled 100.
# "C:/Program Files/Blender Foundation/Blender 3.6/blender.exe" -b --python tests/fixtures/make-scaled-armature.py -- tests/fixtures/scaled-armature.glb
import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
out = sys.argv[sys.argv.index("--") + 1]
# A figure 0.018 tall in its own vertices, under an armature scaled 100: 1.8 m as drawn.
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object
arm.name = "Armature"
bpy.ops.object.mode_set(mode='EDIT')
b = arm.data.edit_bones[0]
b.name = "Body"; b.head = (0, 0, 0); b.tail = (0, 0, 0.018)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.009))
body = bpy.context.object
body.name = "Figure"
body.scale = (0.006, 0.004, 0.018)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.parent = arm
mod = body.modifiers.new("Armature", "ARMATURE"); mod.object = arm
g = body.vertex_groups.new(name="Body"); g.add(list(range(len(body.data.vertices))), 1.0, 'REPLACE')
arm.scale = (100, 100, 100)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=False)
