# Makes examples/assets/hinged-box.glb: a small box (0.3 m) whose lid opens and closes, with
# two animations, "Open" and "Close", each a single rotation of the lid about its back edge.
# The rest pose is closed. A test asset for one-shot animations and <garden-model-viewer>;
# made here, CC0. Run with Blender 3.6:
#
#   "C:\Program Files\Blender Foundation\Blender 3.6\blender.exe" -b -P Tools/make-hinged-box.py
import math
import os
import bpy

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "examples", "assets", "hinged-box.glb")
SIZE, LID = 0.3, 0.04      # the box's width and depth; the lid's thickness
FRAMES, OPEN = 30, -110    # each animation's length at 30 fps; how far the lid opens, degrees
                           # (negative about x: the front edge rises and the lid falls back)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, FRAMES + 1


def material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
    return m


# transform_apply() also applies location and rotation unless told not to: only the scale is
# baked into the meshes, so each keeps its own origin.

# The base: a box with its bottom on the ground (y up in glTF: Blender's z).
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (SIZE - LID) / 2))
base = bpy.context.object
base.name = "Base"
base.scale = (SIZE, SIZE, SIZE - LID)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
base.data.materials.append(material("Wood", (0.55, 0.32, 0.15)))

# The hinge: an empty on the back top edge; the lid hangs from it, so turning it opens the lid.
hinge = bpy.data.objects.new("Lid", None)
scene.collection.objects.link(hinge)
hinge.location = (0, SIZE / 2, SIZE - LID)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -SIZE / 2, LID / 2))
lid = bpy.context.object
lid.name = "LidPanel"
lid.scale = (SIZE, SIZE, LID)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
lid.data.materials.append(material("Lid", (0.75, 0.2, 0.15)))
lid.parent = hinge
lid.location = (0, -SIZE / 2, LID / 2)


def action(name, start, end):
    hinge.rotation_mode = "XYZ"
    hinge.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    hinge.animation_data.action = act
    for frame, degrees in ((1, start), (FRAMES + 1, end)):
        hinge.rotation_euler = (math.radians(degrees), 0, 0)
        hinge.keyframe_insert("rotation_euler", frame=frame)
    for curve in act.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR"
    hinge.animation_data.action = None
    track = hinge.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, act)
    return act


# Close first: the top track (Open) is what Blender evaluates for the rest pose, and
# Open starts closed.
action("Close", OPEN, 0)
action("Open", 0, OPEN)
hinge.rotation_euler = (0, 0, 0)   # rest pose: closed
scene.frame_set(1)

kwargs = dict(filepath=OUT, export_format="GLB", export_animations=True, export_yup=True)
try:
    bpy.ops.export_scene.gltf(**kwargs, export_animation_mode="NLA_TRACKS")
except TypeError:
    bpy.ops.export_scene.gltf(**kwargs, export_nla_strips=True)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
