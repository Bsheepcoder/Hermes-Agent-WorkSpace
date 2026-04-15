/**
 * 渲染所有转场为 MP4
 * Playwright 截帧 + ffmpeg 编码
 */
const { chromium } = require('playwright');
const { TransitionScene } = require('./core');
const definitions = require('./definitions');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WS = '/root/.hermes/workspace';
const FRAMES_DIR = '/tmp/trans_frames';
const FPS = 30;

async function renderTransition(def, idx) {
  const name = def.name;
  const dur = def.duration;
  const totalFrames = Math.round(FPS * dur);
  const frameDir = path.join(FRAMES_DIR, name);

  if (fs.existsSync(frameDir)) fs.rmSync(frameDir, { recursive: true });
  fs.mkdirSync(frameDir, { recursive: true });

  console.log(`\n🎬 [${idx+1}/5] ${name} (${dur}s, ${totalFrames} frames)`);

  // 创建 Three.js 场景
  const scene = new TransitionScene(1920, 1080);
  const fromPos = def.from();
  const toPos = def.to();
  scene.createMorph(fromPos, toPos, {
    color1: def.color1,
    color2: def.color2,
    particleSize: def.particleSize,
  });

  // 启动浏览器
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  // 创建一个简单的HTML页面来承载canvas
  const htmlPath = path.join(FRAMES_DIR, `render_${name}.html`);
  fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{background:#08080c;width:1920px;height:1080px;overflow:hidden}</style></head><body><div id="container"></div></body></html>`);
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });

  // 逐帧渲染
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / FPS;
    const rawProgress = frame / (totalFrames - 1);
    const progress = def.easeFn(rawProgress);

    const camOpts = def.camera(progress, time);
    scene.renderFrame(progress, time, camOpts);

    // 从 Three.js canvas 转成 base64 传给 Playwright
    const gl = scene.renderer.getContext();
    const pixels = new Uint8Array(1920 * 1080 * 4);
    gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip vertically (WebGL is bottom-up)
    const flipped = new Uint8Array(1920 * 1080 * 4);
    for (let y = 0; y < 1080; y++) {
      flipped.set(pixels.subarray(y * 1920 * 4, (y + 1) * 1920 * 4), (1079 - y) * 1920 * 4);
    }

    // Save as PNG via canvas in browser
    const b64 = Buffer.from(flipped).toString('base64');
    await page.evaluate(({ b64, frame }) => {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 1920; c.height = 1080;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          c.toBlob(blob => {
            window.__frameBlob = blob;
            resolve();
          }, 'image/png');
        };
        img.src = 'data:application/octet-stream;base64,' + b64;
      });
    }, { b64, frame });

    // 使用更高效的方式：直接用 Node canvas 写文件
    // 其实直接写 raw PNG 太慢了，改用 Node 方式
    const pngData = await page.evaluate(() => {
      return new Promise(resolve => {
        const c = document.createElement('canvas');
        c.width = 1920; c.height = 1080;
        const ctx = c.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        };
        img.src = 'data:application/octet-stream;base64,' + b64data;
      });
    });

    if ((frame + 1) % 15 === 0 || frame === totalFrames - 1) {
      console.log(`  🎞️ ${frame+1}/${totalFrames}`);
    }
  }

  await browser.close();
  scene.dispose();

  // ... 这种方式太慢了。改用直接从 Three.js 渲染到文件的方式
}

// 这种方式在 headless Playwright 里运行 Three.js 太绕了
// 更好的方式：直接用 Node + Three.js 渲染，然后手动写 PNG

async function main() {
  console.log('🎬 Rendering 5 transitions...\n');

  // 先生成音频
  execSync('cd /root/.hermes/workspace && python3 transitions/gen_audio.py', { stdio: 'inherit' });

  // 使用 headless-gl 渲染
  // ... 需要一个更好的渲染方案
}
