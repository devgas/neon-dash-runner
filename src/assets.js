export function loadImages() {
  const img = (src) => {
    const i = new Image();
    i.src = src;
    return i;
  };
  return {
    BG1: img('/visual/layer1_skyline.png'),
    BG2: img('/visual/layer2_ground.png'),
    spriteSheet: img('/visual/spritesheet.png'),
    coinImg: img('/visual/coin.png'),
    heartImg: img('/visual/heart_full.png'),
    obstacleImg: img('/visual/obstacle.png'),
    obstacleTopImg: img('/visual/obstacle_top.png'),
    obstacleCrateImg: img('/visual/obstacle_crate.png'),
    enemyFlyImg: img('/visual/enemy_fly.png'),
    enemyGroundImg: img('/visual/enemy_ground.png'),
    bossImg: img('/visual/boss_0.png'),
  };
}

export const ATLAS = {
  'idle-breath': { x: 0, y: 0, w: 48, h: 48 },
  'run0': { x: 48, y: 0, w: 48, h: 48 },
  'run1': { x: 96, y: 0, w: 48, h: 48 },
  'run2': { x: 144, y: 0, w: 48, h: 48 },
  'run3': { x: 192, y: 0, w: 48, h: 48 },
  'run4': { x: 240, y: 0, w: 48, h: 48 },
  'run5': { x: 288, y: 0, w: 48, h: 48 },
  'jump': { x: 336, y: 0, w: 48, h: 48 },
  'fall': { x: 384, y: 0, w: 48, h: 48 },
  'duck': { x: 432, y: 0, w: 48, h: 48 },
  'hurt-flash': { x: 480, y: 0, w: 48, h: 48 },
};

export const AUDIO_PATHS = {
  'menu_loop.wav': '/audio/menu_loop.wav',
  'gameplay_loop.wav': '/audio/gameplay_loop.wav',
  'gameover_sting.wav': '/audio/gameover_sting.wav',
  'jump.wav': '/audio/jump.wav',
  'double_jump.wav': '/audio/double_jump.wav',
  'hit.wav': '/audio/hit.wav',
  'coin_collect.wav': '/audio/coin_collect.wav',
  'ui_hover.wav': '/audio/ui_hover.wav',
  'ui_confirm.wav': '/audio/ui_confirm.wav',
};
