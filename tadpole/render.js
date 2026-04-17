#!/usr/bin/env node
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const HTML = 'file:///root/.hermes/workspace/tadpole/tadpole.html';
const OUT_DIR = '/root/.hermes/workspace/tadpole/frames';
const OUT_MP4 = '/root/.hermes/workspace/tadpole/tadpole.mp4';
const MUSIC = '/root/.hermes/workspace/tadpole/music.wav';
const FPS = 30;
const DURATION = 90;
const TOTAL = FPS * DURATION;

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Rendering ${TOTAL} frames...`);

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(HTML);
  await page.waitForTimeout(500); // 等JS初始化

  for (let frame = 0; frame < TOTAL; frame++) {
    const time = frame / FPS;
    await page.evaluate((t) => window.renderFrame(t), time);
    const fp = path.join(OUT_DIR, `frame_${String(frame).padStart(5, '0')}.png`);
    await page.screenshot({ path: fp, type: 'png' });
    if (frame % 300 === 0) {
      console.log(`  ${frame}/${TOTAL} (${(frame/TOTAL*100).toFixed(1)}%) t=${time.toFixed(1)}s`);
    }
  }
  await browser.close();
  console.log('Frames done! Encoding...');

  // PNG → MP4
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${OUT_DIR}/frame_%05d.png" ` +
    `-c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${OUT_MP4}"`,
    { stdio: 'inherit' }
  );

  // 合并音频
  const final = OUT_MP4.replace('.mp4', '_final.mp4');
  execSync(
    `ffmpeg -y -i "${OUT_MP4}" -i "${MUSIC}" -c:v copy -c:a aac -shortest "${final}"`,
    { stdio: 'inherit' }
  );
  console.log(`Done! ${final}`);

  // 清理
  execSync(`rm -rf "${OUT_DIR}"`);
}

main().catch(e => { console.error(e); process.exit(1); });
