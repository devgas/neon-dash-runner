#!/usr/bin/env python3
import os
import math
import base64
import json
import re
import subprocess
import shlex
from pathlib import Path

import numpy as np
from scipy.io import wavfile

SR = 44100

def shell_quote(s):
    return shlex.quote(s)

def write_wav(path: Path, samples: np.ndarray, target_lufs=-16):
    samples = np.clip(samples, -1.0, 1.0)
    if samples.ndim == 1:
        samples = np.stack([samples, samples], axis=-1)
    elif samples.shape[-1] == 1:
        samples = np.repeat(samples, 2, axis=-1)
    current_rms = np.sqrt(np.mean(samples ** 2))
    if current_rms > 1e-9:
        lufs = 20 * math.log10(current_rms)
        adjustment = 10 ** ((target_lufs - lufs) / 20)
        samples = samples * adjustment
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)
    wavfile.write(str(path), SR, int_samples)
    print(f"Wrote {path} ({int_samples.shape[0]} frames)")

def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))

def note_name_to_freq(name):
    m = re.match(r"([A-Ga-g])(#?)(\d+)", name)
    if not m:
        raise ValueError(f"Bad note: {name}")
    note = m.group(1).upper()
    octave = int(m.group(3))
    semitones = {"C":0,"D":2,"E":4,"F":5,"G":7,"A":9,"B":11}[note]
    if m.group(2) == "#":
        semitones += 1
    midi = (octave+1)*12 + semitones
    return midi_to_freq(midi)

def synth_tone(freq, t, kind="sine", harmonics=None):
    if harmonics:
        s = np.zeros_like(t)
        for amp, mul in harmonics:
            s += amp * np.sin(2 * np.pi * freq * mul * t)
        return s
    if kind == "sine":
        return np.sin(2 * np.pi * freq * t)
    elif kind == "square":
        return np.sign(np.sin(2 * np.pi * freq * t))
    elif kind == "sawtooth":
        return 2 * ((freq * t) % 1.0) - 1.0
    elif kind == "triangle":
        return 2 * np.abs(2 * ((freq * t) % 1.0) - 1.0) - 1.0
    raise ValueError(kind)

def adsr_env(duration, a=0.01, d=0.1, s=0.7, r=0.1):
    n = int(duration * SR)
    total = np.zeros(n)
    def idx(t):
        return int(t * SR)
    att = np.linspace(0, 1, idx(a))
    rel = np.linspace(1, 0, idx(r))
    decay = np.linspace(1, s, idx(d - a) if d > a else 0)
    sus_len = n - idx(r) - idx(d) if n > idx(r) + idx(d) else 0
    sus = np.full(max(0, sus_len), s)
    env = np.concatenate([att, decay, sus, rel])
    total[:len(env)] = env
    return total

def resample(signal, orig_sr, target_sr):
    duration = len(signal) / orig_sr
    new_len = int(duration * target_sr)
    t_old = np.linspace(0, duration, len(signal))
    t_new = np.linspace(0, duration, new_len)
    return np.interp(t_new, t_old, signal)

# ==================== MUSIC TRACKS ====================

def gen_menu_loop(note_seq, tempo=120, bars=8):
    beat_dur = 60.0 / tempo
    total_beats = bars * 4
    total = total_beats * beat_dur
    t = np.linspace(0, total, int(total * SR))
    out = np.zeros_like(t)
    bass = np.zeros_like(t)
    for i, (n, dur_beats) in enumerate(note_seq):
        freq = note_name_to_freq(n)
        start = i * beat_dur
        end = start + dur_beats * beat_dur
        mask = (t >= start) & (t < end)
        sub = synth_tone(freq / 2, t[mask] - start, kind="sine") * adsr_env(dur_beats * beat_dur, 0.05, 0.05, 0.8, 0.1)
        bass[mask] += sub * 0.6
        lead = synth_tone(freq, t[mask] - start, kind="triangle") * 0.4
        pads = (synth_tone(freq, t[mask] - start, harmonics=[(0.5,1),(0.3,2),(0.2,3)]) + synth_tone(freq*1.5, t[mask] - start, harmonics=[(0.3,1)]) * 0.5)
        out[mask] += pads * adsr_env(dur_beats * beat_dur, 0.2, 0.3, 0.6, 0.4) * 0.3 + lead * adsr_env(dur_beats * beat_dur, 0.05, 0.1, 0.7, 0.2)
    out += bass * 0.7
    for b in range(8, total_beats, 2):
        if b % 4 == 0:
            continue
        start = b * beat_dur
        mask = (t >= start) & (t < start + 0.05)
        noise = np.random.randn(int(np.sum(mask))) * 0.05
        envelope = np.linspace(1, 0, len(noise))
        out[mask] += noise * envelope
    delay = int(0.25 * SR)
    delayed = np.zeros_like(out)
    delayed[delay:] = out[:-delay] * 0.4
    return out + delayed, total, SR

