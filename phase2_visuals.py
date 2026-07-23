#!/usr/bin/env python3
import os
import base64
import json
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFont
import numpy as np

def fig(i):
    os.makedirs('assets/visual', exist_ok=True)
    return f'assets/visual/{i}'

def save_png(path, img):
    img.save(path)
    b64 = base64.b64encode(open(path, 'rb').read()).decode('utf-8')
    return b64

# Palette
BG = '#0B0C10'
DARK = '#1F2833'
GRAY = '#C5C6C7'
CYAN = '#66FCF1'
TEAL = '#45A29E'

# === LAYER 1: SKYLINE (2048x512) ===
# Dark sky gradient + building silhouettes at different depths
palette = [BG, DARK, '#1a2530', '#162329', '#0f1b21']
accent = CYAN

def make_skyline(width=2048, height=512):
    img = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(img)
    
    # Sky gradient
    for y in range(height):
        r = int(11 + (31 - 11) * (y / height) * 0.5)
        g = int(12 + (40 - 12) * (y / height) * 0.5)
        b = int(16 + (51 - 16) * (y / height) * 0.5)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # Far buildings
    random.seed(42)
    x = -random.randint(0, 100)
    while x < width + 200:
        w = random.randint(40, 120)
        h = random.randint(80, 220)
        color = random.choice(palette[1:])
        draw.rectangle([x, height - h, x + w, height], fill=color)
        # windows
        for wy in range(height - h + 10, height - 10, 20):
            for wx in range(x + 5, x + w - 5, 15):
                if random.random() > 0.4:
                    draw.rectangle([wx, wy, wx + 8, wy + 12], fill=BG)
        x += w + random.randint(5, 30)
    
    # Mid buildings
    x = -random.randint(0, 150)
    while x < width + 300:
        w = random.randint(60, 160)
        h = random.randint(120, 320)
        color = random.choice(palette[1:])
        draw.rectangle([x, height - h, x + w, height], fill=color)
        # neon line accent
        if random.random() > 0.5:
            draw.line([(x, height - h + 5), (x + w, height - h + 5)], fill=TEAL, width=2)
        x += w + random.randint(10, 50)
    
    # Foreground buildings (silhouette)
    x = -random.randint(0, 200)
    while x < width + 400:
        w = random.randint(80, 200)
        h = random.randint(200, 420)
        draw.rectangle([x, height - h, x + w, height], fill=BG)
        x += w + random.randint(5, 40)
    
    return img

