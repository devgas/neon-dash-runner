#!/usr/bin/env python3
import base64, json, os

audio_dir = 'assets/audio'
out = {}

for name in os.listdir(audio_dir):
    if not name.endswith('.wav'):
        continue
    path = os.path.join(audio_dir, name)
    out[name] = base64.b64encode(open(path, 'rb').read()).decode('utf-8')

with open('assets/audio/audio_base64.json', 'w') as f:
    json.dump(out, f)

print('Encoded', len(out), 'audio files.')
