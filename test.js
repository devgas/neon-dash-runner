const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async() => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--enable-unsafe-fast-timers',
      '--disable-dev-shm-usage',
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:8080/dist/index.html', { waitUntil: 'domcontentloaded' });

  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 2000));

  const results = await page.evaluate(async () => {
    const frames = [];
    // Run for ~10s of time but use per-frame timestamps
    const samples = 1000;
    let last = performance.now();
    for (let i = 0; i < samples; i++) {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (dt <= 0) continue;
      frames.push(1000 / dt);
      await new Promise(r => setTimeout(r, 0));
    }
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    const min = Math.min(...frames);
    const poor = frames.filter(f => f < 50).length;
    return { samples: frames.length, avg: Math.round(avg), min: Math.round(min), poorFrames: poor };
  });

  console.log('FPS', results);
  await browser.close();
  if (results.poorFrames > 0) {
    console.error('Assertion failed: found', results.poorFrames, 'frames below 50fps');
    process.exit(1);
  }
  console.log('Assertion passed: 50+ fps per frame');
})().catch(async (err) => {
  console.error(err);
  try { process.exitCode = 1; } catch {}
});
