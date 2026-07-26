import { createState, createPlayer, CONSTANTS } from './state.js';
import { loadImages, AUDIO_PATHS } from './assets.js';
import { ensureAudio, playSound, playMusic, stopMusic, setAudioEnabled, isAudioEnabled } from './audio.js';
import { setupInput } from './input.js';
import { spawnObstacle, spawnEnemy, spawnBoss, spawnCoin, spawnHeart } from './spawner.js';
import {
  resetPlayer,
  doJump,
  doHurt,
  updatePhysics,
  rectsHit,
  checkCollisions,
} from './player.js';
import { render } from './renderer.js';

function exposeState() {
  window.state = state;
  window.distance = state.distance;
  window.paused = paused;
}

let W = 0;
let H = 0;
let canvas, ctx;
let images;
let input;
let state;
let player;
let paused = false;
let lastTime = 0;
let spawnTimer = 1;
let menuEl, menuStart, menuAudio, menuHint;
let overlay, finalScoreEl, bestScoreEl, btn, hint;
let scoreEl, comboEl, livesEl, coinsEl, pauseBtn, bossEl;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function addParticles(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-180, -40),
      life: 0.5,
      maxLife: 0.5,
      color,
      size: rand(2, 5),
    });
  }
}

function addText(x, y, text) {
  state.texts.push({ x, y, text, life: 0.8, maxLife: 0.8 });
}

function renderLives() {
  if (!livesEl) return;
  let out = '';
  for (let i = 0; i < 3; i++) out += i < state.lives ? '♥' : '♡';
  livesEl.textContent = out;
}

