const STORAGE_KEY = 'neonDashLeaderboard';
const MAX_ENTRIES = 10;

export function getLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScore(initials, score) {
  const entries = getLeaderboard();
  entries.push({
    initials: String(initials).slice(0, 10).toUpperCase(),
    score,
    date: new Date().toLocaleDateString(),
  });
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function isHighScore(score) {
  const entries = getLeaderboard();
  if (entries.length < MAX_ENTRIES) return true;
  return score > (entries[entries.length - 1]?.score || 0);
}

export function getTopScore() {
  const entries = getLeaderboard();
  return entries[0]?.score || 0;
}
