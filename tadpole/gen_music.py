#!/usr/bin/env python3
"""T13: 90秒配乐生成 — 水墨粒子风格"""
import numpy as np, struct, sys

SR = 44100
DUR = 90
N = SR * DUR

def note_freq(note, octave):
    semitones = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
    return 440 * 2**((semitones[note] + (octave-4)*12 - 9)/12)

def sine(f, t, amp=1.0):
    return amp * np.sin(2*np.pi*f*t)

def piano_tone(freq, t, dur=2.0, amp=0.3):
    env = np.exp(-t*2.5) * (t > 0) * (t < dur)
    tone = sine(freq, t, amp)
    tone += sine(freq*2, t, amp*0.3) * np.exp(-t*4)
    tone += sine(freq*3, t, amp*0.1) * np.exp(-t*6)
    return tone * env

def flute_tone(freq, t, dur=2.0, amp=0.15):
    env = np.clip(t*20, 0, 1) * np.exp(-t*1.5) * (t > 0) * (t < dur)
    vibrato = sine(5, t, 0.003)
    tone = sine(freq*(1+vibrato), t, amp)
    tone += sine(freq*2, t, amp*0.15)
    return tone * env

def string_tone(freq, t, dur=3.0, amp=0.08):
    env = np.clip(t*5, 0, 1) * np.exp(-t*0.8) * (t > 0) * (t < dur)
    vibrato = sine(4.5, t, 0.004)
    tone = sine(freq*(1+vibrato), t, amp)
    tone += sine(freq*1.005, t, amp*0.7)  # chorus
    tone += sine(freq*2, t, amp*0.2)
    return tone * env

def harp_tone(freq, t, dur=2.0, amp=0.12):
    env = np.exp(-t*3) * (t > 0) * (t < dur)
    tone = sine(freq, t, amp)
    tone += sine(freq*2, t, amp*0.4) * np.exp(-t*5)
    tone += sine(freq*3, t, amp*0.15) * np.exp(-t*7)
    return tone * env

def water_drop(t0, buf, sr):
    """水滴音效"""
    idx = int(t0*sr)
    for i in range(min(int(0.3*sr), len(buf)-idx)):
        t = i/sr
        env = np.exp(-t*15)
        freq = 2000 * np.exp(-t*8) + 800
        buf[idx+i] += np.sin(2*np.pi*freq*t) * env * 0.2

t = np.arange(N) / SR
out = np.zeros(N, dtype=np.float64)

# 水滴音效 (0-2s)
water_drop(0.5, out, SR)
water_drop(1.0, out, SR)
water_drop(1.4, out, SR)

# 6段情绪配乐
# P1: 0-16s 空灵钢琴 — 宁静诞生
p1_notes = [
    ('C',5, 2, 3), ('E',5, 5, 3), ('G',4, 8, 3), ('A',4, 11, 3),
    ('D',5, 2.5, 2.5), ('F#',5, 5.5, 2.5),
    ('C',5, 4, 2), ('E',5, 7, 2), ('G',5, 10, 2.5), ('B',4, 13, 2.5),
    ('A',4, 6, 3), ('D',5, 9, 3), ('E',5, 12, 3), ('G',4, 14.5, 1.5),
]
for note, oct, start, dur in p1_notes:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += piano_tone(f, local_t, dur, 0.25)

# P2: 16-28s 钢琴+笛子 — 好奇探索
p2_piano = [
    ('D',5, 16, 2.5), ('F#',5, 19, 2.5), ('A',5, 22, 2.5), ('E',5, 25, 2.5),
    ('B',4, 17, 2), ('D',5, 20, 2), ('G',5, 23, 2), ('C#',5, 26, 2),
]
for note, oct, start, dur in p2_piano:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += piano_tone(f, local_t, dur, 0.2)

p2_flute = [
    ('A',5, 18, 2), ('B',5, 21, 2), ('D',6, 24, 2.5), ('A',5, 26.5, 1.5),
]
for note, oct, start, dur in p2_flute:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += flute_tone(f, local_t, dur, 0.12)

