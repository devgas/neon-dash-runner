import { CONSTANTS } from './state.js';

export function spawnObstacle(W, H) {
  const r = Math.random();
  let type = 'barrier';
  if (r < 0.25) type = 'double';
  else if (r < 0.45) type = 'crate';
  else if (r < 0.55) type = 'low';

  const lane = Math.random() * 0.25 + 0.55;
  const o = { x: W + 40, y: 0, w: 0, h: 0, type, passed: false };

  if (type === 'barrier' || type === 'double') o.w = 36;
  else if (type === 'crate') o.w = 44;
  else if (type === 'low') o.w = 50;

  if (type === 'low') o.h = 28;
  else if (type === 'crate') o.h = 44;
  else o.h = 56;

  o.y = H * lane - (type === 'low' ? 0 : o.h);
  return o;
}

export function spawnEnemy(W, H, speed) {
  const lane = Math.random() * 0.25 + 0.55;
  const type = Math.random() < 0.55 ? 'fly' : 'ground';
  const e = { x: W + 40, y: 0, w: 0, h: 0, type, taken: false, hitExtra: 0 };

  if (type === 'fly') {
    e.y = H * lane - 24;
    e.w = 40;
    e.h = 36;
    e.vx = -speed * 3.4;
    e.vy = Math.random() * 180 - 90;
    e.baseY = e.y;
    e.timer = 0;
  } else {
    e.y = H * 0.82 - 38;
    e.w = 38;
    e.h = 38;
    e.vx = -speed * 2.8;
    e.phase = Math.random() * 6.28;
    e.baseY = e.y;
  }
  return e;
}

export function spawnBoss(W, H, speed) {
  return {
    x: W + 100,
    y: H * 0.18,
    w: 96,
    h: 80,
    hp: 40,
    maxHp: 40,
    frame: 0,
    timer: 0,
    attackTimer: 1.2,
    vx: -speed * 2.6,
    type: 'boss',
    hitExtra: 0,
  };
}

export function spawnCoin(W, H) {
  const lane = Math.random() * 0.25 + 0.5;
  const arcHeight = Math.random() * 40 + 20;
  return {
    x: W + 20,
    y: H * lane - arcHeight,
    w: 24,
    h: 24,
    value: 25,
    taken: false,
  };
}

export function spawnHeart(W, H) {
  const lane = Math.random() * 0.25 + 0.5;
  const arcHeight = Math.random() * 30 + 15;
  return {
    x: W + 20,
    y: H * lane - arcHeight,
    w: 20,
    h: 20,
    taken: false,
  };
}
