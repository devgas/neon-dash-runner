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
});
