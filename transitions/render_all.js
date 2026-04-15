/**
 * 渲染5个转场视频
 * Playwright 截帧 + ffmpeg 编码
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WS = '/root/.hermes/workspace';
const HTML = path.join(WS, 'transitions/transition.html');
const AUDIO_DIR = path.join(WS, 'transitions/audio');
const OUT_DIR = path.join(WS, 'transitions/output');
const FPS = 30;

const TRANSITIONS = [
  { id: 1, name: 't1-sphere-helix',  dur: 1.8 },
  { id: 2, name: 't2-ring-grid',     dur: 2.0 },
  { id: 3, name: 't3-wave-vortex',   dur: 1.8 },
  { id: 4, name: 't4-helix-explode', dur: 1.5 },
  { id: 5, name: 't5-tunnel-sphere', dur: 2.0 },
];

async function renderOne(browser, t) {
  const totalFrames = Math.round(FPS * t.dur);
  const frameDir = `/tmp/trans_${t.name}`;
  const mp4Path = path.join(OUT_DIR, `${t.name}.mp4`);
  const wavPath = path.join(AUDIO_DIR, `t${t.id}.wav`);

  if (fs.existsSync(frameDir)) fs.rmSync(frameDir, { recursive: true });
  fs.mkdirSync(frameDir, { recursive: true });

  console.log(`\n🎬 [${t.id}/5] ${t.name} (${t.dur}s, ${totalFrames} frames)`);

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  // 加载页面，指定转场类型
  await page.goto(`file://${HTML}?t=${t.id}&d=${t.dur}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 逐帧渲染
  for (let i = 0; i < totalFrames; i++) {
    const timeSec = i / FPS;
    await page.evaluate((sec) => window.setRenderTime(sec), timeSec);

    // 等2帧确保渲染完成
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

    const frameFile = path.join(frameDir, `f_${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: frameFile, type: 'png' });

    if ((i + 1) % 15 === 0 || i === totalFrames - 1) {
      console.log(`  🎞️ ${i+1}/${totalFrames}`);
    }
  }

  await ctx.close();

  // ffmpeg 编码
  console.log(`  🎞️ Encoding ${t.name}.mp4...`);
  const audioFlag = fs.existsSync(wavPath) ? `-i ${wavPath}` : '';
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${frameDir}/f_%04d.png ` +
    (audioFlag ? audioFlag + ' ' : '') +
    `-c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p ` +
    (audioFlag ? `-c:a aac -b:a 192k ` : '') +
    `-shortest -movflags +faststart ${mp4Path}`,
    { stdio: 'pipe' }
  );

  // 清理帧
  fs.rmSync(frameDir, { recursive: true });

  const sz = fs.statSync(mp4Path).size / 1e6;
  console.log(`  ✅ ${t.name}.mp4 (${sz.toFixed(2)} MB)`);
}

async function main() {
  // 确保输出目录
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 生成音频
  console.log('🎵 Generating audio...');
  execSync(`cd ${WS} && python3 transitions/gen_audio.py`, { stdio: 'inherit' });

  console.log('\n🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });

  for (const t of TRANSITIONS) {
    await renderOne(browser, t);
  }

  await browser.close();
  console.log('\n🎉 All 5 transitions rendered!');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
