// render_v2.js — Playwright 逐帧渲染脚本
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const DURATION = 90;
const TOTAL_FRAMES = FPS * DURATION; // 2700
const OUT_DIR = path.join(__dirname, 'frames_v2');
const W = 1280, H = 720;
const CHROME = '/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

async function renderRange(startFrame, endFrame) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + path.join(__dirname, 'tadpole_v2.html'));
  await page.waitForTimeout(2000);

  console.log(`Rendering frames ${startFrame} to ${endFrame}...`);
  const t0 = Date.now();

  for (let f = startFrame; f <= endFrame; f++) {
    const t = f / FPS;
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const fname = String(f).padStart(5, '0') + '.png';
    await page.screenshot({ path: path.join(OUT_DIR, fname), type: 'png' });

    if (f % 30 === 0 || f === endFrame) {
      const elapsed = (Date.now() - t0) / 1000;
      const fps = (f - startFrame + 1) / elapsed;
      console.log(`  Frame ${f}/${endFrame} (${fps.toFixed(1)} fps)`);
    }
  }

  await browser.close();
  console.log(`Done. ${(Date.now() - t0) / 1000}s total`);
}

// 命令行参数: node render_v2.js [startFrame] [endFrame]
const args = process.argv.slice(2);
const s = args[0] ? parseInt(args[0]) : 0;
const e = args[1] ? parseInt(args[1]) : 29; // 默认渲染前1秒
renderRange(s, e).catch(err => { console.error(err); process.exit(1); });
