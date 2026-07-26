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

  test('leaderboard popup opens from menu', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('#menu-leaderboard');
    await expect(page.locator('#leaderboard')).not.toHaveClass(/hidden/);
    await expect(page.locator('#leaderboard-table')).toBeVisible();
  });

  test('leaderboard close hides popup', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('#menu-leaderboard');
    await expect(page.locator('#leaderboard')).not.toHaveClass(/hidden/);
    await page.click('#leaderboard-close');
    await expect(page.locator('#leaderboard')).toHaveClass(/hidden/);
  });

  test('new high score shows initials input', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.click('#menu-start');
    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.phase === 'run',
      { timeout: 3000 }
    );

    await page.evaluate(() => {
      state.score = 5000;
      state.lives = 0;
      state.phase = 'dead';
      state.gameOverCalled = false;
    });

    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.gameOverCalled === true,
      { timeout: 3000 }
    );

    const debugState = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storage[key] = localStorage.getItem(key);
      }
      return {
        highScore: typeof state !== 'undefined' ? state.highScore : 'no-state',
        score: typeof state !== 'undefined' ? state.score : 'no-state',
        newHighClass: document.getElementById('new-high')?.className,
        initialsRowClass: document.getElementById('initials-row')?.className,
        btnText: document.getElementById('btn')?.textContent,
        localStorage: storage
      };
    });
    console.log('DEBUG:', JSON.stringify(debugState, null, 2));

    await expect(page.locator('#new-high')).not.toHaveClass(/hidden/);
    await expect(page.locator('#initials-row')).not.toHaveClass(/hidden/);
    await expect(page.locator('#initials-input')).toBeVisible();
    await expect(page.locator('#btn')).toHaveText('SAVE');
  });

  test('saving initials stores score in leaderboard', async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.click('#menu-start');
    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.phase === 'run',
      { timeout: 3000 }
    );

    await page.evaluate(() => {
      state.score = 5000;
      state.lives = 0;
      state.phase = 'dead';
      state.gameOverCalled = false;
    });

    await page.waitForFunction(
      () => typeof state !== 'undefined' && state.gameOverCalled === true,
      { timeout: 3000 }
    );

    await page.fill('#initials-input', 'ABC');
    await page.click('#btn');

    await page.click('#menu-btn');
    await page.click('#menu-leaderboard');

    await expect(page.locator('#leaderboard-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#leaderboard-table tbody tr td')).toHaveText([
      '1',
      'ABC',
      '5000'
    ]);
  });
});