function update(dt) {
  if (state.phase === 'dead') return;
  if (paused) return;
  if (state.phase !== 'idle') {
    state.distance += state.speed * dt / 16.67;
  }

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer <= 0) state.combo = 0;

  spawnTimer -= dt * (state.speed / 6);
  if (spawnTimer <= 0) {
    spawnTimer = rand(0.6, 1.6) - state.speed * 0.04;
    if (spawnTimer < 0.35) spawnTimer = 0.35;
    const activeCount =
      state.obstacles.length + state.enemies.length + state.coins.length + state.hearts.length;
    if (activeCount < 16) {
      const pick = Math.random();
      if (pick < 0.50) {
        const o = spawnObstacle(W, H);
        const collisionMargin = 20;
        for (let attempt = 0; attempt < 8; attempt++) {
          const margin = { x: -collisionMargin, y: -collisionMargin, w: collisionMargin * 2, h: collisionMargin * 2 };
          const expanded = { x: o.x + margin.x, y: o.y + margin.y, w: o.w + margin.w, h: o.h + margin.h };
          const overlap = [
            ...state.obstacles,
            ...state.enemies,
            ...state.coins,
            ...state.hearts,
          ].some(obj => rectsHit(expanded, obj) || rectsHit(obj, expanded));
          if (!overlap) {
            state.obstacles.push(o);
            break;
          }
          o.x += 60;
          o.y = Math.random() < 0.5 ? H * 0.35 : H * 0.55;
        }
      } else if (pick < 0.75) {
        const e = spawnEnemy(W, H, state.speed);
        const collisionMargin = 20;
        for (let attempt = 0; attempt < 8; attempt++) {
          const margin = { x: -collisionMargin, y: -collisionMargin, w: collisionMargin * 2, h: collisionMargin * 2 };
          const expanded = { x: e.x + margin.x, y: e.y + margin.y, w: e.w + margin.w, h: e.h + margin.h };
          const overlap = [
            ...state.obstacles,
            ...state.enemies,
            ...state.coins,
            ...state.hearts,
          ].some(obj => rectsHit(expanded, obj) || rectsHit(obj, expanded));
          if (!overlap) {
            state.enemies.push(e);
            break;
          }
          e.x += 60;
          e.baseY = Math.random() < 0.5 ? H * 0.35 : H * 0.55;
          e.y = e.baseY;
        }
      } else if (pick < 0.90) {
        const c = spawnCoin(W, H);
        const collisionMargin = 10;
        for (let attempt = 0; attempt < 6; attempt++) {
          const margin = { x: -collisionMargin, y: -collisionMargin, w: collisionMargin * 2, h: collisionMargin * 2 };
          const expanded = { x: c.x + margin.x, y: c.y + margin.y, w: c.w + margin.w, h: c.h + margin.h };
          const overlap = [
            ...state.obstacles,
            ...state.enemies,
            ...state.coins,
            ...state.hearts,
          ].some(obj => rectsHit(expanded, obj) || rectsHit(obj, expanded));
          if (!overlap) {
            state.coins.push(c);
            break;
          }
          c.x += 40;
        }
      } else {
        const h = spawnHeart(W, H);
        const collisionMargin = 10;
        for (let attempt = 0; attempt < 6; attempt++) {
          const margin = { x: -collisionMargin, y: -collisionMargin, w: collisionMargin * 2, h: collisionMargin * 2 };
          const expanded = { x: h.x + margin.x, y: h.y + margin.y, w: h.w + margin.w, h: h.h + margin.h };
          const overlap = [
            ...state.obstacles,
            ...state.enemies,
            ...state.coins,
            ...state.hearts,
          ].some(obj => rectsHit(expanded, obj) || rectsHit(obj, expanded));
          if (!overlap) {
            state.hearts.push(h);
            break;
          }
          h.x += 40;
        }
      }
    }
    if (!state.bossActive && state.distance > 140 && Math.random() < 0.0025) {
      state.enemies.push(spawnBoss(W, H, state.speed));
      state.bossActive = true;
      state.bossMaxHp = 40;
      if (bossEl) {
        bossEl.style.display = 'block';
        bossEl.textContent = 'BOSS';
      }
    }
  }

  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    o.x -= state.speed * 2.8 * dt;
    if (o.x + o.w < -10) state.obstacles.splice(i, 1);
  }
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const c = state.coins[i];
    c.x -= state.speed * 2.8 * dt;
    if (c.x + c.w < -10) state.coins.splice(i, 1);
  }
  for (let i = state.hearts.length - 1; i >= 0; i--) {
    const h = state.hearts[i];
    h.x -= state.speed * 2.8 * dt;
    if (h.x + h.w < -10) state.hearts.splice(i, 1);
  }
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const en = state.enemies[i];
    if (en.type === 'boss') {
      en.frame += dt;
      if (en.attackTimer > 0) en.attackTimer -= dt;
      if (en.x > W * 0.35 && state.speed < 12) state.speed = 12;
    } else if (en.type === 'fly') {
      en.y = en.baseY + Math.sin((en.timer += dt)) * 28;
    } else {
      en.y = en.baseY + Math.sin((en.phase += dt * 2.5)) * 8;
    }
    en.x += en.vx * dt;
    if (en.x + en.w < -20) {
      state.enemies.splice(i, 1);
      if (en.type === 'boss') {
        state.bossActive = false;
        if (bossEl) bossEl.style.display = 'none';
      }
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.texts.length - 1; i >= 0; i--) {
    const t = state.texts[i];
    t.life -= dt;
    t.y -= 60 * dt;
    if (t.life <= 0) state.texts.splice(i, 1);
  }

  const collision = checkCollisions(player, state, dt);

  if (state.phase === 'dead') {
    gameOver();
    return;
  }

  if (collision.hurt) {
    playSound('hit.wav', 1.0);
    addParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 10);
    state.camShake = 0.25;
    renderLives();
  }
  if (collision.heal) {
    renderLives();
  }
  if (collision.land) {
    playSound('hit.wav', 0.5);
  }

  updatePhysics(player, W, H, dt, input, state);

  if (
    state.phase === 'run' ||
    state.phase === 'jump' ||
    state.phase === 'double_jump' ||
    state.phase === 'fall' ||
    state.phase === 'hurt'
  ) {
    state.speed += (2 * dt) / (5 * 16.67);
    if (state.speed > 14) state.speed = 14;
  }

  if (player.invuln > 0) {
    player.invuln -= dt;
    if (player.invuln <= 0 && state.phase === 'hurt' && player.onGround) {
      state.phase = 'run';
    }
  }
  scoreEl.textContent = String(state.score);
  comboEl.textContent = String(state.combo);
  if (coinsEl) coinsEl.textContent = String(state.coinsTaken);
}