def gen_gameplay_loop(bpm=120, bars=24):
    beat = 60.0 / bpm
    total = bars * 4 * beat
    t = np.linspace(0, total, int(total * SR))
    out = np.zeros_like(t)
    bass = np.zeros_like(t)
    bass_notes = ["C2","C2","A#1","C2","F2","F2","G2","G2"]
    # Repeat pattern for bars
    bass_notes = (bass_notes * (bars // 2))[:bars * 4]
    for i, n in enumerate(bass_notes):
        freq = note_name_to_freq(n)
        start = i * beat
        dur = beat
        mask = (t >= start) & (t < start + dur)
        tone = synth_tone(freq, t[mask]-start, kind="sawtooth") * adsr_env(dur, 0.02, 0.05, 0.8, 0.05)
        bass[mask] += tone * 0.5
    out += bass
    arp_notes = ["C3","E3","G3","C4","G3","E3"] * (bars * 2)
    step = beat / 2
    for i, n in enumerate(arp_notes[:int(total / step)]):
        freq = note_name_to_freq(n)
        start = i * step
        dur = step * 0.8
        mask = (t >= start) & (t < start + dur)
        tone = (synth_tone(freq, t[mask]-start, kind="square") * 0.3 + synth_tone(freq, t[mask]-start, kind="sine") * 0.7)
        env = adsr_env(dur, 0.005, 0.02, 0.6, 0.1)
        length = int(np.sum(mask))
        if length <= 0:
            continue
        if len(env) < length:
            env = np.pad(env, (0, length - len(env)), mode='edge')
        elif len(env) > length:
            env = env[:length]
        out[mask] += tone * env * 0.35
    for b in range(0, int(bars*4), 4):
        start = b * beat
        if start + 0.3 > total:
            continue
        mask = (t >= start) & (t < start + 0.3)
        kick = np.sin(2 * np.pi * 150 * np.exp(-(t[mask]-start)*30) * (t[mask]-start)) * np.exp(-(t[mask]-start)*20)
        out[mask] += kick * 0.9
    for b in range(8, int(bars*4), 2):
        start = b * beat
        if start + 0.05 > total:
            continue
        mask = (t >= start) & (t < start + 0.05)
        noise = np.random.randn(int(np.sum(mask))) * 0.06
        env = np.linspace(1, 0, len(noise))
        out[mask] += noise * env
    delay = int(0.375 * SR)
    delayed = np.zeros_like(out)
    delayed[delay:] = out[:-delay] * 0.35
    return out + delayed, total, SR

def gen_gameover_sting():
    dur = 8.0
    t = np.linspace(0, dur, int(dur * SR))
    out = np.zeros_like(t)
    notes = [note_name_to_freq(n) for n in ["C4","Bb3","Ab3","G3"]]
    seg = dur / len(notes)
    for i, freq in enumerate(notes):
        start = i * seg
        mask = (t >= start) & (t < start + seg)
        tone = synth_tone(freq, t[mask]-start, kind="triangle") * adsr_env(seg, 0.05, 0.2, 0.7, 0.4)
        out[mask] += tone * 0.8
        sub = synth_tone(freq/2, t[mask]-start, kind="sine") * adsr_env(seg, 0.05, 0.2, 0.7, 0.4)
        out[mask] += sub * 0.6
    mask = (t >= dur - 1.0) & (t < dur)
    noise = np.random.randn(int(np.sum(mask))) * 0.02
    env = np.linspace(0, 1, len(noise))
    out[mask] += noise * env
    return out, dur, SR

def gen_jump():
    dur = 0.15
    t = np.linspace(0, dur, int(dur * SR))
    out = np.zeros_like(t)
    start = 400
    end = 1800
    freq = np.linspace(start, end, len(t))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 25)
    burst = np.sin(2 * np.pi * 220 * t) * np.exp(-t * 50) * 0.5
    out = tone * 0.6 + burst
    return out, dur, SR

def gen_double_jump():
    dur = 0.12
    t = np.linspace(0, dur, int(dur * SR))
    out = np.zeros_like(t)
    for i, (f, d) in enumerate([(880, 0.04), (1320, 0.08)]):
        start = i * 0.06
        mask = (t >= start) & (t < start + d)
        tone = np.sin(2 * np.pi * f * (t[mask]-start)) * np.exp(-(t[mask]-start) * 40)
        out[mask] += tone * 0.6
    return out, dur, SR

def gen_hit():
    dur = 0.25
    t = np.linspace(0, dur, int(dur * SR))
    out = np.zeros_like(t)
    noise = np.random.randn(len(t)) * np.exp(-t * 12)
    thud = np.sin(2 * np.pi * 80 * np.exp(-t * 20) * t) * np.exp(-t * 18)
    out = noise * 0.7 + thud * 0.8
    return out, dur, SR

def gen_coin():
    dur = 0.1
    t = np.linspace(0, dur, int(dur * SR))
    out = np.zeros_like(t)
    for i, f in enumerate([1200, 1800]):
        start = i * 0.05
        mask = (t >= start) & (t < start + 0.05)
        tone = np.sin(2 * np.pi * f * (t[mask]-start)) * np.exp(-(t[mask]-start) * 50)
        out[mask] += tone * 0.6
    return out, dur, SR

def gen_ui_hover():
    dur = 0.06
    t = np.linspace(0, dur, int(dur * SR))
    out = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 80) * 0.3
    return out, dur, SR

