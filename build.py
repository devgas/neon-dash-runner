#!/usr/bin/env python3
"""
Build script: assemble single self-contained index.html with base64 assets.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)

with open(ROOT / 'assets' / 'audio' / 'audio_base64.json', 'r', encoding='utf-8') as f:
    audio = json.load(f)
with open(ROOT / 'assets' / 'visual' / 'visual_base64.json', 'r', encoding='utf-8') as f:
    visual = json.load(f)

def to_data_uri(name: str, b64: str) -> str:
    if name.endswith('.png'):
        mime = 'image/png'
    elif name.endswith('.wav'):
        mime = 'audio/wav'
    else:
        mime = 'application/octet-stream'
    return f"data:{mime};base64,{b64}"

AUDIO_BLOCK = 'const AUDIO={' + ','.join(f'"{k}":"{to_data_uri(k,v)}"' for k,v in audio.items()) + '};'
IMG_BLOCK = 'const IMG={' + ','.join(f'"{k.replace(".","_").replace("-","_")}":"{to_data_uri(k,v)}"' for k,v in visual.items()) + '};'

CSS = """*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#0B0C10;overflow:hidden}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
canvas{display:block;width:100vw;height:100vh;background:#0B0C10}
#ui{position:absolute;inset:0;pointer-events:none}
#hud{position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;color:#66FCF1;font-size:14px;text-shadow:0 0 8px rgba(102,252,241,.6)}
#combo{color:#45A29E}
#overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(11,12,16,.65);backdrop-filter:blur(6px);pointer-events:auto}
#panel{background:rgba(11,12,16,.85);border:1px solid #66FCF1;border-radius:12px;padding:24px 32px;text-align:center;box-shadow:0 0 20px rgba(102,252,241,.25)}
#panel h1{color:#66FCF1;font-size:22px;letter-spacing:4px;margin-bottom:12px}
#final-score,#best-score{color:#C5C6C7;font-size:16px;margin:6px 0}
#btn,#menu-start,#menu-audio{margin-top:14px;padding:14px 22px;border:1px solid #66FCF1;background:#1F2833;color:#66FCF1;font-family:inherit;font-size:19px;border-radius:10px;cursor:pointer;transition:transform .08s,background .2s;width:100%;max-width:320px}
#btn:hover,#menu-start:hover,#menu-audio:hover{background:#2a3a4a}
#btn:active,#menu-start:active,#menu-audio:active{transform:translateY(1px)}
.hidden{display:none!important}
#hud .heart.lost{opacity:.25}

#touch-top,#touch-bottom{position:absolute;left:0;right:0;z-index:5;touch-action:none}
#touch-top{top:0;height:55%}
#touch-bottom{bottom:0;height:45%}

#menu{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(11,12,16,.85);backdrop-filter:blur(12px);pointer-events:auto;z-index:10}
#menu-panel{background:rgba(11,12,16,.9);border:1px solid #66FCF1;border-radius:14px;padding:26px 28px;text-align:center;box-shadow:0 0 28px rgba(102,252,241,.25);width:min(92vw, 420px)}
#menu-panel h1{color:#66FCF1;font-size:26px;letter-spacing:6px;margin-bottom:18px}
.menu-hint{color:#C5C6C7;font-size:14px;opacity:.9;margin-bottom:16px}
.menu-row{display:flex;justify-content:center;margin:8px 0}
.menu-sub{color:#45A29E;font-size:12px;margin-top:14px;opacity:.85;line-height:1.5}

@media (max-width:480px){
  #panel{padding:18px 16px;border-radius:12px}
  #panel h1{font-size:18px;letter-spacing:3px}
  #menu-panel{padding:20px 16px;border-radius:12px}
  #menu-panel h1{font-size:22px;letter-spacing:4px}
  #btn,#menu-start,#menu-audio{font-size:16px;padding:12px 16px;max-width:100%}
}
"""

ATLAS = {
    'idle-breath': (0, 0),
    'run0': (48, 0),
    'run1': (96, 0),
    'run2': (144, 0),
    'run3': (192, 0),
    'run4': (240, 0),
    'run5': (288, 0),
    'jump': (336, 0),
    'fall': (384, 0),
    'duck': (432, 0),
    'hurt-flash': (480, 0),
}

JS = r"""
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score-val');
const comboEl=document.getElementById('combo-val');
const overlay=document.getElementById('overlay');
const finalScoreEl=document.getElementById('final-score');
const bestScoreEl=document.getElementById('best-score');
const btn=document.getElementById('btn');
const hint=document.getElementById('hint');

let W=0,H=0;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
window.addEventListener('resize',resize);
resize();

function loadImage(uri){const img=new Image();img.src=uri;return img;}
const BG1=loadImage(IMG.layer1_skyline_png);
const BG2=loadImage(IMG.layer2_ground_png);
const spriteSheet=loadImage(IMG.spritesheet_png);
const coinImg=loadImage(IMG.coin_png);
const obstacleImg=loadImage(IMG.obstacle_png);
const obstacleTopImg=loadImage(IMG.obstacle_top_png);
const obstacleCrateImg=loadImage(IMG.obstacle_crate_png);
const ATLAS = {""" + ','.join(f'"{k}":{{x:{x},y:{y},w:48,h:48}}' for k,(x,y) in ATLAS.items()) + r"""};

let actx=null;
function ensureAudio(){if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();if(actx&&actx.state==='suspended')actx.resume();return actx&&actx.state==='running';}

async function decodeAndPlay(uri,vol=0.8){if(!actx)return;try{const resp=fetch(uri);if(!resp.ok)return;const buf=await resp.arrayBuffer();const audioBuf=await actx.decodeAudioData(buf);const src=actx.createBufferSource();src.buffer=audioBuf;const gain=actx.createGain();gain.gain.value=vol;src.connect(gain).connect(actx.destination);src.start(0);}catch(e){}}

function playSound(name,vol=0.8){if(!AUDIO[name])return;ensureAudio();decodeAndPlay(AUDIO[name],vol);}

function playMusic(name){ensureAudio();decodeAndPlay(AUDIO[name],0.7);}

const keys=new Set();
window.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','KeyW'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>keys.delete(e.code));

const touchTop=document.createElement('div');
touchTop.id='touch-top';
const touchBottom=document.createElement('div');
touchBottom.id='touch-bottom';
document.body.appendChild(touchTop);
document.body.appendChild(touchBottom);
function onJumpStart(e){const t=e.target;if(t&&t.tagName==='BUTTON')return;e.preventDefault();ensureAudio();if(['idle','run','jump','double_jump','hurt'].includes(state))doJump();}
function onDuckStart(e){const t=e.target;if(t&&t.tagName==='BUTTON')return;e.preventDefault();ensureAudio();ducking=true;}
function onDuckEnd(e){ducking=false;}
[ [touchTop,'touchstart',onJumpStart],[touchTop,'touchend',onDuckEnd],[touchBottom,'touchstart',onDuckStart],[touchBottom,'touchend',onDuckEnd],[touchBottom,'touchmove',e=>e.preventDefault()] ].forEach(([el,t,fn])=>el.addEventListener(t,fn,{passive:t==='touchstart'?false:true}));

let state='idle';
let runFrame=0;
let speed=6;
let distance=0;
let score=0;
let highScore=parseInt(localStorage.getItem('neonDashHigh')||'0',10);
let combo=0;
let comboTimer=0;
let spawnTimer=1;
let obstacles=[];
let coins=[];
let particles=[];
let texts=[];
let camShake=0;
let ducking=false;

const PLAYER_W=44;
const PLAYER_H_DUCK=32;
const PLAYER_H_STAND=56;
const GROUND_RATIO=0.82;
const GRAVITY=1800;
const JUMP=-720;
const DJUMP=-620;
const MAX_JUMPS=2;

let player={x:0,y:0,w:PLAYER_W,h:PLAYER_H_STAND,vy:0,onGround:true,invuln:0,jumps:0};

function reset(){state='run';runFrame=0;distance=0;score=0;combo=0;comboTimer=0;speed=6;obstacles=[];coins=[];particles=[];texts=[];camShake=0;ducking=false;player.x=W*0.18;player.y=H*GROUND_RATIO-player.h;player.vy=0;player.onGround=true;player.invuln=0;player.jumps=0;player.w=PLAYER_W;player.h=PLAYER_H_STAND;spawnTimer=1;overlay.classList.add('hidden');scoreEl.textContent='0';comboEl.textContent='0';ensureAudio();playMusic('gameplay_loop.wav');}

function gameOver(){state='dead';playSound('hit.wav',1.2);playSound('gameover_sting.wav',0.9);if(score>highScore){highScore=score;localStorage.setItem('neonDashHigh',String(highScore));}finalScoreEl.textContent=String(score);bestScoreEl.textContent='BEST '+String(highScore);overlay.classList.remove('hidden');}

btn.addEventListener('click',()=>{ensureAudio();reset();});

const menuEl=document.getElementById('menu');
const menuStart=document.getElementById('menu-start');
const menuAudio=document.getElementById('menu-audio');
const menuHint=document.querySelector('.menu-hint');
let audioEnabled=false;

function showMenu(){state='idle';menuEl.classList.remove('hidden');overlay.classList.add('hidden');hint.textContent='TAP START';if(menuHint)menuHint.textContent='TAP ANYWHERE TO START';}
function hideMenu(){menuEl.classList.add('hidden');}

function toggleAudio(){audioEnabled=!audioEnabled;ensureAudio();if(!audioEnabled){if(actx)actx.suspend();}else{if(actx)actx.resume();}if(menuAudio)menuAudio.textContent='AUDIO: '+(audioEnabled?'ON':'OFF');}
menuAudio.addEventListener('click',e=>{e.preventDefault();toggleAudio();});
menuStart.addEventListener('click',e=>{e.preventDefault();hideMenu();if(!audioEnabled)toggleAudio();ensureAudio();reset();});
menuHint?.addEventListener('click',()=>{if(menuEl.classList.contains('hidden')===false){hideMenu();if(!audioEnabled)toggleAudio();ensureAudio();reset();}});
menuEl.addEventListener('click',ev=>{if(ev.target===menuEl){hideMenu();ensureAudio();reset();}});
canvas.addEventListener('click',()=>{if(!menuEl.classList.contains('hidden')){hideMenu();if(!audioEnabled)toggleAudio();ensureAudio();reset();}});

function startFullscreen(){const el=document.documentElement;if(el.requestFullscreen)el.requestFullscreen().catch(()=>{});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen?.();}
window.addEventListener('touchstart',startFullscreen,{once:true});

showMenu();
[menuStart,menuAudio].forEach(b=>b.addEventListener('pointerenter',()=>playSound('ui_hover.wav',0.4)));

function rand(a,b){return a+Math.random()*(b-a);}
function rectsHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function spawnObstacle(){const r=Math.random();let type='barrier';if(r<0.25)type='double';else if(r<0.45)type='crate';else if(r<0.55)type='low';const lane=Math.random()*0.35+0.3;const o={x:W+40,y:0,w:0,h:0,type,passed:false};if(type==='barrier')o.w=36;else if(type==='double')o.w=36;else if(type==='crate')o.w=44;else if(type==='low')o.w=50;o.y=H*lane-(type==='low'?0:o.h);if(type==='low')o.h=28;else if(type==='crate')o.h=44;else o.h=56;obstacles.push(o);}

function spawnCoin(){const lane=Math.random()*0.35+0.3;coins.push({x:W+20,y:H*lane,w:24,h:24,value:10,taken:false});}

function addParticles(x,y,color,count=6){for(let i=0;i<count;i++){particles.push({x,y,vx:rand(-120,120),vy:rand(-180,-40),life:0.5,maxLife:0.5,color,size:rand(2,5)});}}

function addText(x,y,text){texts.push({x,y,text,life:0.8,maxLife:0.8});}

function doJump(){if(state==='dead'||state==='hurt')return;ensureAudio();if(state==='run'||state==='idle'){player.vy=JUMP;player.onGround=false;state='jump';player.jumps=1;playSound('jump.wav',0.7);addParticles(player.x+player.w/2,player.y+player.h,'#66FCF1',4);}else if(state==='jump'||state==='double_jump'){if(player.jumps<MAX_JUMPS){player.vy=DJUMP;state='double_jump';player.jumps+=1;playSound('double_jump.wav',0.6);addParticles(player.x+player.w/2,player.y+player.h,'#45A29E',5);}}}

function doHurt(){if(player.invuln>0||state==='dead')return;state='hurt';player.invuln=1.2;combo=0;comboTimer=0;playSound('hit.wav',1.0);addParticles(player.x+player.w/2,player.y+player.h/2,'#ff4444',10);camShake=0.25;}

function clampImageArgs(name,a){
  if(!spriteSheet.complete || !spriteSheet.naturalWidth) return null;
  let sx=a.x, sy=a.y, sw=a.w, sh=a.h;
  if(sx<0)sx=0; if(sy<0)sy=0;
  if(sw<=0||sh<=0) return null;
  if(sx+sw>spriteSheet.naturalWidth) sw=spriteSheet.naturalWidth-sx;
  if(sy+sh>spriteSheet.naturalHeight) sh=spriteSheet.naturalHeight-sy;
  if(sw<=0||sh<=0) return null;
  return {sx,sy,sw,sh};
}

function update(dt){
  if(state==='dead') return;
  if(state!=='idle'){
    distance+=speed*dt/16.67; score=Math.floor(distance);
  }
  comboTimer=Math.max(0,comboTimer-dt);
  if(comboTimer<=0) combo=0;

  spawnTimer-=dt*(speed/6);
  if(spawnTimer<=0){
    spawnTimer=rand(0.6,1.6)-speed*0.04;
    if(spawnTimer<0.35)spawnTimer=0.35;
    if(Math.random()<0.75)spawnObstacle();else spawnCoin();
  }

  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];o.x-=speed*2.8*dt;if(o.x+o.w<-10)obstacles.splice(i,1);}
  for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.x-=speed*2.8*dt;if(c.x+c.w<-10)coins.splice(i,1);}

  if(state==='run'||state==='jump'||state==='double_jump'||state==='hurt'){
    const down=keys.has('ArrowDown')||keys.has('KeyS')||ducking;
    if(down){player.ducking=true;player.h=PLAYER_H_DUCK;player.y=H*GROUND_RATIO-PLAYER_H_DUCK;player.w=PLAYER_W;}
    else{player.ducking=false;player.w=PLAYER_W;player.h=PLAYER_H_STAND;player.y=Math.min(player.y,H*GROUND_RATIO-PLAYER_H_STAND);}
    if(!player.onGround){
      player.vy+=GRAVITY*dt;player.y+=player.vy*dt;
      const ground=H*GROUND_RATIO-(player.ducking?PLAYER_H_DUCK:PLAYER_H_STAND);
      if(player.y>=ground){player.y=ground;player.vy=0;player.onGround=true;state='run';player.jumps=0;}
    }
  }

  for(let i=0;i<obstacles.length;i++){const o=obstacles[i];if(!o.passed&&rectsHit(player,o)){if(player.ducking&&o.type==='low')continue;doHurt();}}
  for(let i=0;i<coins.length;i++){const c=coins[i];if(!c.taken&&rectsHit(player,c)){c.taken=true;combo+=1;comboTimer=2;score+=c.value+combo*2;playSound('coin_collect.wav',0.5);addText(c.x,c.y-10,'+'+String(c.value+combo*2));addParticles(c.x+c.w/2,c.y+c.h/2,'#66FCF1',4);}}

  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;if(p.life<=0)particles.splice(i,1);}
  for(let i=texts.length-1;i>=0;i--){const t=texts[i];t.life-=dt;t.y-=60*dt;if(t.life<=0)texts.splice(i,1);}

  if(player.invuln>0)player.invuln-=dt;
  if(state==='run'||state==='jump'||state==='double_jump'||state==='hurt'){speed+=(2*dt)/(5*16.67);if(speed>14)speed=14;}

  scoreEl.textContent=String(score);
  comboEl.textContent=String(combo);
}