function gameLoop(ts) {
  try {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = ts;

    if (state.phase === 'idle') {
      state.runFrame += dt;
      render(ctx, W, H, state, player, images, rand);
    } else if (
      state.phase === 'run' ||
      state.phase === 'jump' ||
      state.phase === 'double_jump' ||
      state.phase === 'fall' ||
      state.phase === 'hurt'
    ) {
      state.runFrame += dt * 60;
      if (state.phase !== 'dead') update(dt);
      render(ctx, W, H, state, player, images, rand);
      if (player.y > H + 100) gameOver();
    } else if (state.phase === 'dead') {
      gameOver();
      render(ctx, W, H, state, player, images, rand);
    }
    exposeState();
  } catch (e) {
    console.error('[NEON DASH] gameLoop error:', e);
  }
  requestAnimationFrame(gameLoop);
}

  let gameOverTimer = null;

  function gameOver() {
    if (state.gameOverCalled) return;
    state.gameOverCalled = true;
    state.phase = 'dead';
    stopMusic();
    playSound('hit.wav', 1.2);
    playSound('gameover_sting.wav', 0.9);
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem('neonDashHigh', String(state.highScore));
    }
    finalScoreEl.textContent = String(state.score);
    bestScoreEl.textContent = 'BEST ' + String(state.highScore);
    
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    btn.textContent = 'RETRY';
    hint.textContent = 'PRESS SPACE OR TAP RETRY';
    
    if (gameOverTimer) clearTimeout(gameOverTimer);
    gameOverTimer = setTimeout(() => {
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      btn.textContent = 'RETRY';
    }, 50);
  }

function togglePause() {
  if (state.phase === 'dead' || state.phase === 'idle') return;
  paused = !paused;
  if (paused) {
    overlay.classList.remove('hidden');
    hint.textContent = 'PAUSED';
    document.getElementById('final-score').textContent = 'SCORE ' + String(state.score);
    document.getElementById('best-score').textContent = 'BEST ' + String(state.highScore);
    btn.textContent = 'RESUME';
  } else {
    overlay.classList.add('hidden');
    btn.textContent = 'RETRY';
  }
}

function reset() {
  state.phase = 'run';
  state.runFrame = 0;
  state.distance = 0;
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.speed = 10;
  state.obstacles = [];
  state.enemies = [];
  state.coins = [];
  state.hearts = [];
  state.particles = [];
  state.texts = [];
  state.camShake = 0;
  state.lives = 3;
  state.bossActive = false;
  state.bossHp = 0;
  state.bossMaxHp = 0;
  state.gameOverCalled = false;
  spawnTimer = 1;

  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }

  player = resetPlayer(W, H);
  paused = false;
  overlay.classList.add('hidden');
  overlay.style.display = '';
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  coinsEl.textContent = '0';
  state.coinsTaken = 0;
  renderLives();
  if (bossEl) {
    bossEl.style.display = 'none';
    bossEl.textContent = 'BOSS';
  }
  stopMusic();
  ensureAudio();
  playMusic('gameplay_loop.wav');
}

function startFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen?.();
}

