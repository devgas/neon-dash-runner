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

  test('game over popup appears when lives reach zero', async ({ page }) => {
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
      state.gameOverCalled = false;
    });

    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.gameOverCalled === true,
      { timeout: 3000 }
    );

    const overlayVisible = await page.evaluate(() => {
      const el = document.getElementById('overlay');
      if (!el) return 'missing';
      const style = window.getComputedStyle(el);
      const hasHidden = el.classList.contains('hidden');
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      return { hasHidden, isVisible, display: style.display, zIndex: style.zIndex, visibility: style.visibility, opacity: style.opacity };
    });

    console.log('OVERLAY STATE:', JSON.stringify(overlayVisible, null, 2));
    expect(overlayVisible.hasHidden).toBe(false);
    expect(overlayVisible.isVisible).toBe(true);
    expect(overlayVisible.zIndex).not.toBe('auto');

    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#btn')).toHaveText('RETRY');
    await expect(page.locator('#final-score')).toBeVisible();
    await expect(page.locator('#best-score')).toBeVisible();
    await expect(page.locator('#hint')).toHaveText('PRESS SPACE OR TAP RETRY');
  });

  test('retry button resets game from game over', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('#menu-start');
    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.phase === 'run',
      { timeout: 3000 }
    );

    await page.evaluate(() => {
      state.score = 1234;
      state.lives = 0;
      state.phase = 'dead';
      state.gameOverCalled = false;
    });

    await page.waitForTimeout(100);
    await page.click('#btn');

    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#score-val')).toHaveText('0');
    await expect(page.locator('#lives')).toHaveText('♥♥♥');
  });

  test('space key retries from game over', async ({ page }) => {
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
      state.gameOverCalled = false;
    });

    await page.waitForTimeout(100);
    await page.keyboard.press('Space');

    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#score-val')).toHaveText('0');
  });
});