# === LAYER 2: GROUND + LANES (2048x256) ===
def make_ground(width=2048, height=256):
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Ground base
    draw.rectangle([0, height//3, width, height], fill=DARK)
    
    # Road surface
    draw.rectangle([0, height//3, width, height], fill='#11151c')
    
    # Lane markers
    for y in range(height//3 + 40, height - 20, 60):
        for x in range(0, width, 80):
            draw.line([(x, y), (x+40, y)], fill=TEAL, width=2)
    
    # Grid lines
    for x in range(0, width, 100):
        draw.line([(x, height//3), (x, height)], fill='#1e2a35', width=1)
    
    # Neon edge glow
    draw.line([(0, height//3), (width, height//3)], fill=CYAN, width=3)
    
    # Perspective hints
    for i in range(0, width, 50):
        shade = int(20 + (i / width) * 15)
        draw.line([(i, height), (i + (i - width/2) * 0.02, height//3)], fill=f'#{shade:02x}{shade+5:02x}{shade+10:02x}', width=1)
    
    return img

# === PLAYER SPRITE SHEET 48x48 per frame ===
# Frames: idle-breath, run x6, jump, fall, duck, hurt-flash
def make_player_frame(width=48, height=48):
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Body
    body_w, body_h = 16, 22
    bx, by = 16, 12
    draw.rounded_rectangle([bx, by, bx + body_w, by + body_h], radius=4, fill='#1a2530', outline=CYAN, width=1)
    
    # Head
    head_r = 9
    hx, hy = 24, 8
    draw.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r], fill='#1a2530', outline=CYAN, width=1)
    
    # Visor
    draw.arc([hx - 7, hy - 2, hx + 7, hy + 4], start=0, end=180, fill=CYAN, width=2)
    
    # Arms
    draw.line([(16, 18), (10, 32)], fill=TEAL, width=3)
    draw.line([(32, 18), (38, 32)], fill=TEAL, width=3)
    
    # Legs
    draw.line([(20, 34), (18, 46)], fill=TEAL, width=3)
    draw.line([(28, 34), (30, 46)], fill=TEAL, width=3)
    
    return img

def make_sprite_sheet():
    frames = ['idle-breath'] + [f'run{i}' for i in range(6)] + ['jump', 'fall', 'duck', 'hurt-flash']
    frame_w, frame_h = 48, 48
    cols = 12
    rows = 1
    sheet = Image.new('RGBA', (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    
    for i, name in enumerate(frames):
        x = (i % cols) * frame_w
        y = (i // cols) * frame_h
        if x + frame_w > sheet.width or y + frame_h > sheet.height:
            raise SystemExit(f'Frame {name} at {x},{y} exceeds sheet {sheet.size}')
        frame = make_player_frame(frame_w, frame_h)
        sheet.paste(frame, (x, y))
    
    # Also save atlas JSON
    atlas = {}
    for i, name in enumerate(frames):
        atlas[name] = {
            "x": (i % cols) * frame_w,
            "y": (i // cols) * frame_h,
            "w": frame_w,
            "h": frame_h
        }
    
    return sheet, atlas

# === UI SPRITES ===
def make_score_digit(value='0'):
    img = Image.new('RGBA', (12, 20), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # simple 7-segment style using lines
    segments = {
        '0': [(2,2),(10,2),(10,10),(10,18),(2,18),(2,10)],
        '1': [(6,2),(6,18)],
        '2': [(2,2),(10,2),(10,10),(2,10),(2,18),(10,18)],
        '3': [(2,2),(10,2),(10,10),(10,18),(2,18)],
        '4': [(2,2),(2,10),(10,10),(10,2),(10,18)],
        '5': [(10,2),(2,2),(2,10),(10,10),(10,18),(2,18)],
        '6': [(10,2),(2,2),(2,10),(10,10),(2,18),(10,18)],
        '7': [(2,2),(10,2),(10,18)],
        '8': [(2,2),(10,2),(2,10),(10,10),(2,18),(10,18),(10,2)],
        '9': [(10,2),(2,2),(2,10),(10,18),(10,10),(2,18)],
    }
    pts = segments.get(value, [(2,2),(10,2)])
    for i in range(0, len(pts)-1, 2):
        draw.line([pts[i], pts[i+1]], fill=CYAN, width=2)
    return img

# Coin sprite
def make_coin():
    img = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, 22, 22], outline=CYAN, width=2)
    draw.text((8, 6), '$', fill=CYAN)
    return img

# Obstacle sprites
def make_obstacle(type='barrier'):
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if type == 'barrier':
        draw.rectangle([4, 8, 28, 24], fill='#333', outline=TEAL, width=2)
        draw.polygon([(4,8), (16,4), (28,8)], fill='#222')
    elif type == 'barrier_top':
        draw.rectangle([4, 4, 28, 12], fill='#333', outline=TEAL, width=2)
    elif type == 'crate':
        draw.rectangle([2, 2, 30, 30], fill='#2a1a1a', outline='#ff4444', width=2)
        draw.rectangle([6, 6, 26, 26], fill='#1a0a0a')
    return img

# === BUTTON STATES ===
def make_button(state='normal'):
    img = Image.new('RGBA', (200, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    colors = {
        'normal': (DARK, CYAN),
        'hover': ('#2a3a4a', '#99ffff'),
        'pressed': (BG, TEAL),
    }
    bg, fg = colors.get(state, colors['normal'])
    draw.rounded_rectangle([2, 2, 198, 46], radius=8, fill=bg, outline=fg, width=2)
    return img

# === UI OVERLAY ===
def make_game_over_panel():
    img = Image.new('RGBA', (360, 280), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([10, 10, 350, 270], radius=12, fill=(11, 12, 16, 220), outline=CYAN, width=2)
    # Title
    draw.text((87, 40), 'GAME OVER', fill=CYAN)
    # Score text
    draw.text((120, 100), 'SCORE  0', fill=GRAY)
    draw.text((105, 140), 'BEST   0', fill=TEAL)
    # Retry button
    draw.rounded_rectangle([130, 200, 230, 240], radius=6, fill=DARK, outline=CYAN, width=2)
    draw.text((155, 212), 'RETRY', fill=CYAN)
    return img

# Generate all visuals
assets = {}
assets['layer1_skyline'] = save_png(fig('layer1_skyline.png'), make_skyline())
assets['layer2_ground'] = save_png(fig('layer2_ground.png'), make_ground())
sheet, atlas = make_sprite_sheet()
assets['spritesheet'] = save_png(fig('spritesheet.png'), sheet)
assets['atlas'] = atlas

# Save atlas JSON
with open(fig('atlas.json'), 'w') as f:
    json.dump(atlas, f)

assets['coin'] = save_png(fig('coin.png'), make_coin())
assets['obstacle'] = save_png(fig('obstacle.png'), make_obstacle('barrier'))
assets['obstacle_top'] = save_png(fig('obstacle_top.png'), make_obstacle('barrier_top'))
assets['obstacle_crate'] = save_png(fig('obstacle_crate.png'), make_obstacle('crate'))
assets['btn_normal'] = save_png(fig('btn_normal.png'), make_button('normal'))
assets['btn_hover'] = save_png(fig('btn_hover.png'), make_button('hover'))
assets['btn_pressed'] = save_png(fig('btn_pressed.png'), make_button('pressed'))
assets['gameover_panel'] = save_png(fig('gameover_panel.png'), make_game_over_panel())

print(f"Generated {len(assets)} visual assets.")

# Save manifest
# simple getsize
sizes = {}
for k in assets:
    if isinstance(assets[k], str) and len(assets[k]) > 50:
        sizes[k] = len(assets[k])
    else:
        sizes[k] = sys.getsizeof(assets[k])
with open(fig('visual_manifest.json'), 'w') as f:
    json.dump({'assets': sizes}, f)
print("Visual manifest saved.")