function toggleAudio() {
  setAudioEnabled(!isAudioEnabled());
  if (menuAudio) menuAudio.textContent = 'AUDIO: ' + (isAudioEnabled() ? 'ON' : 'OFF');
}

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  scoreEl = document.getElementById('score-val');
  comboEl = document.getElementById('combo-val');
  livesEl = document.getElementById('lives');
  coinsEl = document.getElementById('coins-val');
  pauseBtn = document.getElementById('pause-btn');
  bossEl = document.getElementById('boss-health');
  overlay = document.getElementById('overlay');
  finalScoreEl = document.getElementById('final-score');
  bestScoreEl = document.getElementById('best-score');
  btn = document.getElementById('btn');
  hint = document.getElementById('hint');
  menuEl = document.getElementById('menu');
  menuStart = document.getElementById('menu-start');
  menuAudio = document.getElementById('menu-audio');
  menuHint = document.querySelector('.menu-hint');

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  images = loadImages();
  state = createState();
  player = createPlayer(W, H);

  input = setupInput(
    () => {
      ensureAudio();
      if (
        state.phase === 'idle' ||
        state.phase === 'run' ||
        state.phase === 'jump' ||
        state.phase === 'double_jump' ||
        state.phase === 'hurt'
      ) {
        if (doJump(player, state)) {
          playSound(
            state.phase === 'jump' ? 'jump.wav' : 'double_jump.wav',
            state.phase === 'jump' ? 0.7 : 0.6
          );
          const color = state.phase === 'double_jump' ? '#45A29E' : '#66FCF1';
          const count = state.phase === 'double_jump' ? 5 : 4;
          addParticles(player.x + player.w / 2, player.y + player.h, color, count);
        }
      }
    }
  );

  btn.addEventListener('click', () => {
    ensureAudio();
    if (state.phase === 'dead') {
      reset();
      return;
    }
    if (paused) {
      togglePause();
      return;
    }
    reset();
  });

  pauseBtn?.addEventListener('click', () => togglePause());

  menuAudio.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAudio();
  });
  menuStart.addEventListener('click', (e) => {
    e.preventDefault();
    menuEl.classList.add('hidden');
    if (!isAudioEnabled()) toggleAudio();
    ensureAudio();
    reset();
  });
  menuHint?.addEventListener('click', () => {
    if (!menuEl.classList.contains('hidden')) {
      menuEl.classList.add('hidden');
      if (!isAudioEnabled()) toggleAudio();
      ensureAudio();
      reset();
    }
  });
  menuEl.addEventListener('click', (ev) => {
    if (ev.target === menuEl) {
      menuEl.classList.add('hidden');
      ensureAudio();
      reset();
    }
  });
  canvas.addEventListener('click', () => {
    if (!menuEl.classList.contains('hidden')) {
      menuEl.classList.add('hidden');
      if (!isAudioEnabled()) toggleAudio();
      ensureAudio();
      reset();
    }
  });

  window.addEventListener('touchstart', startFullscreen, { once: true });

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && state.phase === 'idle') {
      reset();
    }
    if (
      ['Space', 'ArrowUp', 'KeyW'].includes(e.code) &&
      ['run', 'jump', 'double_jump', 'hurt'].includes(state.phase)
    ) {
      if (doJump(player, state)) {
        playSound(state.phase === 'jump' ? 'jump.wav' : 'double_jump.wav', 0.6);
        addParticles(
          player.x + player.w / 2,
          player.y + player.h,
          state.phase === 'double_jump' ? '#45A29E' : '#66FCF1',
          state.phase === 'double_jump' ? 5 : 4
        );
      }
    }
    if (state.phase === 'dead' && ['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) {
      reset();
    }
    if (['Escape', 'KeyP'].includes(e.code)) togglePause();
  });

  [menuStart, menuAudio].forEach((b) =>
    b.addEventListener('pointerenter', () => playSound('ui_hover.wav', 0.4))
  );

  showMenu();
  requestAnimationFrame(gameLoop);
});

function showMenu() {
  state.phase = 'idle';
  menuEl.classList.remove('hidden');
  overlay.classList.add('hidden');
  hint.textContent = 'SPACE / TAP to start';
  if (menuHint) menuHint.textContent = 'TAP ANYWHERE TO START';
  paused = false;
}
