#!/usr/bin/env python3
import os
import math
import base64
import json
import numpy as np
from scipy.io import wavfile

SR = 44100

def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))

def write_wav(path: str, samples: np.ndarray, normalize_lufs=-14):
    samples = np.clip(samples, -1.0, 1.0)
    if samples.ndim == 1:
        samples = np.stack([samples, samples], axis=-1)
    elif samples.shape[-1] == 1:
        samples = np.repeat(samples, 2, axis=-1)
    rms = np.sqrt(np.mean(samples ** 2))
    if rms > 1e-9:
        lufs = 20 * math.log10(rms)
        gain = 10 ** ((normalize_lufs - lufs) / 20)
        samples = samples * gain
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)
    wavfile.write(path, SR, int_samples)
    print(f"Wrote {path} ({int_samples.shape[0]} frames, rms ~{rms:.4f})")

def note_seq_to_freqs(seq):
    return [(midi_to_freq(m), dur) for m, dur in seq]

# Simple synthwave music generator
def synth_bass(freq, t, decay=1.5):
    wave = np.sin(2 * np.pi * freq * t) * 0.6 + np.sin(2 * np.pi * freq * 2 * t) * 0.4
    env = np.exp(-decay * t)
    return wave * env

def synth_lead(freq, t, decay=0.8):
    saw = 2 * ((freq * t) % 1.0) - 1.0
    sq = np.sign(np.sin(2 * np.pi * freq * t))
    wave = (saw * 0.5 + sq * 0.5)
    env = np.exp(-decay * t)
    return wave * env * 0.4

def synth_pad(freq, t, decay=2.0):
    s1 = np.sin(2 * np.pi * freq * t)
    s2 = np.sin(2 * np.pi * freq * 1.005 * t)
    env = np.exp(-decay * t)
    return np.clip((s1 + s2) * 0.5, -1, 1) * env * 0.2

def synth_kick(t, decay=40):
    f = 150 * np.exp(-30 * t) + 40
    phase = 2 * math.pi * np.cumsum(f) / SR
    env = np.exp(-decay * t)
    return np.sin(phase) * env * 0.8

def synth_hihat(t):
    env = np.exp(-40 * t)
    noise = np.random.rand(len(t)) * 2 - 1
    return noise * env * 0.15

def synth_noise_burst(t, decay=20):
    env = np.exp(-decay * t)
    return np.random.rand(len(t)) * 2 - 1 * env

def make_track(bpm=120, bars=4, key=48, mode='minor'):
    beat = 60 / bpm
    total = bars * 4 * beat
    samples = np.zeros(int(total * SR))
    t = np.linspace(0, total, len(samples))
    
    # chord progression
    chords = [
        [0, 3, 7],   # i
        [5, 8, 12],  # iv
        [7, 10, 14], # V
        [0, 3, 7],   # i
    ]
    bass_line = [0, 0, 5, 5, 7, 7, 0, 0]  # scale degrees
    
    for bar in range(bars):
        chord = chords[bar % len(chords)]
        for beat_idx in range(4):
            start = (bar * 4 + beat_idx) * beat
            if start >= total:
                continue
            idx_start = int(start * SR)
            beat_samples = int(beat * SR)
            local_t = t[idx_start:idx_start+beat_samples] - start
            
            bass_note = bass_line[(bar * 4 + beat_idx) % len(bass_line)]
            bass_freq = midi_to_freq(key + bass_note - 12)
            
            bass = synth_bass(bass_freq, local_t[:len(local_t)])
            samples[idx_start:idx_start+len(bass)] += bass
            
            # lead on offbeats
            if beat_idx % 2 == 1:
                lead_note = bass_line[(bar * 4 + beat_idx) % len(bass_line)] + 12
                lead_freq = midi_to_freq(key + lead_note)
                lead = synth_lead(lead_freq, local_t[:len(local_t)])
                samples[idx_start:idx_start+len(lead)] += lead
            
            # hihat
            hh = synth_hihat(local_t[:int(0.05 * SR)])
            if len(hh) > 0:
                samples[idx_start:idx_start+len(hh)] += hh
            
            # kick on 1 and 3
            if beat_idx in [0, 2]:
                kick_samples = int(0.2 * SR)
                local_kick_t = np.linspace(0, 0.2, kick_samples)
                kick = synth_kick(local_kick_t)
                if idx_start + len(kick) <= len(samples):
                    samples[idx_start:idx_start+len(kick)] += kick
    
    # pad layer
    for bar in range(bars):
        chord = chords[bar % len(chords)]
        start = bar * 4 * beat
        idx_start = int(start * SR)
        bar_samples = int(4 * beat * SR)
        local_t = np.linspace(0, 4*beat, bar_samples)
        pad = np.zeros(bar_samples)
        for note in chord:
            freq = midi_to_freq(key + note)
            pad += synth_pad(freq, local_t)
        if idx_start + len(pad) <= len(samples):
            samples[idx_start:idx_start+len(pad)] += pad
    
    # normalize
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples / peak * 0.7
    
    return samples

