import { CONSTANTS } from './state.js';

export function resetPlayer(W, H) {
  const c = CONSTANTS;
  return {
    x: W * 0.18,
    y: H * c.GROUND_RATIO - c.PLAYER_H_STAND,
    w: c.PLAYER_W,
    h: c.PLAYER_H_STAND,
    vy: 0,
    onGround: true,
    invuln: 0,
    jumps: 0,
    ducking: false,
    standOn: null,
  };
}

export function doJump(player, state) {
  if (state.phase === 'dead') return;
  if (state.phase === 'run' || state.phase === 'idle' || state.phase === 'hurt') {
    player.vy = CONSTANTS.JUMP;
    player.onGround = false;
    state.phase = 'jump';
    player.jumps = 1;
    return true;
  } else if (state.phase === 'jump' || state.phase === 'double_jump') {
    if (player.jumps < CONSTANTS.MAX_JUMPS) {
      player.vy = CONSTANTS.DJUMP;
      state.phase = 'double_jump';
      player.jumps += 1;
      return true;
    }
  }
  return false;
}

export function doHurt(player, state) {
  if (player.invuln > 0 || state.phase === 'dead') return false;
  state.phase = 'hurt';
  player.invuln = 1.4;
  state.lives -= 1;
  state.combo = 0;
  state.comboTimer = 0;
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = 'dead';
    return true;
  }
  return true;
}

export function updatePhysics(player, W, H, dt, input, state) {
  const c = CONSTANTS;
  const down = input.down;

  if (down) {
    player.ducking = true;
    player.h = c.PLAYER_H_DUCK;
    player.y = H * c.GROUND_RATIO - c.PLAYER_H_DUCK;
    player.w = c.PLAYER_W;
  } else {
    player.ducking = false;
    player.w = c.PLAYER_W;
    player.h = c.PLAYER_H_STAND;
    player.y = Math.min(player.y, H * c.GROUND_RATIO - c.PLAYER_H_STAND);
  }

  const left = input.left;
  const right = input.right;
  if (left || right) {
    const ms = 220 * dt;
    if (left) player.x -= ms;
    if (right) player.x += ms;
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > W) player.x = W - player.w;
  }

  if (!player.onGround) {
    player.vy += c.GRAVITY * dt;
    player.y += player.vy * dt;
    const ground = H * c.GROUND_RATIO - (player.ducking ? c.PLAYER_H_DUCK : c.PLAYER_H_STAND);
    if (state.phase === 'double_jump' && player.vy > 0) state.phase = 'fall';
    else if (state.phase === 'jump' && player.vy > 0) state.phase = 'fall';
    if (player.y >= ground) {
      player.y = ground;
      player.vy = 0;
      player.onGround = true;
      state.phase = 'run';
      player.jumps = 0;
    }
  }
}

export function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function isTopCollision(player, obj) {
  if (!obj.landable) return false;
  if (player.vy <= 0) return false;
  const playerBottom = player.y + player.h;
  const tolerance = Math.max(6, Math.abs(player.vy) * 0.04);
  if (Math.abs(playerBottom - obj.y) < tolerance) {
    const pcx = player.x + player.w / 2;
    return pcx > obj.x - 2 && pcx < obj.x + obj.w + 2;
  }
  return false;
}

export function checkCollisions(player, state) {
  let hurt = false;
  let died = false;
  let heal = false;
  let stomp = false;

  for (let i = 0; i < state.obstacles.length; i++) {
    const o = state.obstacles[i];
    if (!o.passed && isTopCollision(player, o)) {
      player.y = o.y - player.h;
      player.vy = 0;
      player.onGround = true;
      state.phase = 'run';
      player.jumps = 0;
      continue;
    }
    if (!o.passed && rectsHit(player, o)) {
      if (player.ducking && o.type === 'low') continue;
      if (doHurt(player, state)) {
        if (state.phase === 'dead') died = true;
        else hurt = true;
      }
    }
  }

  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    if (!c.taken && rectsHit(player, c)) {
      c.taken = true;
      state.coinsTaken += 1;
      state.combo += 1;
      state.comboTimer = 2;
      state.score += c.value + state.combo * 2;
    }
  }

  for (let i = 0; i < state.hearts.length; i++) {
    const h = state.hearts[i];
    if (!h.taken && rectsHit(player, h)) {
      h.taken = true;
      if (state.lives < 3) {
        state.lives += 1;
        heal = true;
      }
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const en = state.enemies[i];
    if (isTopCollision(player, en)) {
      if (en.hp !== undefined) {
        en.hp -= 1;
        if (en.hp <= 0) {
          state.enemies.splice(i, 1);
          state.bossActive = false;
        }
      } else {
        state.enemies.splice(i, 1);
      }
      player.y = en.y - player.h;
      player.vy = -180;
      player.onGround = false;
      state.phase = 'jump';
      player.jumps = 1;
      state.combo += 1;
      state.comboTimer = 2;
      state.score += 50;
      stomp = true;
      continue;
    }

    const hitBox = {
      x: en.x + (en.hitExtra || 0),
      y: en.y + (en.hitExtra || 0),
      w: en.w - ((en.hitExtra || 0) * 2),
      h: en.h - ((en.hitExtra || 0) * 2),
    };
    if (en.hp !== undefined) {
      if (rectsHit(player, hitBox) && en.attackTimer <= 0) {
        en.hp -= 1;
        en.attackTimer = 0.9;
        if (doHurt(player, state)) {
          if (state.phase === 'dead') died = true;
          else hurt = true;
        }
        if (en.hp <= 0) {
          state.enemies.splice(i, 1);
          state.bossActive = false;
        }
      }
    } else if (rectsHit(player, hitBox)) {
      if (doHurt(player, state)) {
        if (state.phase === 'dead') died = true;
        else hurt = true;
      }
    }
  }
  return { hurt, died, heal, stomp };
}