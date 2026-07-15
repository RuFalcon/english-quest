import { UNLOCK_ORDER, getCategory } from "./data.js";
import { categoryMastery } from "./learning.js";

const KEY = "english-quest-v2";

const defaultState = () => ({
  stars: 0,
  bestStreak: 0,
  played: 0,
  categoryStars: {},
  unlocked: ["animals", "colors", "numbers"],
  soundOn: true,
  wordStats: {},
  /** `${categoryId}:${gameId}:${yyyy-mm-dd}` → plays today */
  gamePlays: {},
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("english-quest-v1");
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const merged = { ...defaultState(), ...parsed };
    if (!merged.wordStats || typeof merged.wordStats !== "object") merged.wordStats = {};
    if (!merged.gamePlays || typeof merged.gamePlays !== "object") merged.gamePlays = {};
    if (!Array.isArray(merged.unlocked)) merged.unlocked = defaultState().unlocked;
    return merged;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** Diminishing returns: 1st play 100%, 2nd 70%, 3rd+ 40% of earned stars */
export function starMultiplier(state, categoryId, gameId) {
  const key = `${categoryId}:${gameId}:${todayKey()}`;
  const plays = state.gamePlays?.[key] || 0;
  if (plays <= 0) return 1;
  if (plays === 1) return 0.7;
  return 0.4;
}

export function bumpGamePlay(state, categoryId, gameId) {
  const key = `${categoryId}:${gameId}:${todayKey()}`;
  return {
    ...state,
    gamePlays: {
      ...(state.gamePlays || {}),
      [key]: (state.gamePlays?.[key] || 0) + 1,
    },
  };
}

function canUnlockNext(state, prevId) {
  const stars = state.categoryStars[prevId] || 0;
  const mastery = categoryMastery(state, prevId).percent;
  // Need both practice (stars) and some real learning (mastery)
  return stars >= 8 && mastery >= 45;
}

export function applyUnlocks(state) {
  const unlocked = new Set(state.unlocked);
  for (const id of UNLOCK_ORDER) {
    if (unlocked.has(id)) continue;
    const prev = UNLOCK_ORDER[UNLOCK_ORDER.indexOf(id) - 1];
    if (prev && canUnlockNext(state, prev)) unlocked.add(id);
  }
  return { ...state, unlocked: [...unlocked] };
}

export function addStars(state, amount, categoryId, gameId) {
  const mult = gameId ? starMultiplier(state, categoryId, gameId) : 1;
  const earned = Math.max(0, Math.round(amount * mult));
  let next = {
    ...state,
    stars: state.stars + earned,
    played: state.played + 1,
    categoryStars: {
      ...state.categoryStars,
      [categoryId]: (state.categoryStars[categoryId] || 0) + earned,
    },
  };
  if (gameId) next = bumpGamePlay(next, categoryId, gameId);
  next = applyUnlocks(next);
  next._lastEarned = earned;
  next._starMult = mult;
  return next;
}

export function starsNeededFor(categoryId, state) {
  const idx = UNLOCK_ORDER.indexOf(categoryId);
  if (idx <= 0) return 0;
  const prev = UNLOCK_ORDER[idx - 1];
  const stars = state.categoryStars[prev] || 0;
  const mastery = categoryMastery(state, prev).percent;
  return { prev, prevTitle: getCategory(prev)?.title, stars, mastery };
}
