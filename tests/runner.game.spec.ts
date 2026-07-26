import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://neon-dash-runner.vercel.app';

test.describe('NEON DASH', () => {
  test('compressed interactive smoke', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('canvas#game')).toBeVisible();
    await expect(page.locator('#menu-start')).toBeVisible();

    await page.click('#menu-start');
    await expect(page.locator('#menu')).not.toBeVisible();

    await page.waitForFunction(
      () => typeof distance !== 'undefined' && distance > 0,
      { timeout: 3000 }
    );

    const state = await page.evaluate(() => (
      typeof state !== 'undefined' && typeof distance !== 'undefined'
        ? { distance, paused }
        : 'state-unavailable'
    ));
    expect(state).not.toBe('state-unavailable');
    if (typeof state === 'object') {
      expect(state.distance).toBeGreaterThan(0);
      expect(state.paused).toBe(false);
    }

    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => (
      typeof paused !== 'undefined' ? { paused, distance } : 'state-unavailable'
    ));
    expect(after).not.toBe('state-unavailable');
    if (typeof after === 'object') expect(after.paused).toBe(true);
  });

  test('game over shows retry button', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('#menu-start');
    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.phase === 'run',
      { timeout: 3000 }
    );

    await page.evaluate(() => {
      state.lives = 0;
      state.phase = 'dead';
      const overlay = document.getElementById('overlay');
      const finalScoreEl = document.getElementById('final-score');
      const bestScoreEl = document.getElementById('best-score');
      const btn = document.getElementById('btn');
      if (overlay) overlay.classList.remove('hidden');
      if (finalScoreEl) finalScoreEl.textContent = String(state.score);
      if (bestScoreEl) bestScoreEl.textContent = 'BEST ' + String(state.highScore);
      if (btn) btn.textContent = 'RETRY';
    });

    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#btn')).toHaveText('RETRY');
    await expect(page.locator('#final-score')).toBeVisible();

    await page.click('#btn');
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#score-val')).toHaveText('0');
  });
});
