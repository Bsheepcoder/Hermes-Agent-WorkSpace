const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HTML = '/root/.hermes/workspace/intro-v4.html';
const FRAMES = '/tmp/intro_v4_frames';
const AUDIO = '/root/.hermes/workspace/intro_audio_v4.wav';
const OUTPUT = '/root/.hermes/workspace/mr_der_der_intro.mp4';
const FPS = 30;
const DUR = 5;
const TOTAL = FPS * DUR;

async function main() {
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  console.log('🎬 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  console.log('📄 Loading...');
  await page.goto('file://' + HTML, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log(`📸 ${TOTAL} frames @ ${FPS}fps...`);

  for (let i = 0; i < TOTAL; i++) {
    // 每帧等待精确时间（用evaluate控制时间推进）
    await page.evaluate((ms) => {
      return new Promise(r => {
        // performance.now() 由 requestAnimationFrame 自动推进
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
    }, 1000/FPS);

    await page.screenshot({
      path: path.join(FRAMES, `f_${String(i).padStart(4,'0')}.png`),
      type: 'png'
    });

    if ((i+1) % 30 === 0)
      console.log(`  🎞️ ${i+1}/${TOTAL} (${((i+1)/TOTAL*100)|0}%)`);
  }

  console.log('✅ Frames done');
  await browser.close();

  console.log('🎞️ Encoding...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${FRAMES}/f_%04d.png ` +
    `-i ${AUDIO} ` +
    `-c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p ` +
    `-c:a aac -b:a 192k -shortest -movflags +faststart ${OUTPUT}`,
    { stdio: 'inherit' }
  );

  const sz = fs.statSync(OUTPUT).size / 1e6;
  console.log(`\n🎉 ${OUTPUT} (${sz.toFixed(1)} MB)`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
