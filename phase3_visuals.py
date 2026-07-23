#!/usr/bin/env python3
"""Phase 3 visual generation: enemies, hearts, and boss effects."""
import os
import json
import base64
from pathlib import Path
from PIL import Image, ImageDraw

VIS = Path(__file__).resolve().parent / 'assets' / 'visual'
VIS.mkdir(parents=True, exist_ok=True)

def save(name, img):
    p = VIS / name
    img.save(p)
    out = base64.b64encode(p.read_bytes()).decode('utf-8')
    return out

# Enemy sprites
def make_enemy_fly():
    img = Image.new('RGBA', (40, 40), 0)
    d = ImageDraw.Draw(img)
    d.ellipse([8, 12, 32, 28], fill='#2a0a0a', outline='#ff4444', width=2)
    d.polygon([(8, 20), (2, 16), (2, 24)], fill='#ff4444')
    d.polygon([(32, 20), (38, 16), (38, 24)], fill='#ff4444')
    d.ellipse([14, 16, 20, 22], fill='#ff4444')
    d.ellipse([20, 16, 26, 22], fill='#ff4444')
    return img

def make_enemy_ground():
    img = Image.new('RGBA', (44, 44), 0)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 14, 38, 36], radius=6, fill='#1a0a2e', outline='#ff44ff', width=2)
    d.ellipse([12, 8, 32, 24], fill='#1a0a2e', outline='#ff44ff', width=2)
    d.ellipse([16, 12, 20, 18], fill='#ff44ff')
    d.ellipse([24, 12, 28, 18], fill='#ff44ff')
    d.line([(18, 24), (14, 36)], fill='#ff44ff', width=3)
    d.line([(26, 24), (30, 36)], fill='#ff44ff', width=3)
    return img

def make_heart(full=True):
    img = Image.new('RGBA', (24, 24), 0)
    d = ImageDraw.Draw(img)
    color = '#ff4477' if full else '#2a1a25'
    d.polygon([(12, 20), (2, 12), (2, 6), (8, 4), (12, 8), (16, 4), (22, 6), (22, 12)], fill=color, outline=color, width=2)
    return img

# Boss frames
def make_boss_frame(i, total=6):
    img = Image.new('RGBA', (64, 64), 0)
    d = ImageDraw.Draw(img)
    cx = 32
    cy = 32
    pulse = 8 + i * 7
    if pulse > 40:
        pulse = 40
    d.ellipse([cx - pulse, cy - pulse, cx + pulse, cy + pulse], fill=(255, 68, 68, 160))
    d.ellipse([cx - pulse + 6, cy - pulse + 6, cx + pulse - 6, cy + pulse - 6], fill=(255, 160, 160, 110))
    if i % 2 == 0:
        d.rectangle([0, cy - 2, 64, cy + 3], fill=(102, 252, 241, 90))
        d.rectangle([0, cy - 1, 64, cy + 2], fill=(102, 252, 241, 130))
    return img

assets = {}
assets['enemy_fly'] = save('enemy_fly.png', make_enemy_fly())
assets['enemy_ground'] = save('enemy_ground.png', make_enemy_ground())
assets['heart_full'] = save('heart_full.png', make_heart(True))
assets['heart_empty'] = save('heart_empty.png', make_heart(False))
for i in range(6):
    assets[f'boss_{i}.png'] = save(f'boss_{i}.png', make_boss_frame(i))

print(f"Generated {len(assets)} new visual assets.")
print(json.dumps({k: len(v) for k, v in assets.items()}, indent=2))