function drawBg(wrapX){
  const x1=-wrapX*0.2;
  const x2=-wrapX*1.0;
  ctx.fillStyle='#0B0C10';ctx.fillRect(0,0,W,H);
  if(BG1.complete){
    const w1=BG1.width||2048;
    const h1=H*0.55;
    const drawW=Math.max(0,W*0.9);
    const srcX=((x1%w1)+w1)%w1;
    ctx.drawImage(BG1,srcX,0,w1,BG1.height||512,0,0,drawW,h1);
    ctx.drawImage(BG1,((srcX+w1)%w1),0,w1,BG1.height||512,drawW,0,drawW,h1);
  }
  if(BG2.complete){
    const w2=BG2.width||2048;
    const h2=H*0.3;
    const drawW2=W;
    const srcX2=((x2%w2)+w2)%w2;
    ctx.drawImage(BG2,srcX2,H*0.7,w2,BG2.height||256,0,H*0.7,drawW2,h2);
    ctx.drawImage(BG2,((srcX2+w2)%w2),H*0.7,w2,BG2.height||256,drawW2,H*0.7,drawW2,h2);
  }
  ctx.fillStyle='#11151c';ctx.fillRect(0,H*0.82,W,H*0.18);
  ctx.fillStyle='#66FCF1';ctx.fillRect(0,H*0.82,W,2);
}

