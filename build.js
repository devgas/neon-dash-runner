#!/usr/bin/env env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const audioJson = JSON.parse(fs.readFileSync(path.join(root, 'audio', 'audio_base64.json'), 'utf8'));

const AUDIO_MAP = new Map([
  ['menu_loop.wav', 'MENU_LOOP'],
  ['gameplay_loop.wav', 'GAMEPLAY_LOOP'],
  ['gameover_sting.wav', 'GAMEOVER_STING'],
  ['jump.wav', 'JUMP'],
  ['double_jump.wav', 'DOUBLE_JUMP'],
  ['hit.wav', 'HIT'],
  ['coin_collect.wav', 'COIN'],
  ['ui_hover.wav', 'UI_HOVER'],
  ['ui_confirm.wav', 'UI_CONFIRM'],
]);

const audioConsts = [];
AUDIO_MAP.forEach((varName, key) => {
  let b64 = String(audioJson[key] || '');
  if (b64.length > 1_048_576) {
    console.warn(`Audio too large for inline: ${key} ${b64.length} bytes`);
  }
  audioConsts.push(`const ${varName}="${b64}";`);
});
const AUDIO_BLOCK = audioConsts.join('\n');

const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');

// Function to inline a base64 audio string as a JS module that decodes to AudioBufferPromise
function makeAudioModule(varName, b64) {
  // Simple: parse base64 bytes into Uint8Array, then use Web Audio decodeAudioData on fetch/data: URI
  // Since we cannot run binary tools in node easily without sharp, embed as data URI in JS string
  const dataUri = `data:audio/wav;base64,${b64}`;
  return `const ${varName}_URI="${dataUri}";`;
}

const audioUriDefs = [];
let audioSwitches = [];
AUDIO_MAP.forEach((varName, key) => {
  const b64 = String(audioJson[key] || '');
  audioUriDefs.push(`const ${varName}_URI="data:audio/wav;base64,${b64}";`);
  audioSwitches.push(`      case "${varName}": return ${varName}_URI;`);
});
const AUDIO_URI_BLOCK = audioUriDefs.join('\n');
const AUDIO_SWITCH_BLOCK = audioSwitches.join('\n');

const gameJs = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<title>NEON DASH</title>
<style>${css}</style>
</head>
<body>
<canvas id="game" aria-label="NEON DASH game"></canvas>
<div id="ui">
  <div id="hud">
    <div id="score">SCORE <span id="score-val">0</span></div>
    <div id="combo">COMBO <span id="combo-val">0</span></div>
  </div>
  <div id="overlay" class="hidden">
    <div id="panel">
      <h1>NEON DASH</h1>
      <p id="final-score">0</p>
      <p id="best-score">BEST 0</p>
      <button id="btn">RETRY</button>
      <p id="hint">SPACE to start</p>
    </div>
  </div>
</div>
<script>
try{${AUDIO_URI_BLOCK}
${gameJs}
}catch(e){console.error(e);document.body&&document.body.setAttribute('aria-busy','true');}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
console.log('Built dist/index.html');
