export const CONSTANTS = {
  PLAYER_W: 44,
  PLAYER_H_DUCK: 32,
  PLAYER_H_STAND: 56,
  GROUND_RATIO: 0.82,
  GRAVITY: 1800,
  JUMP: -720,
  DJUMP: -620,
  MAX_JUMPS: 2,
  BG_STARS: 24,
};

export function createState() {
  return {
    phase: 'idle',
    runFrame: 0,
    speed: 10,
    distance: 0,
    score: 0,
    coinsTaken: 0,
    highScore: parseInt(localStorage.getItem('neonDashHigh') || '0', 10),
    paused: false,
    combo: 0,
    comboTimer: 0,
    spawnTimer: 1,
    obstacles: [],
    enemies: [],
    coins: [],
    particles: [],
    texts: [],
    camShake: 0,
    ducking: false,
    lives: 3,
    invulnTimer: 0,
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 0,
  };
}

export function createPlayer(W, H) {
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
  };
}
