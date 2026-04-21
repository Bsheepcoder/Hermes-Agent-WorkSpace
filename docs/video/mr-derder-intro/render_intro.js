/**
 * Render intro-wire.html to MP4 using Playwright + FFmpeg
 * Captures frames via canvas screenshot, then encodes to video
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HTML_FILE = '/root/.openclaw/workspace/code/video-intro/intro-wire.html';
const FRAME_DIR = '/tmp/intro_wire_frames';
const OUTPUT = '/root/.hermes/workspace/mr_der_der_intro.mp4';
const AUDIO = '/root/.hermes/workspace/intro_audio.wav';
const FPS = 30;
const DURATION = 15; // intro-wire has a 15s cycle
const TOTAL_FRAMES = FPS * DURATION;

async function main() {
  // Clean frame dir
  if (fs.existsSync(FRAME_DIR)) fs.rmSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });

  console.log('🎬 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('📄 Loading HTML...');
  const htmlUrl = 'file://' + HTML_FILE;
  await page.goto(htmlUrl, { waitUntil: 'networkidle' });

  // Wait for Three.js to initialize
  await page.waitForTimeout(2000);

  console.log(`📸 Capturing ${TOTAL_FRAMES} frames...`);

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const framePath = path.join(FRAME_DIR, `f_${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png' });

    // Advance time by 1/FPS second (33.33ms)
    await page.evaluate(() => {
      // Force requestAnimationFrame to fire
      return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });

    if ((i + 1) % 30 === 0) {
      const pct = ((i + 1) / TOTAL_FRAMES * 100).toFixed(0);
      console.log(`  🎞️  ${i + 1}/${TOTAL_FRAMES} (${pct}%)`);
    }
  }

  console.log('✅ Frames captured!');
  await browser.close();

  // Check if audio exists from previous run
  const hasAudio = fs.existsSync(AUDIO);

  // Encode with FFmpeg
  console.log('🎞️ Compiling video...');
  let cmd;
  if (hasAudio) {
    cmd = `ffmpeg -y -framerate ${FPS} -i ${FRAME_DIR}/f_%04d.png ` +
      `-i ${AUDIO} ` +
      `-c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p ` +
      `-c:a aac -b:a 192k -shortest -movflags +faststart ${OUTPUT}`;
  } else {
    cmd = `ffmpeg -y -framerate ${FPS} -i ${FRAME_DIR}/f_%04d.png ` +
      `-c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p ` +
      `-movflags +faststart ${OUTPUT}`;
  }
  execSync(cmd, { stdio: 'inherit' });

  const sz = fs.statSync(OUTPUT).size / 1e6;
  console.log(`\n🎉 DONE: ${OUTPUT} (${sz.toFixed(1)} MB)`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