def make_gameplay_track(bpm=140, bars=8, key=48):
    beat = 60 / bpm
    total = bars * 4 * beat
    samples = np.zeros(int(total * SR))
    t = np.linspace(0, total, len(samples))
    
    # driving bassline
    bass_notes = [0, 0, 3, 5, 7, 5, 3, 0] * 2
    for i, note in enumerate(bass_notes):
        if i >= bars * 4:
            break
        start = i * beat
        note_samples = int(beat * SR)
        local_t = np.linspace(0, beat, note_samples)
        freq = midi_to_freq(key + note - 12)
        bass = synth_bass(freq, local_t, decay=2.0) * 0.7
        idx_start = int(start * SR)
        if idx_start + len(bass) <= len(samples):
            samples[idx_start:idx_start+len(bass)] += bass
    
    # fast arpeggio
    arp_pattern = [0, 4, 7, 12, 7, 4] * 4
    step = beat / 2
    for i, note in enumerate(arp_pattern):
        start = i * step
        if start >= total:
            break
        note_samples = int(step * SR)
        local_t = np.linspace(0, step, note_samples)
        freq = midi_to_freq(key + note)
        lead = synth_lead(freq, local_t, decay=0.4) * 0.35
        idx_start = int(start * SR)
        if idx_start + len(lead) <= len(samples):
            samples[idx_start:idx_start+len(lead)] += lead
    
    # kick
    for i in range(bars * 4):
        start = i * beat
        kick_samples = int(0.15 * SR)
        local_t = np.linspace(0, 0.15, kick_samples)
        kick = synth_kick(local_t)
        idx_start = int(start * SR)
        if idx_start + len(kick) <= len(samples):
            samples[idx_start:idx_start+len(kick)] += kick
    
    # hats
    for i in range(bars * 8):
        start = i * (beat / 2)
        if start >= total:
            break
        hh_samples = int(0.03 * SR)
        local_t = np.linspace(0, 0.03, hh_samples)
        hh = synth_hihat(local_t) * 0.5
        idx_start = int(start * SR)
        if idx_start + len(hh) <= len(samples):
            samples[idx_start:idx_start+len(hh)] += hh
    
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples / peak * 0.7
    return samples

def make_gameover_sting(bpm=120, bars=2, key=48):
    beat = 60 / bpm
    total = bars * 4 * beat
    samples = np.zeros(int(total * SR))
    t = np.linspace(0, total, len(samples))
    
    # descending resolution
    melody = [12, 10, 7, 5, 3, 0]
    note_dur = beat * 2
    for i, note in enumerate(melody):
        start = i * note_dur
        if start >= total:
            break
        idx_start = int(start * SR)
        note_samples = int(note_dur * SR)
        local_t = np.linspace(0, note_dur, note_samples)
        freq = midi_to_freq(key + note)
        tone = np.sin(2 * math.pi * freq * local_t) * np.exp(-1.5 * local_t) * 0.5
        samples[idx_start:idx_start+note_samples] += tone
    
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples / peak * 0.7
    return samples

