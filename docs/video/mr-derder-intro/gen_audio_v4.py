#!/usr/bin/env python3
"""5-second cinematic intro audio - precise beat sync."""
import numpy as np, wave, struct, os

SR = 44100
DUR = 5.0
N = int(SR * DUR)
t = np.linspace(0, DUR, N, dtype=np.float64)

audio = np.zeros(N, dtype=np.float64)

# 1. 深沉sub bass - 全程铺垫 (C0=16.35Hz + C1=32.7Hz)
env_in = np.clip(t / 1.0, 0, 1)
env_out = np.clip((DUR - t) / 0.3, 0, 1)
drone_env = env_in * env_out
audio += (np.sin(2*np.pi*32.7*t) * 0.12 + np.sin(2*np.pi*65.4*t) * 0.06) * drone_env

# 2. 上升riser (0.8-1.8s) - 频率从低到高，制造紧张感
riser_env = np.clip((t-0.8)/1.0, 0, 1) * np.clip((1.8-t)/0.2, 0, 1)
riser_freq = np.cumsum(np.linspace(80, 2000, N)) / SR
noise = np.random.randn(N) * 0.02
riser = (np.sin(2*np.pi*riser_freq) * 0.08 + noise) * riser_env
# riser 高频越来越强
riser += np.sin(2*np.pi*np.linspace(400,4000,N)*t) * 0.04 * riser_env
audio += riser

# 3. ★ 冲击beat (1.8s) - 核心卡点！
beat_t = t - 1.8
# 低频冲击
impact_env = np.exp(-beat_t * 6) * (beat_t > 0)
audio += np.sin(2*np.pi*40*t) * 0.5 * impact_env  # 次低音
audio += np.sin(2*np.pi*80*t) * 0.3 * impact_env   # 低音
# 中频打击
hit_env = np.exp(-beat_t * 15) * (beat_t > 0)
audio += np.sin(2*np.pi*200*t) * 0.15 * hit_env
# 噪声瞬态
noise_env = np.exp(-beat_t * 25) * (beat_t > 0)
audio += np.random.randn(N) * 0.08 * noise_env
# 高频 sizzle
sizzle_env = np.exp(-beat_t * 10) * (beat_t > 0)
audio += np.sin(2*np.pi*8000*t) * 0.02 * sizzle_env

# 4. 尾音pad (1.8-4.8s) - 温暖和弦 C-E-G
pad_env = np.clip((t-1.8)/0.3, 0, 1) * np.clip((4.8-t)/0.5, 0, 1)
audio += (np.sin(2*np.pi*261.63*t)*0.03 +   # C4
          np.sin(2*np.pi*329.63*t)*0.025 +   # E4
          np.sin(2*np.pi*392.0*t)*0.02 +     # G4
          np.sin(2*np.pi*523.25*t)*0.012     # C5
         ) * pad_env

# 5. 微妙的shimmer (2.0-4.5s)
shimmer_env = np.clip((t-2.0)/0.5, 0, 1) * np.clip((4.5-t)/0.5, 0, 1)
audio += np.sin(2*np.pi*6000*t) * 0.008 * np.sin(2*np.pi*4*t) * shimmer_env

# Normalize
peak = np.max(np.abs(audio))
if peak > 0:
    audio = audio / peak * 0.88

# To int16
pcm = (audio * 32767).astype(np.int16)

out = os.path.expanduser("~/.hermes/workspace/intro_audio_v4.wav")
with wave.open(out, 'w') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print(f"✅ {out}")
