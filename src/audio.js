import { AUDIO_PATHS } from './assets.js';

const sfxCache = new Map();
let musicAudio = null;

function getSfx(name) {
  if (!sfxCache.has(name)) {
    const path = AUDIO_PATHS[name];
    if (!path) return null;
    const audio = new Audio(path);
    audio.preload = 'auto';
    sfxCache.set(name, audio);
  }
  const audio = sfxCache.get(name);
  audio.currentTime = 0;
  return audio;
}

export function ensureAudio() {}

export function isAudioEnabled() {
  return true;
}

export function setAudioEnabled(enabled) {}

export function playMusic(name) {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.currentTime = 0;
  }
  const path = AUDIO_PATHS[name];
  if (!path) return;
  musicAudio = new Audio(path);
  musicAudio.volume = 0.7;
  musicAudio.loop = true;
  musicAudio.play().catch(() => {});
}

export function stopMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio.currentTime = 0;
    musicAudio = null;
  }
}

export function playSound(name, vol = 0.8) {
  const audio = getSfx(name);
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, vol));
  audio.play().catch(() => {});
}
