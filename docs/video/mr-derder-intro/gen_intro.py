#!/usr/bin/env python3
"""
🎬 Million-Dollar Cinematic Intro Generator v3 (Fast)
No per-pixel particle loops - pure numpy vectorized.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, wave, math, sys

W, H = 1920, 1080
FPS = 30
DURATION = 10
TOTAL = FPS * DURATION
FRAMES_DIR = "/tmp/intro_hd_frames"
OUTPUT_DIR = os.path.expanduser("~/.hermes/workspace")

FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG  = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

BG = np.array([6, 6, 18], dtype=np.float32)
np.random.seed(42)

# Pre-compute grids
YY, XX = np.mgrid[0:H, 0:W]
CX, CY = W/2.0, H/2.0
DIST_C = np.sqrt((XX - CX)**2 + (YY - CY)**2)
VIGNETTE = np.clip(1.0 - 0.35 * ((XX/W - 0.5)**2 + (YY/H - 0.5)**2) * 2, 0.3, 1.0)
GRAD_Y = np.linspace(0, 1, H)[:, np.newaxis]

BLUE  = np.array([0,100,255], np.float32)
CYAN  = np.array([0,220,255], np.float32)
WHITE = np.array([220,230,255], np.float32)
GOLD  = np.array([255,200,60], np.float32)

def ease_out(t): return 1 - (1 - np.clip(t,0,1))**3
def ease_elastic(t):
    t = float(np.clip(t,0,1))
    if t==0: return 0.0
    if t==1: return 1.0
    c = 2*math.pi/3
    return 2**(-10*t)*math.sin((t*10-0.75)*c)+1
def ease_expo(t):
    t = float(np.clip(t,0,1))
    return 1.0 if t==1 else 1-2**(-10*t)


def add_glow(frame, cx, cy, radius, color, intensity):
    """Fast vectorized glow addition."""
    dist = np.sqrt((XX-cx)**2 + (YY-cy)**2)
    g = np.clip(1 - dist/max(radius,1), 0, 1)**2 * intensity
    for c in range(3):
        frame[:,:,c] += color[c] * g

def add_ring(frame, cx, cy, radius, thick, color, intensity):
    dist = np.sqrt((XX-cx)**2 + (YY-cy)**2)
    r = np.exp(-((dist-radius)**2)/(2*thick**2)) * intensity
    for c in range(3):
        frame[:,:,c] += color[c] * r

def add_scatter(frame, xs, ys, colors, alphas, size=2):
    """Vectorized scatter plot of glowing dots."""
    for i in range(len(xs)):
        ix, iy = int(xs[i]), int(ys[i])
        a = alphas[i]
        if a < 0.01 or ix<0 or ix>=W or iy<0 or iy>=H: continue
        # 3x3 soft dot
        y1,y2 = max(0,iy-size), min(H,iy+size+1)
        x1,x2 = max(0,ix-size), min(W,ix+size+1)
        patch_y, patch_x = np.mgrid[y1:y2, x1:x2]
        d = np.sqrt((patch_x-ix)**2 + (patch_y-iy)**2)
        mask = (d <= size).astype(np.float32) * (1 - d/size) * a
        for c in range(3):
            frame[y1:y2, x1:x2, c] += colors[i][c] * mask


def render_text_layer(text, font, color, glow_color, glow_r=25):
    tmp = Image.new("RGBA",(1,1),(0,0,0,0))
    bb = ImageDraw.Draw(tmp).textbbox((0,0), text, font=font)
    tw, th = bb[2]-bb[0], bb[3]-bb[1]
    pad = glow_r*2+20
    sz = (tw+pad*2, th+pad*2)
    txt = Image.new("RGBA", sz, (0,0,0,0))
    ImageDraw.Draw(txt).text((pad,pad), text, fill=color+(255,), font=font)
    gl = Image.new("RGBA", sz, (0,0,0,0))
    ImageDraw.Draw(gl).text((pad,pad), text, fill=glow_color+(200,), font=font)
    for _ in range(4):
        gl = Image.alpha_composite(gl, gl.filter(ImageFilter.GaussianBlur(radius=glow_r)))
    result = Image.alpha_composite(gl, txt)
    return np.array(result), tw, th, pad


def paste_rgba(frame, layer, x, y, alpha=1.0, scale=1.0):
    if scale < 0.99:
        img = Image.fromarray(layer)
        nw, nh = int(img.size[0]*scale), int(img.size[1]*scale)
        if nw<1 or nh<1: return
        layer = np.array(img.resize((nw,nh), Image.LANCZOS))
    lh, lw = layer.shape[:2]
    sy1,sy2 = max(0,y), min(H,y+lh)
    sx1,sx2 = max(0,x), min(W,x+lw)
    if sy2<=sy1 or sx2<=sx1: return
    ly1,ly2 = sy1-y, sy1-y+(sy2-sy1)
    lx1,lx2 = sx1-x, sx1-x+(sx2-sx1)
    a = layer[ly1:ly2, lx1:lx2, 3:4].astype(np.float32)/255.0 * alpha
    rgb = layer[ly1:ly2, lx1:lx2, :3].astype(np.float32)
    region = frame[sy1:sy2, sx1:sx2]
    frame[sy1:sy2, sx1:sx2] = region*(1-a) + rgb*a


def gen_audio(path, dur=10, sr=44100):
    n = int(dur*sr); t = np.linspace(0,dur,n); a = np.zeros(n)
    fi = np.clip(t/2,0,1); fo = np.clip((dur-t)/2,0,1); env = fi*fo
    a += (np.sin(2*np.pi*55*t)*0.15+np.sin(2*np.pi*82.5*t)*0.1+np.sin(2*np.pi*110*t)*0.08)*env
    se = np.clip((t-3)/2,0,1)*np.clip((5-t)/0.5,0,1)
    a += np.sin(2*np.pi*np.cumsum(np.linspace(200,800,n))/sr)*0.06*se
    ht=t-5; a += (np.sin(2*np.pi*60*t)*0.3+np.sin(2*np.pi*120*t)*0.15+np.random.randn(n)*0.05)*np.exp(-ht*8)*(ht>0)
    pe = np.clip((t-4)/1.5,0,1)*np.clip((9-t)/1.5,0,1)
    a += (np.sin(2*np.pi*220*t)*0.04+np.sin(2*np.pi*277.18*t)*0.03+np.sin(2*np.pi*329.63*t)*0.03+np.sin(2*np.pi*440*t)*0.02+np.sin(2*np.pi*220.5*t)*0.02)*pe
    she = np.clip((t-5)/0.5,0,1)*np.clip((8-t)/1.5,0,1)
    a += (np.sin(2*np.pi*(2000+1000*np.sin(2*np.pi*0.5*t))*t)*0.02+np.sin(2*np.pi*5000*t)*0.008*np.sin(2*np.pi*3*t))*she
    te = np.clip((t-8)/0.5,0,1)*np.clip((10-t)/1.5,0,1)
    a += (np.sin(2*np.pi*165*t)*0.04+np.sin(2*np.pi*220*t)*0.03+np.sin(2*np.pi*330*t)*0.02)*te
    pk = np.max(np.abs(a))
    if pk>0: a=a/pk*0.85
    with wave.open(path,'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((a*32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    print("🎬 MR.DERDER CINEMATIC INTRO v3", flush=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)

    print("📝 Pre-rendering text...", flush=True)
    title_layer, tw, th, tpad = render_text_layer(
        "Mr.DerDer", ImageFont.truetype(FONT_BOLD,130), (255,255,255), (30,120,255), glow_r=30)
    sub_layer, sw, sh, spad = render_text_layer(
        "AI Creative Lab", ImageFont.truetype(FONT_REG,46), (180,210,255), (0,80,200), glow_r=15)

    # Decorative line
    lw_px = 300
    line_arr = np.zeros((6,lw_px,4),np.uint8)
    for x in range(lw_px):
        a = int(255*(1-abs(x-lw_px/2)/(lw_px/2))**2)
        line_arr[:,x] = [0,180,255,a]

    # Pre-generate particle pools
    N_P = 60  # background particles
    p_x = np.random.uniform(0,W,N_P).astype(np.float64)
    p_y = np.random.uniform(0,H,N_P).astype(np.float64)
    p_vy = np.random.uniform(-1.0,-0.2,N_P)
    p_bright = np.random.uniform(0.2,0.8,N_P)

    # Converging particles
    NC = 80
    c_x0 = np.random.uniform(-200,W+200,NC)
    c_y0 = np.random.uniform(-200,H+200,NC)

    # Stars
    S_X = np.random.randint(0,W,50)
    S_Y = np.random.randint(0,H,50)
    S_B = np.random.uniform(0.1,0.4,50)
    S_T = np.random.uniform(1,4,50)

    # Pre-compute light ray angles
    N_RAYS = 16
    RAY_ANG = np.linspace(0, 2*math.pi, N_RAYS, endpoint=False)

    print(f"🎬 Rendering {TOTAL} frames...", flush=True)

    for fi in range(TOTAL):
        t = fi / FPS
        f = np.empty((H,W,3), np.float32)
        f[:,:,0] = BG[0]+4*(1-GRAD_Y)
        f[:,:,1] = BG[1]+2*(1-GRAD_Y)
        f[:,:,2] = BG[2]+8*(1-GRAD_Y)

        # Stars (vectorized batch)
        sa = min(t/3,1) * (max(1-(t-7)/3,0) if t>7 else 1)
        if sa > 0.02:
            twinkle = (0.5+0.5*np.sin(t*S_T)) * S_B * sa
            mask = twinkle > 0.05
            sx_arr = S_X[mask]; sy_arr = S_Y[mask]; sb_arr = twinkle[mask]
            for i in range(len(sx_arr)):
                f[sy_arr[i], sx_arr[i]] = f[sy_arr[i], sx_arr[i]]*(1-sb_arr[i]*0.5) + WHITE*sb_arr[i]*0.5

        # Phase 1: Awakening (0-3s)
        if t < 3:
            p = t/2.5
            p_y[:] += p_vy
            dead = p_y < -10
            p_y[dead] = H+np.random.uniform(0,30,np.sum(dead))
            p_x[dead] = np.random.uniform(0,W,np.sum(dead))
            add_scatter(f, p_x, p_y, [WHITE*0.4]*N_P, p_bright*0.3*min(p*2,1), size=2)
            add_glow(f, CX, CY, 600, BLUE, float(ease_out(p))*0.15)

        # Phase 2: Convergence (2-5s)
        if 2 <= t < 5:
            p = (t-2)/3
            # BG particles dimmed
            p_y[:] += p_vy
            dead = p_y < -10
            p_y[dead] = H+np.random.uniform(0,30,np.sum(dead))
            p_x[dead] = np.random.uniform(0,W,np.sum(dead))
            add_scatter(f, p_x, p_y, [WHITE*0.3]*N_P, p_bright*0.15, size=1)

            # Converging
            cp_t = float(ease_out(p))
            cpx = c_x0 + (CX-c_x0)*cp_t*0.7
            cpy = c_y0 + (CY-c_y0)*cp_t*0.7
            cp_a = np.full(NC, (0.3+0.5*p)*0.5)
            add_scatter(f, cpx, cpy, [CYAN*0.6]*NC, cp_a, size=2)

            # Energy
            er = 100+400*float(ease_out(p))
            add_glow(f, CX, CY, er, BLUE, 0.2+0.3*p)

            # Rings
            for ri in range(3):
                add_ring(f, CX, CY, 50+200*p+ri*80, 15, CYAN, 0.1*(1-ri*0.25)*p)

            # Rays (vectorized per ray but fast)
            ao = t*0.3
            for ang in RAY_ANG:
                a2 = ang+ao
                rl = 200+500*p
                ex, ey = CX+math.cos(a2)*rl, CY+math.sin(a2)*rl
                # Draw as sparse line (every 10px)
                for s in range(0, 30):
                    frac = s/30
                    rx = int(CX+(ex-CX)*frac)
                    ry = int(CY+(ey-CY)*frac)
                    ra = (1-frac)**2*0.08*p
                    if 0<=rx<W and 0<=ry<H:
                        f[ry,rx] += CYAN*ra

        # Phase 3: Title Reveal (4.5-7s)
        if 4.5 <= t < 7:
            p = (t-4.5)/2.5
            # Flash
            if t < 5.2:
                fi2 = math.exp(-(t-4.5)/0.7*3)*0.8
                add_glow(f, CX, CY, 1200, WHITE, fi2)
            # Title
            ta = float(ease_elastic(min(p*1.5,1)))
            sc = 0.3+0.7*float(ease_expo(min(p*2,1)))
            paste_rgba(f, title_layer, (W-title_layer.shape[1])//2,
                       (H-title_layer.shape[0])//2-30, alpha=ta, scale=sc)
            # Burst
            if t > 5:
                bp = (t-5)/1.5
                ba = (1-bp)**2*0.3
                n_burst = 30
                angles = np.linspace(0,2*math.pi,n_burst,endpoint=False)
                br = 50+400*float(ease_out(bp))
                bxs = (CX+np.cos(angles)*br).astype(int)
                bys = (CY+np.sin(angles)*br).astype(int)
                add_scatter(f, bxs, bys, [CYAN]*n_burst, np.full(n_burst,ba), size=3)

        # Phase 4: Subtitle (6.5-8.5s)
        if 6.5 <= t < 8.5:
            p = (t-6.5)/2.0
            paste_rgba(f, title_layer, (W-title_layer.shape[1])//2,
                       (H-title_layer.shape[0])//2-30)
            sa2 = float(ease_out(min(p*1.5,1)))
            sx = (W-sub_layer.shape[1])//2
            sy = (H-sub_layer.shape[0])//2+55
            paste_rgba(f, sub_layer, sx, sy, alpha=sa2)
            # Line
            if sa2 > 0.3:
                la = (sa2-0.3)/0.7
                lx = (W-lw_px)//2; ly = sy+sub_layer.shape[0]+5
                if ly+6 <= H:
                    la2 = line_arr[:,:,3:4].astype(np.float32)/255*la
                    region = f[ly:ly+6,lx:lx+lw_px]
                    f[ly:ly+6,lx:lx+lw_px] = region*(1-la2) + line_arr[:,:,:3].astype(np.float32)*la2
            add_glow(f, CX, CY, 500, BLUE, 0.06)

        # Phase 5: Fade out (8-10s)
        if t >= 8:
            p = (t-8)/2
            fade = float(ease_out(1-p))
            f = f*fade + BG*(1-fade)

        # Post-processing
        f *= VIGNETTE[:,:,np.newaxis]
        f += np.random.uniform(-1.5, 1.5, (H,W,3))
        np.clip(f, 0, 255, out=f)

        Image.fromarray(f.astype(np.uint8)).save(
            os.path.join(FRAMES_DIR, f"f_{fi:04d}.png"))

        if (fi+1) % 30 == 0:
            print(f"  🎞️ {fi+1}/{TOTAL} ({(fi+1)/TOTAL*100:.0f}%)", flush=True)

    print(f"✅ Frames done!", flush=True)

    print("🎵 Audio...", flush=True)
    gen_audio(os.path.join(OUTPUT_DIR, "intro_audio.wav"), DURATION)

    print("🎞️ Compiling...", flush=True)
    out = os.path.join(OUTPUT_DIR, "mr_der_der_intro.mp4")
    os.system(
        f"ffmpeg -y -framerate {FPS} -i {FRAMES_DIR}/f_%04d.png "
        f"-i {OUTPUT_DIR}/intro_audio.wav "
        f"-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "
        f"-c:a aac -b:a 192k -shortest -movflags +faststart {out}")
    sz = os.path.getsize(out)/1e6
    print(f"\n🎉 {out} ({sz:.1f} MB)", flush=True)