# P3: 28-44s 笛子低沉+弦乐 — 迷茫焦虑
p3_flute = [
    ('E',4, 29, 3), ('D',4, 33, 3), ('C',4, 37, 3), ('B',3, 41, 2.5),
    ('F',4, 31, 2), ('E',4, 35, 2), ('D',4, 39, 2),
]
for note, oct, start, dur in p3_flute:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += flute_tone(f, local_t, dur, 0.1)

p3_strings = [
    ('A',3, 30, 4), ('D',3, 34, 4), ('G',3, 38, 4), ('C',3, 42, 2),
    ('E',3, 32, 3), ('A',3, 36, 3), ('D',4, 40, 3),
]
for note, oct, start, dur in p3_strings:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += string_tone(f, local_t, dur, 0.08)

# P4: 44-58s 弦乐渐强+竖琴滑音 — 蜕变惊喜
p4_strings = [
    ('C',4, 45, 4), ('E',4, 45, 4), ('G',4, 45, 4),  # C major chord
    ('D',4, 49, 4), ('F#',4, 49, 4), ('A',4, 49, 4),  # D major
    ('E',4, 53, 4), ('G#',4, 53, 4), ('B',4, 53, 4),  # E major
]
for note, oct, start, dur in p4_strings:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += string_tone(f, local_t, dur, 0.1)

# 竖琴滑音
for i, start in enumerate([46, 47, 48, 50, 51, 54, 55]):
    for j, note in enumerate(['C','D','E','G','A']):
        f = note_freq(note, 5 + (j > 2))
        t0 = start + j*0.15
        mask = (t >= t0) & (t < t0+1.5)
        local_t = t[mask] - t0
        out[mask] += harp_tone(f, local_t, 1.5, 0.08)

# P5: 58-82s 全编制温暖和弦 — 团聚
p5_chords = [
    (['C','E','G','B'], 4, 59, 6),   # Cmaj7
    (['F','A','C','E'], 4, 65, 5),   # Fmaj7
    (['G','B','D','F#'], 4, 70, 5),  # Gmaj7
    (['C','E','G'], 4, 75, 6),       # C major
]
for notes, oct, start, dur in p5_chords:
    for note in notes:
        for o in [oct, oct+1]:
            f = note_freq(note, o)
            mask = (t >= start) & (t < start+dur)
            local_t = t[mask] - start
            out[mask] += string_tone(f, local_t, dur, 0.06)
    # 钢琴旋律
    for i, note in enumerate(notes):
        f = note_freq(note, 5)
        t0 = start + i*0.8
        mask = (t >= t0) & (t < t0+2)
        local_t = t[mask] - t0
        out[mask] += piano_tone(f, local_t, 2, 0.15)

# P6: 82-90s 钢琴独奏收束 — 余韵
p6_notes = [
    ('E',5, 83, 3), ('G',5, 86, 2), ('C',5, 88, 2),
    ('D',5, 84, 2.5), ('B',4, 87, 2.5),
]
for note, oct, start, dur in p6_notes:
    f = note_freq(note, oct)
    mask = (t >= start) & (t < start+dur)
    local_t = t[mask] - start
    out[mask] += piano_tone(f, local_t, dur, 0.2)

# 归一化
peak = np.max(np.abs(out))
if peak > 0:
    out = out / peak * 0.85

# 淡入淡出
fade_in = int(0.5*SR)
fade_out = int(2*SR)
out[:fade_in] *= np.linspace(0, 1, fade_in)
out[-fade_out:] *= np.linspace(1, 0, fade_out)

# 写WAV
samples = (out * 32767).astype(np.int16)
with open('/root/.hermes/workspace/tadpole/music.wav', 'wb') as f:
    f.write(b'RIFF')
    data_size = N * 2
    f.write(struct.pack('<I', 36 + data_size))
    f.write(b'WAVE')
    f.write(b'fmt ')
    f.write(struct.pack('<IHHIIHH', 16, 1, 1, SR, SR*2, 2, 16))
    f.write(b'data')
    f.write(struct.pack('<I', data_size))
    f.write(samples.tobytes())

print(f"Music generated: {DUR}s, {SR}Hz, {len(out)} samples, {peak:.3f} peak")