def gen_ui_confirm():
    dur = 0.08
    t = np.linspace(0, dur, int(dur * SR))
    out = np.sin(2 * np.pi * 660 * t) * np.exp(-t * 50) * 0.5 + np.sin(2 * np.pi * 880 * t) * np.exp(-t * 40) * 0.3
    return out, dur, SR

AUDIO_DIR = Path("/home/anton/projects/runner/audio")
AUDIO_DIR.mkdir(exist_ok=True)

# Menu: 30s
menu_sig, menu_dur, menu_sr = gen_menu_loop([
    ("C4",2),("Eb4",2),("F4",4),("G4",4),
    ("Ab4",2),("F4",2),("Eb4",4),("C4",4),
]*2)
menu_30 = np.tile(menu_sig, int(np.ceil((30 * SR) / len(menu_sig))))[: int(30 * SR)]
write_wav(AUDIO_DIR / "menu_loop.wav", menu_30, target_lufs=-14)

# Gameplay: 60s
g_sig, _, _ = gen_gameplay_loop(bpm=120, bars=24)
g_60 = np.tile(g_sig, int(np.ceil((60 * SR) / len(g_sig))))[: int(60 * SR)]
write_wav(AUDIO_DIR / "gameplay_loop.wav", g_60, target_lufs=-14)

sting_sig, _, _ = gen_gameover_sting()
write_wav(AUDIO_DIR / "gameover_sting.wav", sting_sig, target_lufs=-14)

write_wav(AUDIO_DIR / "jump.wav", gen_jump()[0], target_lufs=-16)
write_wav(AUDIO_DIR / "double_jump.wav", gen_double_jump()[0], target_lufs=-16)
write_wav(AUDIO_DIR / "hit.wav", gen_hit()[0], target_lufs=-16)
write_wav(AUDIO_DIR / "coin_collect.wav", gen_coin()[0], target_lufs=-16)
write_wav(AUDIO_DIR / "ui_hover.wav", gen_ui_hover()[0], target_lufs=-16)
write_wav(AUDIO_DIR / "ui_confirm.wav", gen_ui_confirm()[0], target_lufs=-16)

manifest = {}
for name in [
    "menu_loop.wav","gameplay_loop.wav","gameover_sting.wav",
    "jump.wav","double_jump.wav","hit.wav","coin_collect.wav",
    "ui_hover.wav","ui_confirm.wav",
]:
    p = AUDIO_DIR / name
    b64 = base64.b64encode(p.read_bytes()).decode("utf-8")
    manifest[name] = b64
    res = subprocess.run(["ffprobe","-v","error","-show_format","-show_streams",str(p)], capture_output=True, text=True)
    print(f"{name}: {res.stdout[:200]}")

with open(AUDIO_DIR / "audio_base64.json", "w") as f:
    json.dump(manifest, f)
print("Done.")