# Assets for phase 3
os.makedirs('assets/audio', exist_ok=True)

# Menu 30s
menu = make_track(bpm=118, bars=8, key=45)  # A minor-ish
repeat = int(np.ceil((30 * SR) / len(menu)))
menu_long = np.tile(menu, repeat)[:30 * SR]
write_wav('assets/audio/menu_loop.wav', menu_long, normalize_lufs=-16)

# Gameplay 60s 
gp = make_gameplay_track(bpm=142, bars=8, key=48)
repeat = int(np.ceil((60 * SR) / len(gp)))
gp_long = np.tile(gp, repeat)[:60 * SR]
write_wav('assets/audio/gameplay_loop.wav', gp_long, normalize_lufs=-16)

# Gameover sting
go = make_gameover_sting(bpm=110, bars=2, key=45)
write_wav('assets/audio/gameover_sting.wav', go, normalize_lufs=-16)

# SFX
def make_jump():
    t = np.linspace(0, 0.15, int(0.15 * SR))
    freq = np.linspace(300, 800, len(t))
    phase = 2*np.pi*np.cumsum(freq)/SR
    samples = np.sin(phase) * np.exp(-15*t) * 0.5
    return samples

def make_double_jump():
    t1 = np.linspace(0, 0.06, int(0.06 * SR))
    t2 = np.linspace(0, 0.06, int(0.06 * SR))
    p1 = 2*np.pi*np.cumsum(np.full(len(t1), 660))/SR
    p2 = 2*np.pi*np.cumsum(np.full(len(t2), 880))/SR
    s1 = np.sin(p1) * np.exp(-25*t1) * 0.4
    s2 = np.sin(p2) * np.exp(-25*t2) * 0.4
    return np.concatenate([s1, np.zeros(int(0.01*SR)), s2])

def make_hit():
    t = np.linspace(0, 0.25, int(0.25 * SR))
    noise = np.random.rand(len(t)) * 2 - 1
    thud = np.sin(2*np.pi*40*t) * np.exp(-20*t) * 0.6
    samples = (noise * 0.5 + thud) * np.exp(-12*t)
    return samples

def make_coin():
    t = np.linspace(0, 0.1, int(0.1 * SR))
    p1 = 2*np.pi*np.cumsum(np.full(len(t), 1200))/SR
    p2 = 2*np.pi*np.cumsum(np.full(len(t), 1800))/SR
    s = (np.sin(p1) * 0.5 + np.sin(p2) * 0.5) * np.exp(-30*t) * 0.4
    return s

def make_ui_hover():
    t = np.linspace(0, 0.06, int(0.06 * SR))
    p = 2*np.pi*np.cumsum(np.full(len(t), 2000))/SR
    return np.sin(p) * np.exp(-60*t) * 0.2

def make_ui_confirm():
    t = np.linspace(0, 0.08, int(0.08 * SR))
    p1 = 2*np.pi*np.cumsum(np.full(len(t), 660))/SR
    p2 = 2*np.pi*np.cumsum(np.full(len(t), 880))/SR
    return (np.sin(p1) * 0.4 + np.sin(p2) * 0.3) * np.exp(-40*t)

sfx = {
    'jump.wav': make_jump(),
    'double_jump.wav': make_double_jump(),
    'hit.wav': make_hit(),
    'coin_collect.wav': make_coin(),
    'ui_hover.wav': make_ui_hover(),
    'ui_confirm.wav': make_ui_confirm(),
}
for name, samples in sfx.items():
    write_wav(f'assets/audio/{name}', samples, normalize_lufs=-16)

print("Audio assets generated.")
