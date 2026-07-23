#!/usr/bin/env python3
import base64, json, os

vis_dir = 'assets/visual'
out = {}
for name in os.listdir(vis_dir):
    if not name.endswith('.png'):
        continue
    path = os.path.join(vis_dir, name)
    out[name] = base64.b64encode(open(path, 'rb').read()).decode('utf-8')
with open('assets/visual/visual_base64.json', 'w') as f:
    json.dump(out, f)
print('Encoded', len(out), 'visual files.')
