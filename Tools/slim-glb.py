"""Copies a rigged GLB keeping only the animation clips named, through Blender's glTF exporter
(at most four bone weights per vertex, no leaf-bone end points). For test and example models
cut down from big animation libraries. Run with Blender 3.6 or later:
  blender -b -P Tools/slim-glb.py -- in=<file.glb> out=<file.glb> keep=Idle_Loop,Walk_Loop
"""
import os
import sys

import bpy

args = dict(a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:])
keep = set(args['keep'].split(','))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args['in'])
# The importer leaves an empty at each leaf bone's tip: drop them.
for o in list(bpy.data.objects):
    if o.type == 'EMPTY' and o.name.endswith('_end'):
        bpy.data.objects.remove(o, do_unlink=True)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data_create()
arm.animation_data.action = None
for track in list(arm.animation_data.nla_tracks):
    arm.animation_data.nla_tracks.remove(track)
kept = set()
for action in list(bpy.data.actions):
    # The importer may name clips "Walk_Armature", and copies of duplicates ".001".
    name = action.name.split('|')[-1].split('.')[0]
    name = name[: -len('_' + arm.name)] if name.endswith('_' + arm.name) else name
    if name not in keep or name in kept:
        bpy.data.actions.remove(action)
        continue
    kept.add(name)
    action.name = name
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(action.frame_range[0]), action)
print('clips:', sorted(kept), 'missing:', sorted(keep - kept))
bpy.ops.export_scene.gltf(filepath=args['out'], export_format='GLB', export_animations=True, export_nla_strips=True,
                          export_force_sampling=True, export_all_influences=False, export_def_bones=True)
print('wrote', args['out'], os.path.getsize(args['out']))
