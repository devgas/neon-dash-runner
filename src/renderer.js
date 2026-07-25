import { ATLAS } from './assets.js';

function clampImageArgs(name, a, spriteSheet) {
  if (!spriteSheet.complete || !spriteSheet.naturalWidth) return null;
  let sx = a.x,
    sy = a.y,
    sw = a.w,
    sh = a.h;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sw <= 0 || sh <= 0) return null;
  if (sx + sw > spriteSheet.naturalWidth) sw = spriteSheet.naturalWidth - sx;
  if (sy + sh > spriteSheet.naturalHeight) sh = spriteSheet.naturalHeight - sy;
  if (sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
}

export function drawSprite(ctx, spriteSheet, name, x, y, w, h) {
  const a = ATLAS[name];
  if (!a) return;
  const c = clampImageArgs(name, a, spriteSheet);
  if (!c) return;
  ctx.drawImage(spriteSheet, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
}

export function drawBg(ctx, W, H, wrapX, BG1, BG2) {
  const x1 = -wrapX * 0.2;
  const x2 = -wrapX * 1.0;
  ctx.fillStyle = '#0B0C10';
  ctx.fillRect(0, 0, W, H);

  if (BG1.complete) {
    const w1 = BG1.width || 2048;
    const h1 = H * 0.55;
    const drawW = Math.max(0, W * 0.9);
    const srcX = ((x1 % w1) + w1) % w1;
    ctx.drawImage(BG1, srcX, 0, w1, BG1.height || 512, 0, 0, drawW, h1);
    ctx.drawImage(BG1, ((srcX + w1) % w1), 0, w1, BG1.height || 512, drawW, 0, drawW, h1);
  }
  if (BG2.complete) {
    const w2 = BG2.width || 2048;
    const h2 = H * 0.3;
    const drawW2 = W;
    const srcX2 = ((x2 % w2) + w2) % w2;
    ctx.drawImage(BG2, srcX2, H * 0.7, w2, BG2.height || 256, 0, H * 0.7, drawW2, h2);
    ctx.drawImage(BG2, ((srcX2 + w2) % w2), H * 0.7, w2, BG2.height || 256, drawW2, H * 0.7, drawW2, h2);
  }

  for (let i = 0; i < 24; i++) {
    const sx = (i * 137 + i * 53) % W;
    ctx.fillStyle = 'rgba(102,252,241,0.08)';
    ctx.fillRect(sx, H * 0.08 + ((i * 23) % (H * 0.45)), 1.5, 1.5);
  }
  ctx.fillStyle = '#11151c';
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
  ctx.fillStyle = '#66FCF1';
  ctx.fillRect(0, H * 0.82, W, 2);
}

export function render(
  ctx,
  W,
  H,
  state,
  player,
  images,
  rand
) {
  ctx.save();
  if (state.camShake > 0) {
    const i = state.camShake * 4;
    ctx.translate(rand(-i, i), rand(-i, i));
    state.camShake = Math.max(0, state.camShake - 0.05);
  }
  const wrapX = state.distance * 32;
  drawBg(ctx, W, H, wrapX, images.BG1, images.BG2);

  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    if (c.taken) continue;
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.rotate(state.distance * 0.1 + i);
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#66FCF1';
    ctx.drawImage(images.coinImg, -c.w / 2, -c.h / 2, c.w, c.h);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  for (let i = 0; i < state.hearts.length; i++) {
    const h = state.hearts[i];
    if (h.taken) continue;
    ctx.save();
    ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff4466';
    ctx.drawImage(images.heartImg, -h.w / 2, -h.h / 2, h.w, h.h);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  for (let i = 0; i < state.obstacles.length; i++) {
    const o = state.obstacles[i];
    let img = images.obstacleImg;
    if (o.type === 'low') img = images.obstacleTopImg;
    if (o.type === 'crate') img = images.obstacleCrateImg;
    ctx.drawImage(img, o.x, o.y, o.w, o.h);
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const en = state.enemies[i];
    if (en.type === 'boss') {
      if (images.bossImg.complete) ctx.drawImage(images.bossImg, en.x, en.y, en.w, en.h);
    } else if (en.type === 'fly') {
      if (images.enemyFlyImg.complete) ctx.drawImage(images.enemyFlyImg, en.x, en.y, en.w, en.h);
    } else {
      if (images.enemyGroundImg.complete) ctx.drawImage(images.enemyGroundImg, en.x, en.y, en.w, en.h);
    }
  }

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  let sprite = 'run0';
  if (state.phase === 'idle') sprite = 'idle-breath';
  else if (state.phase === 'run') sprite = 'run' + Math.floor(state.runFrame / 4) % 6;
  else if (state.phase === 'jump' || state.phase === 'double_jump') sprite = 'jump';
  else if (state.phase === 'fall') sprite = 'fall';
  else if (state.phase === 'hurt' || state.phase === 'dead') sprite = 'hurt-flash';
  drawSprite(ctx, images.spriteSheet, sprite, player.x, player.y, player.w, player.h);

  ctx.fillStyle = '#66FCF1';
  ctx.font = 'bold 14px monospace';
  for (let i = 0; i < state.texts.length; i++) {
    const t = state.texts[i];
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
