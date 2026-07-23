const path = require('path');
const projectDir = '/home/anton/projects/runner';
const _require = require;
function req(mod) {
  try {
    return _require(mod);
  } catch (e) {
    const local = path.join(projectDir, 'node_modules', mod);
    return _require(local);
  }
}

const { chromium } = req('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  const pcerr = [];
  page.on('pageerror', err => pcerr.push(err.message));
  await page.goto('http://localhost:8081/dist/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const menuVisible = await page.$eval('#menu', el => getComputedStyle(el).display !== 'none').catch(() => false);
  await page.click('#menu-start');
  await page.waitForTimeout(120);
  const overlayHidden = await page.$eval('#overlay', el => el.classList.contains('hidden')).catch(() => false);
  console.log(JSON.stringify({ menuVisible, overlayHidden, logs: logs.slice(-5), pcerr }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