function drawSprite(name,x,y,w,h){const a=ATLAS[name];if(!a)return;const c=clampImageArgs(name,a);if(!c)return;ctx.drawImage(spriteSheet,c.sx,c.sy,c.sw,c.sh,x,y,w,h);}

function render(){
  ctx.save();
  if(camShake>0){const i=camShake*4;ctx.translate(rand(-i,i),rand(-i,i));camShake=Math.max(0,camShake-0.05);}
  const wrapX=distance*32;drawBg(wrapX);
  for(let i=0;i<coins.length;i++){const c=coins[i];if(c.taken)continue;ctx.drawImage(coinImg,c.x,c.y,c.w,c.h);}
  for(let i=0;i<obstacles.length;i++){const o=obstacles[i];let img=obstacleImg;if(o.type==='low')img=obstacleTopImg;if(o.type==='crate')img=obstacleCrateImg;ctx.drawImage(img,o.x,o.y,o.w,o.h);}
  for(let i=0;i<particles.length;i++){const p=particles[i];ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  let sprite='run0';
  if(state==='idle')sprite='idle-breath';
  else if(state==='run')sprite='run'+Math.floor(runFrame/4)%6;
  else if(state==='jump'||state==='double_jump')sprite='jump';
  else if(state==='fall')sprite='fall';
  else if(state==='hurt'||state==='dead')sprite='hurt-flash';
  drawSprite(sprite,player.x,player.y,player.w,player.h);
  ctx.fillStyle='#66FCF1';ctx.font='bold 14px monospace';
  for(let i=0;i<texts.length;i++){const t=texts[i];ctx.globalAlpha=Math.max(0,t.life/t.maxLife);ctx.fillText(t.text,t.x,t.y);}
  ctx.globalAlpha=1;
  ctx.restore();
}

function loop(ts){
  if(!lastTime)lastTime=ts;
  let dt=(ts-lastTime)/1000;
  if(dt>0.1)dt=0.1;
  lastTime=ts;
  if(state==='idle'){runFrame+=dt;render();}
  else if(state==='run'||state==='jump'||state==='double_jump'||state==='hurt'){runFrame+=dt*60;update(dt);render();if(player.y>H+100)gameOver();}
  requestAnimationFrame(loop);
}

player.x=W*0.18;player.y=H*GROUND_RATIO-PLAYER_H_STAND;
hint.textContent='SPACE / TAP to start';
let lastTime=0;
requestAnimationFrame(loop);

window.addEventListener('keydown',e=>{ensureAudio();if(['Space','ArrowUp','KeyW'].includes(e.code)&&state==='idle')reset();if(['Space','ArrowUp','KeyW'].includes(e.code)&&(state==='run'||state==='jump'||state==='double_jump'||state==='hurt'))doJump();if(['ArrowDown','KeyS'].includes(e.code)&&(state==='run'||state==='jump'||state==='double_jump'||state==='hurt'))ducking=true;});
window.addEventListener('keyup',e=>{if(['ArrowDown','KeyS'].includes(e.code))ducking=false;});
"""

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<title>NEON DASH</title>
<style>
{CSS}
</style>
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
      <p id="hint">SPACE / TAP to start</p>
    </div>
  </div>
  <div id="menu" class="hidden">
    <div id="menu-panel">
      <h1>NEON DASH</h1>
      <p class="menu-hint">TAP ANYWHERE TO START</p>
      <div class="menu-row">
        <button id="menu-start">START</button>
      </div>
      <div class="menu-row">
        <button id="menu-audio">AUDIO: OFF</button>
      </div>
      <p class="menu-sub">JUMP: tap top • DUCK: tap bottom</p>
    </div>
  </div>
</div>
<script>
window.__neonLogs=(window.__neonLogs||[]);
window.__neonLogs.push('script-start');
{AUDIO_BLOCK}
{IMG_BLOCK}
{JS}
window.__neonLogs.push('script-end');
</script>
</body>
</html>"""

(DIST / 'index.html').write_text(HTML, encoding='utf-8')
print('Built', DIST / 'index.html', (DIST / 'index.html').stat().st_size)
