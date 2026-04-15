#!/usr/bin/env python3
"""为5个转场生成音效 - 统一风格：短促 whoosh + impact"""
import numpy as np, wave, struct, os

SR = 44100

def gen_transition_audio(dur, idx, out_path):
    N = int(SR * dur)
    t = np.linspace(0, dur, N, dtype=np.float64)
    audio = np.zeros(N, dtype=np.float64)

    # 1. 基底sub bass
    env = np.clip(t/0.1, 0, 1) * np.clip((dur-t)/0.3, 0, 1)
    audio += np.sin(2*np.pi*40*t) * 0.08 * env

    # 2. Whoosh riser (前60%)
    riser_end = dur * 0.55
    riser_env = np.clip(t/0.05, 0, 1) * np.clip((riser_end-t)/(riser_end*0.3), 0, 1)
    freq_rise = np.cumsum(np.linspace(100, 3000 + idx*200, N)) / SR
    audio += np.sin(2*np.pi*freq_rise) * 0.06 * riser_env
    # 噪声层
    noise = np.random.randn(N) * 0.02 * riser_env
    audio += noise

    # 3. Impact hit (在55%处)
    hit_time = dur * 0.55
    ht = t - hit_time
    impact_env = np.exp(-ht * 8) * (ht > 0)
    audio += np.sin(2*np.pi*(60+idx*10)*t) * 0.35 * impact_env
    audio += np.sin(2*np.pi*(120+idx*20)*t) * 0.2 * impact_env
    # 瞬态噪声
    hit_noise_env = np.exp(-ht * 20) * (ht > 0)
    audio += np.random.randn(N) * 0.1 * hit_noise_env

    # 4. Shimmer tail (后40%)
    tail_env = np.clip((t-hit_time)/0.1, 0, 1) * np.clip((dur-t)/0.4, 0, 1)
    shimmer_freq = [523, 659, 784, 880][idx % 4]  # C5, E5, G5, A5
    audio += np.sin(2*np.pi*shimmer_freq*t) * 0.025 * tail_env
    audio += np.sin(2*np.pi*(shimmer_freq*1.5)*t) * 0.015 * tail_env

    # 5. 高频 sizzle (微弱)
    sizzle_env = np.clip((t-hit_time)/0.05, 0, 1) * np.clip((dur-t)/0.5, 0, 1) * (t > hit_time)
    audio += np.sin(2*np.pi*6000*t) * 0.008 * sizzle_env

    # Normalize
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.85

    pcm = (audio * 32767).astype(np.int16)
    with wave.open(out_path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    print(f"  ✅ {os.path.basename(out_path)} ({dur}s, {len(pcm)/SR:.1f}s)")

# 转场时长列表
durations = [1.8, 2.0, 1.8, 1.5, 2.0]
out_dir = os.path.expanduser("~/.hermes/workspace/transitions/audio")
os.makedirs(out_dir, exist_ok=True)

print("🎵 Generating transition audio...")
for i, dur in enumerate(durations):
    out = os.path.join(out_dir, f"t{i+1}.wav")
    gen_transition_audio(dur, i, out)

print("\n✅ All transition audio generated!")
