import { shuffle, pickN } from "./utils.js";
import { phrases, getCategory, UNLOCK_ORDER } from "./data.js";

const DAY = 24 * 60 * 60 * 1000;

export function wordKey(categoryId, en) {
  return `${categoryId}::${en}`;
}

export function getWordStat(state, key) {
  return (
    state.wordStats?.[key] || {
      correct: 0,
      wrong: 0,
      streak: 0,
      level: 0,
      nextReview: 0,
      lastSeen: 0,
    }
  );
}

/** 0 new · 1 learning · 2 familiar · 3 mastered */
export function masteryLevel(stat) {
  return stat?.level || 0;
}

export function categoryMastery(state, categoryId) {
  const cat = getCategory(categoryId);
  if (!cat) return { mastered: 0, familiar: 0, learning: 0, new: 0, total: 0, percent: 0 };
  let mastered = 0;
  let familiar = 0;
  let learning = 0;
  let fresh = 0;
  for (const w of cat.words) {
    const lvl = masteryLevel(getWordStat(state, wordKey(categoryId, w.en)));
    if (lvl >= 3) mastered++;
    else if (lvl === 2) familiar++;
    else if (lvl === 1) learning++;
    else fresh++;
  }
  const total = cat.words.length;
  const percent = Math.round(((mastered * 1 + familiar * 0.6 + learning * 0.25) / total) * 100);
  return { mastered, familiar, learning, new: fresh, total, percent };
}

export function recordAnswer(state, categoryId, en, ok) {
  const key = wordKey(categoryId, en);
  const prev = getWordStat(state, key);
  const now = Date.now();
  const next = { ...prev, lastSeen: now };

  if (ok) {
    next.correct = (prev.correct || 0) + 1;
    next.streak = (prev.streak || 0) + 1;
    if (next.streak >= 3 && next.correct >= 3) next.level = 3;
    else if (next.correct >= 2) next.level = Math.max(prev.level || 0, 2);
    else next.level = Math.max(prev.level || 0, 1);
    const days = next.level >= 3 ? 7 : next.level >= 2 ? 3 : 1;
    next.nextReview = now + days * DAY;
  } else {
    next.wrong = (prev.wrong || 0) + 1;
    next.streak = 0;
    next.level = Math.min(prev.level || 0, 1) || 1;
    next.nextReview = now;
  }

  return {
    ...state,
    wordStats: { ...(state.wordStats || {}), [key]: next },
  };
}

/** Prefer due / weak / unseen words for spaced practice */
export function pickSessionWords(cat, state, n) {
  const now = Date.now();
  const scored = cat.words.map((w) => {
    const st = getWordStat(state, wordKey(cat.id, w.en));
    let score = 0;
    if (!st.lastSeen) score += 40;
    if (st.nextReview && st.nextReview <= now) score += 50;
    if ((st.wrong || 0) > (st.correct || 0)) score += 35;
    if ((st.level || 0) <= 1) score += 20;
    if ((st.level || 0) >= 3) score -= 25;
    score += Math.random() * 8;
    return { w, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(n, scored.length)).map((x) => x.w);
}

/**
 * Round queue with one re-queue of wrong items ~2–3 steps later.
 * Items may be words {en} or phrases {en: string[]}.
 */
export function createRoundQueue(items, getKey) {
  const queue = [...items];
  const retried = new Set();
  let index = 0;

  return {
    get length() {
      return queue.length;
    },
    current() {
      return queue[index];
    },
    done() {
      return index >= queue.length;
    },
    progressIndex() {
      return Math.min(index, queue.length);
    },
    markCorrect() {
      index += 1;
    },
    markWrong() {
      const item = queue[index];
      const key = getKey(item);
      if (key && !retried.has(key)) {
        retried.add(key);
        const insertAt = Math.min(index + 3, queue.length);
        queue.splice(insertAt, 0, item);
      }
      index += 1;
    },
  };
}

export function phrasesForCategory(categoryId, unlockedIds) {
  const unlocked = new Set(unlockedIds);
  const themed = phrases.filter(
    (p) =>
      (!p.themes || p.themes.some((t) => unlocked.has(t))) &&
      (!p.themes || p.themes.includes(categoryId) || p.themes.some((t) => unlocked.has(t)))
  );
  const prefer = themed.filter((p) => !p.themes || p.themes.includes(categoryId));
  const pool = prefer.length >= 4 ? prefer : themed.length ? themed : phrases;
  return pickN(pool, Math.min(7, pool.length));
}

export function nextUnlockHint(state) {
  const unlocked = new Set(state.unlocked);
  for (let i = 1; i < UNLOCK_ORDER.length; i++) {
    const id = UNLOCK_ORDER[i];
    if (unlocked.has(id)) continue;
    const prev = UNLOCK_ORDER[i - 1];
    const prevCat = getCategory(prev);
    const m = categoryMastery(state, prev);
    const stars = state.categoryStars[prev] || 0;
    const needStars = Math.max(0, 8 - stars);
    const needMastery = Math.max(0, 45 - m.percent);
    return {
      nextId: id,
      nextTitle: getCategory(id)?.title || id,
      prevId: prev,
      prevTitle: prevCat?.title || prev,
      needStars,
      needMastery,
      masteryPercent: m.percent,
      stars,
    };
  }
  return null;
}

export function shouldShowHint(state, categoryId) {
  const m = categoryMastery(state, categoryId);
  return m.percent < 40;
}

export function shuffleDistractors(cat, word, count = 3) {
  return pickN(
    cat.words.filter((w) => w.en !== word.en),
    count
  );
}
