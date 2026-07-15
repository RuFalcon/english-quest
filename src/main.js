import { categories, games, phrases, getCategory, UNLOCK_ORDER } from "./data.js";
import { loadState, saveState, addStars } from "./storage.js";
import { shuffle, speak, celebrate, confettiBurst } from "./utils.js";
import {
  pickSessionWords,
  createRoundQueue,
  recordAnswer,
  categoryMastery,
  phrasesForCategory,
  nextUnlockHint,
  shouldShowHint,
  shuffleDistractors,
} from "./learning.js";
import {
  setSoundEnabled,
  playClick,
  playPlace,
  playFlip,
  playCorrect,
  playWrong,
  playWin,
  playStar,
  playUnlock,
  playMatch,
  unlockAudio,
} from "./sounds.js";

const app = document.getElementById("app");
let state = loadState();
let route = { name: "home" };

setSoundEnabled(state.soundOn !== false);

function persist(next) {
  state = next;
  saveState(state);
  setSoundEnabled(state.soundOn !== false);
}

function go(name, params = {}) {
  route = { name, ...params };
  render();
}

function starsForScore(correct, total) {
  if (total <= 0) return 0;
  if (correct === total) return 3;
  if (correct >= Math.ceil(total * 0.7)) return 2;
  if (correct >= Math.ceil(total * 0.4)) return 1;
  return 0;
}

function topbar(extra = "") {
  const soundOn = state.soundOn !== false;
  return `
    <div class="topbar">
      <div class="brand">English <span>Quest</span></div>
      <div class="stats">
        <div class="stat-pill" id="stars-pill" title="Всего звёзд">⭐ ${state.stars}</div>
        <div class="stat-pill" title="Лучшая серия верных ответов подряд">🔥 ${state.bestStreak}</div>
        <button type="button" class="stat-pill sound-toggle" id="sound-btn" title="${soundOn ? "Выключить звуки" : "Включить звуки"}" aria-label="Звуки">
          ${soundOn ? "🔊" : "🔇"}
        </button>
        ${extra}
      </div>
    </div>
  `;
}

function bindSoundToggle() {
  const btn = app.querySelector("#sound-btn");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    unlockAudio();
    const nextOn = !(state.soundOn !== false);
    persist({ ...state, soundOn: nextOn });
    setSoundEnabled(nextOn);
    if (nextOn) playClick();
    btn.textContent = nextOn ? "🔊" : "🔇";
    btn.title = nextOn ? "Выключить звуки" : "Включить звуки";
  });
}

app.addEventListener(
  "click",
  (e) => {
    unlockAudio();
    const el = e.target.closest(
      "button, .card-btn, .game-row, .choice, .letter, .word-chip, .mem-card"
    );
    if (!el || el.disabled) return;
    if (el.id === "sound-btn") return;
    if (el.classList.contains("choice")) return;
    if (el.classList.contains("mem-card")) return;
    if (el.classList.contains("letter") || el.classList.contains("word-chip")) {
      playPlace();
      return;
    }
    playClick();
  },
  true
);

function masteryBar(percent) {
  return `
    <div class="mastery-bar" aria-label="Прогресс знаний ${percent}%">
      <i style="width:${percent}%"></i>
    </div>
  `;
}

function lockRequirement(catId) {
  const idx = UNLOCK_ORDER.indexOf(catId);
  if (idx <= 0) return "";
  const prev = UNLOCK_ORDER[idx - 1];
  const prevCat = getCategory(prev);
  const stars = state.categoryStars[prev] || 0;
  const m = categoryMastery(state, prev);
  return `🔒 ${prevCat?.title}: ${stars}/8⭐ · ${m.percent}/45%`;
}

function renderHome() {
  const unlocked = new Set(state.unlocked);
  const hint = nextUnlockHint(state);

  app.innerHTML = `
    <div class="screen">
      ${topbar()}
      <section class="hero">
        <div class="hero-boat" aria-hidden="true">⛵</div>
        <h1>Остров слов</h1>
        <p>Учи слова, исправляй ошибки и открывай новые темы настоящим знанием!</p>
      </section>

      <h2 class="section-title">Выбери тему</h2>
      <div class="grid">
        ${categories
          .map((c) => {
            const open = unlocked.has(c.id);
            const stars = state.categoryStars[c.id] || 0;
            const m = categoryMastery(state, c.id);
            return `
              <button class="card-btn ${open ? "" : "locked"}" data-cat="${c.id}" ${open ? "" : "disabled"}
                style="--cat:${c.color}"
                aria-label="${c.title}${open ? "" : ", закрыто"}">
                ${open ? "" : `<span class="lock-badge">${lockRequirement(c.id)}</span>`}
                <span class="emoji" aria-hidden="true">${c.emoji}</span>
                <strong>${c.title}</strong>
                <small>${c.titleEn} · ${m.mastered}/${m.total} освоено · ${stars}⭐</small>
                ${open ? masteryBar(m.percent) : ""}
              </button>
            `;
          })
          .join("")}
      </div>
      <p class="footer-tip">
        ${
          hint
            ? `До темы «${hint.nextTitle}»: в «${hint.prevTitle}» нужно ${hint.stars}/8⭐ и знание ${hint.masteryPercent}/45%.`
            : "Все темы открыты — повторяй слова и собирай альбом знаний!"
        }
        Всего ${categories.reduce((n, c) => n + c.words.length, 0)} слов и ${phrases.length} фраз.
      </p>
    </div>
  `;

  bindSoundToggle();
  app.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => go("category", { categoryId: btn.dataset.cat }));
  });
}

function renderCategory() {
  const cat = getCategory(route.categoryId);
  if (!cat) return go("home");
  const m = categoryMastery(state, cat.id);
  const stars = state.categoryStars[cat.id] || 0;

  app.innerHTML = `
    <div class="screen">
      ${topbar(`<button class="btn btn-ghost" id="home-btn">← На остров</button>`)}
      <section class="panel" style="--cat:${cat.color}">
        <div class="panel-head">
          <h2>${cat.emoji} ${cat.title} <small style="color:var(--ink-soft)">/ ${cat.titleEn}</small></h2>
        </div>
        <p style="margin:0 0 0.5rem;font-weight:700;color:var(--ink-soft)">
          Знание темы: ${m.percent}% · освоено ${m.mastered} · учим ${m.learning + m.familiar} · новых ${m.new} · ${stars}⭐
        </p>
        ${masteryBar(m.percent)}
        <p style="margin:0.85rem 0 1rem;font-weight:700;color:var(--ink-soft)">
          Игра подбирает слабые и новые слова. Ошибки вернутся ещё раз в раунде.
        </p>
        <div class="game-list">
          ${games
            .map(
              (g) => `
            <button class="game-row" data-game="${g.id}" aria-label="${g.title}">
              <span class="emoji" aria-hidden="true">${g.emoji}</span>
              <div>
                <strong>${g.title}</strong>
                <span>${g.desc}</span>
              </div>
              <span class="play-chip">Играть</span>
            </button>
          `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;

  bindSoundToggle();
  app.querySelector("#home-btn").addEventListener("click", () => go("home"));
  app.querySelectorAll("[data-game]").forEach((btn) => {
    btn.addEventListener("click", () =>
      go("play", { categoryId: cat.id, gameId: btn.dataset.game })
    );
  });
}

function renderPlay() {
  const cat = getCategory(route.categoryId);
  const gameId = route.gameId;
  if (!cat) return go("home");

  if (gameId === "quiz") return startQuiz(cat);
  if (gameId === "listen") return startListen(cat);
  if (gameId === "spell") return startSpell(cat);
  if (gameId === "memory") return startMemory(cat);
  if (gameId === "phrase") return startPhrase(cat);
  go("category", { categoryId: cat.id });
}

function mountGameShell({ title, total, onBack }) {
  app.innerHTML = `
    <div class="screen">
      ${topbar(`<button class="btn btn-ghost" id="back-btn">← Назад</button>`)}
      <section class="panel" id="game-panel">
        <div class="panel-head">
          <h2>${title}</h2>
          <div class="stat-pill" id="round-pill">1 / ${total}</div>
        </div>
        <div class="progress-bar"><i id="progress" style="width:0%"></i></div>
        <div id="game-body"></div>
        <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
      </section>
    </div>
  `;
  bindSoundToggle();
  app.querySelector("#back-btn").addEventListener("click", () => {
    if (confirm("Выйти из игры? Прогресс раунда не сохранится.")) onBack();
  });
  return {
    body: app.querySelector("#game-body"),
    feedback: app.querySelector("#feedback"),
    progress: app.querySelector("#progress"),
    roundPill: app.querySelector("#round-pill"),
    panel: app.querySelector("#game-panel"),
  };
}

function updateProgress(ui, index, total) {
  const shown = Math.min(index + 1, total);
  ui.roundPill.textContent = `${shown} / ${total}`;
  ui.progress.style.width = `${(shown / total) * 100}%`;
}

function trackWord(categoryId, en, ok) {
  persist(recordAnswer(state, categoryId, en, ok));
}

function finishGame({ cat, correct, total, streak, gameId }) {
  const rawStars = starsForScore(correct, total);
  const unlockedBefore = new Set(state.unlocked);
  const next = addStars(state, rawStars, cat.id, gameId);
  if (streak > next.bestStreak) next.bestStreak = streak;
  const newlyUnlocked = next.unlocked
    .filter((id) => !unlockedBefore.has(id))
    .map((id) => getCategory(id)?.title || id);
  const earned = next._lastEarned ?? rawStars;
  const reduced = next._starMult < 1 && rawStars > 0;
  persist(next);

  const m = categoryMastery(state, cat.id);

  app.innerHTML = `
    <div class="screen">
      ${topbar()}
      <section class="panel result" id="result-panel">
        <div class="trophy" aria-hidden="true">${earned === 3 ? "🏆" : earned >= 2 ? "🌟" : earned === 1 ? "⭐" : "💪"}</div>
        <h2>${earned >= 3 ? "Супер!" : earned >= 1 ? "Молодец!" : "Ещё попытка!"}</h2>
        <p>Верно: ${correct} из ${total}. Звёзд: +${earned}${reduced ? " (меньше — эту игру уже играли сегодня)" : ""}</p>
        <p class="result-mastery">Знание темы «${cat.title}»: ${m.percent}% · освоено ${m.mastered}/${m.total}</p>
        ${
          newlyUnlocked.length
            ? `<p class="unlock-note">Открыта тема: ${newlyUnlocked.join(", ")}!</p>`
            : ""
        }
        <div class="result-actions">
          <button class="btn btn-primary" id="again">Играть ещё</button>
          <button class="btn btn-gold" id="to-cat">К играм темы</button>
          <button class="btn btn-ghost" id="to-home">На остров</button>
        </div>
      </section>
    </div>
  `;

  bindSoundToggle();
  playWin(earned);
  if (earned > 0) setTimeout(() => playStar(), 280);
  if (newlyUnlocked.length) setTimeout(() => playUnlock(), 500);
  if (earned >= 2) confettiBurst(document.body);
  celebrate(app.querySelector("#stars-pill"));

  app.querySelector("#again").addEventListener("click", () =>
    go("play", { categoryId: cat.id, gameId: route.gameId })
  );
  app.querySelector("#to-cat").addEventListener("click", () =>
    go("category", { categoryId: cat.id })
  );
  app.querySelector("#to-home").addEventListener("click", () => go("home"));
}

/* ---------- Quiz ---------- */

function startQuiz(cat) {
  const items = pickSessionWords(cat, state, 8);
  const queue = createRoundQueue(items, (w) => w.en);
  const uniqueOk = new Set();
  let streak = 0;
  let maxStreak = 0;
  const planned = items.length;
  const showHints = shouldShowHint(state, cat.id);

  const ui = mountGameShell({
    title: `${cat.emoji} Угадай слово`,
    total: planned,
    onBack: () => go("category", { categoryId: cat.id }),
  });

  function showRound() {
    if (queue.done()) {
      return finishGame({
        cat,
        correct: uniqueOk.size,
        total: planned,
        streak: maxStreak,
        gameId: "quiz",
      });
    }
    updateProgress(ui, queue.progressIndex(), Math.max(planned, queue.length));
    ui.feedback.textContent = "";
    ui.feedback.className = "feedback";

    const word = queue.current();
    const options = shuffle([word, ...shuffleDistractors(cat, word, 3)]);

    ui.body.innerHTML = `
      <div class="prompt">
        <div class="big-emoji" aria-hidden="true">${word.emoji}</div>
        <p class="ru">${word.ru}</p>
        ${showHints ? `<p class="hint">подсказка: ${word.hint}</p>` : ""}
      </div>
      <div class="choices" role="group" aria-label="Варианты ответа">
        ${options
          .map(
            (o, idx) =>
              `<button class="choice" data-en="${o.en}" aria-label="Вариант ${idx + 1}: ${o.en}"><kbd class="key-hint">${idx + 1}</kbd>${o.en}</button>`
          )
          .join("")}
      </div>
    `;

    const choices = [...ui.body.querySelectorAll(".choice")];

    function answer(btn) {
      const ok = btn.dataset.en === word.en;
      choices.forEach((b) => (b.disabled = true));
      trackWord(cat.id, word.en, ok);
      if (ok) {
        btn.classList.add("correct");
        uniqueOk.add(word.en);
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        ui.feedback.textContent = "Верно!";
        ui.feedback.className = "feedback good";
        playCorrect();
        speak(word.en);
        queue.markCorrect();
      } else {
        btn.classList.add("wrong");
        streak = 0;
        ui.feedback.textContent = `Это «${word.en}» — встретится ещё раз`;
        ui.feedback.className = "feedback bad";
        playWrong();
        const right = choices.find((b) => b.dataset.en === word.en);
        if (right) right.classList.add("correct");
        speak(word.en);
        queue.markWrong();
      }
      setTimeout(showRound, ok ? 850 : 1100);
    }

    choices.forEach((btn) => btn.addEventListener("click", () => answer(btn)));

    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length && !choices[0].disabled) {
        answer(choices[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey, { once: true });
  }

  showRound();
}

/* ---------- Listen ---------- */

function startListen(cat) {
  const items = pickSessionWords(cat, state, 8);
  const queue = createRoundQueue(items, (w) => w.en);
  const uniqueOk = new Set();
  let streak = 0;
  let maxStreak = 0;
  const planned = items.length;

  const ui = mountGameShell({
    title: `${cat.emoji} Слушай!`,
    total: planned,
    onBack: () => go("category", { categoryId: cat.id }),
  });

  function showRound() {
    if (queue.done()) {
      return finishGame({
        cat,
        correct: uniqueOk.size,
        total: planned,
        streak: maxStreak,
        gameId: "listen",
      });
    }
    updateProgress(ui, queue.progressIndex(), Math.max(planned, queue.length));
    ui.feedback.textContent = "";
    ui.feedback.className = "feedback";

    const word = queue.current();
    const options = shuffle([word, ...shuffleDistractors(cat, word, 3)]);
    let heard = false;

    ui.body.innerHTML = `
      <div class="prompt">
        <p class="ru">Слушай слово и выбери английский вариант</p>
        <p class="hint">Варианты откроются после прослушивания</p>
      </div>
      <div style="text-align:center">
        <button class="btn btn-sky listen-btn" id="say">🔊 Слушать слово</button>
      </div>
      <div class="choices choices-hidden" id="listen-choices" role="group" aria-label="Варианты">
        ${options
          .map(
            (o, idx) =>
              `<button class="choice" data-en="${o.en}" disabled aria-label="Вариант ${idx + 1}: ${o.en}"><kbd class="key-hint">${idx + 1}</kbd>${o.en}</button>`
          )
          .join("")}
      </div>
    `;

    const box = ui.body.querySelector("#listen-choices");
    const choices = [...box.querySelectorAll(".choice")];

    const unlockChoices = () => {
      heard = true;
      box.classList.remove("choices-hidden");
      choices.forEach((b) => (b.disabled = false));
    };

    const say = () => {
      speak(word.en, { rate: 0.8 }).then(() => unlockChoices());
      // unlock even if TTS fails
      setTimeout(() => {
        if (!heard) unlockChoices();
      }, 900);
    };
    ui.body.querySelector("#say").addEventListener("click", say);
    setTimeout(say, 400);

    function answer(btn) {
      if (!heard) return;
      const ok = btn.dataset.en === word.en;
      choices.forEach((b) => (b.disabled = true));
      trackWord(cat.id, word.en, ok);
      if (ok) {
        btn.classList.add("correct");
        uniqueOk.add(word.en);
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        ui.feedback.textContent = `Да! Это «${word.en}»`;
        ui.feedback.className = "feedback good";
        playCorrect();
        queue.markCorrect();
      } else {
        btn.classList.add("wrong");
        streak = 0;
        ui.feedback.textContent = `Правильно: «${word.en}» — повторим`;
        ui.feedback.className = "feedback bad";
        playWrong();
        const right = choices.find((b) => b.dataset.en === word.en);
        if (right) right.classList.add("correct");
        queue.markWrong();
      }
      speak(word.en);
      setTimeout(showRound, ok ? 900 : 1200);
    }

    choices.forEach((btn) => btn.addEventListener("click", () => answer(btn)));
  }

  showRound();
}

/* ---------- Spell ---------- */

function startSpell(cat) {
  const spellPool = cat.words.filter((w) => !/\s/.test(w.en) && w.en.length <= 9);
  const items = pickSessionWords(
    { ...cat, words: spellPool.length ? spellPool : cat.words },
    state,
    7
  );
  const queue = createRoundQueue(items, (w) => w.en);
  const uniqueOk = new Set();
  let streak = 0;
  let maxStreak = 0;
  const planned = items.length;

  const ui = mountGameShell({
    title: `${cat.emoji} Собери слово`,
    total: planned,
    onBack: () => go("category", { categoryId: cat.id }),
  });

  function showRound() {
    if (queue.done()) {
      return finishGame({
        cat,
        correct: uniqueOk.size,
        total: planned,
        streak: maxStreak,
        gameId: "spell",
      });
    }
    updateProgress(ui, queue.progressIndex(), Math.max(planned, queue.length));
    ui.feedback.textContent = "";
    ui.feedback.className = "feedback";

    const word = queue.current();
    const letters = shuffle(word.en.split(""));
    let built = [];
    let usedIdx = [];

    ui.body.innerHTML = `
      <div class="prompt">
        <div class="big-emoji" aria-hidden="true">${word.emoji}</div>
        <p class="ru">${word.ru}</p>
      </div>
      <div class="phrase-slots" id="slots" aria-label="Собранное слово">
        ${word.en
          .split("")
          .map(() => `<div class="slot"></div>`)
          .join("")}
      </div>
      <div class="letters" id="letters">
        ${letters
          .map(
            (ch, idx) =>
              `<button class="letter" data-ch="${ch}" data-idx="${idx}" aria-label="Буква ${ch}">${ch}</button>`
          )
          .join("")}
      </div>
      <div class="game-actions">
        <button class="btn btn-ghost" id="undo" disabled>⌫ Убрать</button>
        <button class="btn btn-ghost" id="clear" disabled>Стереть</button>
        <button class="btn btn-sky" id="hear">🔊 Произнести</button>
        <button class="btn btn-primary" id="check" disabled>Проверить</button>
      </div>
    `;

    const slots = [...ui.body.querySelectorAll(".slot")];
    const letterBtns = [...ui.body.querySelectorAll(".letter")];
    const undoBtn = ui.body.querySelector("#undo");
    const clearBtn = ui.body.querySelector("#clear");
    const checkBtn = ui.body.querySelector("#check");

    function paint() {
      slots.forEach((s, idx) => {
        s.textContent = built[idx] || "";
        s.classList.toggle("filled", Boolean(built[idx]));
      });
      undoBtn.disabled = built.length === 0;
      clearBtn.disabled = built.length === 0;
      checkBtn.disabled = built.length < word.en.length;
    }

    letterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (built.length >= word.en.length) return;
        built.push(btn.dataset.ch);
        usedIdx.push(btn.dataset.idx);
        btn.classList.add("used");
        paint();
      });
    });

    undoBtn.addEventListener("click", () => {
      if (!built.length) return;
      built.pop();
      const idx = usedIdx.pop();
      const btn = letterBtns.find((b) => b.dataset.idx === idx);
      if (btn) btn.classList.remove("used");
      paint();
    });

    clearBtn.addEventListener("click", () => {
      built = [];
      usedIdx = [];
      letterBtns.forEach((b) => b.classList.remove("used"));
      paint();
      ui.feedback.textContent = "";
    });

    ui.body.querySelector("#hear").addEventListener("click", () => speak(word.en));

    checkBtn.addEventListener("click", () => {
      const answer = built.join("");
      if (answer.length < word.en.length) return;
      const ok = answer === word.en;
      trackWord(cat.id, word.en, ok);
      checkBtn.disabled = true;
      if (ok) {
        uniqueOk.add(word.en);
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        ui.feedback.textContent = "Отлично собрал!";
        ui.feedback.className = "feedback good";
        playCorrect();
        speak(word.en);
        queue.markCorrect();
        setTimeout(showRound, 900);
      } else {
        streak = 0;
        ui.feedback.textContent = `Правильно: ${word.en} — повторим`;
        ui.feedback.className = "feedback bad";
        playWrong();
        speak(word.en);
        queue.markWrong();
        setTimeout(showRound, 1200);
      }
    });
  }

  showRound();
}

/* ---------- Memory ---------- */

function startMemory(cat) {
  const pairs = pickSessionWords(cat, state, 6);
  const cards = shuffle(
    pairs.flatMap((w) => [
      { id: w.en, side: "en", label: w.en, pair: w.en },
      { id: w.en + "-ru", side: "ru", label: `${w.emoji} ${w.ru}`, pair: w.en },
    ])
  );

  let flipped = [];
  let matched = new Set();
  let locks = false;
  let moves = 0;
  const totalPairs = pairs.length;
  let streak = 0;
  let maxStreak = 0;

  const ui = mountGameShell({
    title: `${cat.emoji} Найди пару`,
    total: totalPairs,
    onBack: () => go("category", { categoryId: cat.id }),
  });

  ui.body.innerHTML = `
    <p style="text-align:center;font-weight:700;color:var(--ink-soft);margin:0 0 0.75rem">
      Открой английское слово и его перевод
    </p>
    <div class="memory-grid" id="mem"></div>
  `;

  const grid = ui.body.querySelector("#mem");
  cards.forEach((card, idx) => {
    const btn = document.createElement("button");
    btn.className = "mem-card";
    btn.dataset.idx = String(idx);
    btn.setAttribute("aria-label", "Закрытая карточка");
    btn.innerHTML = `
      <div class="mem-inner">
        <div class="mem-face mem-back" aria-hidden="true">?</div>
        <div class="mem-face mem-front">${card.label}</div>
      </div>
    `;
    grid.appendChild(btn);
  });

  function syncProgress() {
    updateProgress(ui, matched.size, totalPairs);
    ui.roundPill.textContent = `${matched.size} / ${totalPairs}`;
  }
  syncProgress();

  grid.querySelectorAll(".mem-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (locks) return;
      const idx = Number(btn.dataset.idx);
      const card = cards[idx];
      if (matched.has(card.pair) || flipped.some((f) => f.idx === idx)) return;

      playFlip();
      btn.classList.add("flipped");
      btn.setAttribute("aria-label", card.label);
      flipped.push({ idx, card, btn });

      if (flipped.length < 2) return;

      moves++;
      locks = true;
      const [a, b] = flipped;
      if (a.card.pair === b.card.pair && a.card.side !== b.card.side) {
        matched.add(a.card.pair);
        a.btn.classList.add("matched");
        b.btn.classList.add("matched");
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        ui.feedback.textContent = "Пара найдена!";
        ui.feedback.className = "feedback good";
        playMatch();
        speak(a.card.pair);
        trackWord(cat.id, a.card.pair, true);
        flipped = [];
        locks = false;
        syncProgress();
        if (matched.size === totalPairs) {
          // Score by efficiency: ideal = totalPairs moves
          const waste = Math.max(0, moves - totalPairs);
          const correctCount = Math.max(0, totalPairs - waste);
          setTimeout(
            () =>
              finishGame({
                cat,
                correct: correctCount,
                total: totalPairs,
                streak: maxStreak,
                gameId: "memory",
              }),
            700
          );
        }
      } else {
        streak = 0;
        ui.feedback.textContent = "Не пара — попробуй ещё";
        ui.feedback.className = "feedback bad";
        playWrong();
        if (a.card.side === "en") trackWord(cat.id, a.card.pair, false);
        if (b.card.side === "en") trackWord(cat.id, b.card.pair, false);
        setTimeout(() => {
          a.btn.classList.remove("flipped");
          b.btn.classList.remove("flipped");
          a.btn.setAttribute("aria-label", "Закрытая карточка");
          b.btn.setAttribute("aria-label", "Закрытая карточка");
          flipped = [];
          locks = false;
        }, 700);
      }
    });
  });
}

/* ---------- Phrase ---------- */

function startPhrase(cat) {
  const items = phrasesForCategory(cat.id, state.unlocked);
  const queue = createRoundQueue(items, (p) => p.en.join(" "));
  const uniqueOk = new Set();
  let streak = 0;
  let maxStreak = 0;
  const planned = items.length;

  const ui = mountGameShell({
    title: `💬 Собери фразу`,
    total: planned,
    onBack: () => go("category", { categoryId: cat.id }),
  });

  function showRound() {
    if (queue.done()) {
      return finishGame({
        cat,
        correct: uniqueOk.size,
        total: planned,
        streak: maxStreak,
        gameId: "phrase",
      });
    }
    updateProgress(ui, queue.progressIndex(), Math.max(planned, queue.length));
    ui.feedback.textContent = "";
    ui.feedback.className = "feedback";

    const phrase = queue.current();
    const bank = shuffle([...phrase.options]);
    let built = [];
    let usedIdx = [];

    ui.body.innerHTML = `
      <div class="prompt">
        <div class="big-emoji" aria-hidden="true">${phrase.emoji}</div>
        <p class="ru">${phrase.ru}</p>
      </div>
      <div class="phrase-slots" id="slots" aria-label="Фраза">
        ${phrase.en.map(() => `<div class="slot"></div>`).join("")}
      </div>
      <div class="phrase-bank" id="bank">
        ${bank
          .map(
            (w, idx) =>
              `<button class="word-chip" data-w="${w}" data-idx="${idx}" aria-label="Слово ${w}">${w}</button>`
          )
          .join("")}
      </div>
      <div class="game-actions">
        <button class="btn btn-ghost" id="undo" disabled>⌫ Убрать</button>
        <button class="btn btn-ghost" id="clear" disabled>Стереть</button>
        <button class="btn btn-sky" id="hear">🔊 Как звучит</button>
        <button class="btn btn-primary" id="check" disabled>Проверить</button>
      </div>
    `;

    const slots = [...ui.body.querySelectorAll(".slot")];
    const chips = [...ui.body.querySelectorAll(".word-chip")];
    const undoBtn = ui.body.querySelector("#undo");
    const clearBtn = ui.body.querySelector("#clear");
    const checkBtn = ui.body.querySelector("#check");

    function paint() {
      slots.forEach((s, idx) => {
        s.textContent = built[idx] || "";
        s.classList.toggle("filled", Boolean(built[idx]));
      });
      undoBtn.disabled = built.length === 0;
      clearBtn.disabled = built.length === 0;
      checkBtn.disabled = built.length < phrase.en.length;
    }

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (built.length >= phrase.en.length) return;
        built.push(btn.dataset.w);
        usedIdx.push(btn.dataset.idx);
        btn.classList.add("used");
        paint();
      });
    });

    undoBtn.addEventListener("click", () => {
      if (!built.length) return;
      built.pop();
      const idx = usedIdx.pop();
      const chip = chips.find((c) => c.dataset.idx === idx);
      if (chip) chip.classList.remove("used");
      paint();
    });

    clearBtn.addEventListener("click", () => {
      built = [];
      usedIdx = [];
      chips.forEach((c) => c.classList.remove("used"));
      paint();
    });

    ui.body.querySelector("#hear").addEventListener("click", () =>
      speak(phrase.en.join(" "))
    );

    checkBtn.addEventListener("click", () => {
      if (built.length < phrase.en.length) return;
      const ok = built.join(" ") === phrase.en.join(" ");
      checkBtn.disabled = true;
      // Credit content words that appear in current theme
      for (const token of phrase.en) {
        const hit = cat.words.find((w) => w.en.toLowerCase() === token.toLowerCase());
        if (hit) trackWord(cat.id, hit.en, ok);
      }
      if (ok) {
        uniqueOk.add(phrase.en.join(" "));
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        ui.feedback.textContent = "Фраза собрана!";
        ui.feedback.className = "feedback good";
        playCorrect();
        speak(phrase.en.join(" "));
        queue.markCorrect();
      } else {
        streak = 0;
        ui.feedback.textContent = `Правильно: ${phrase.en.join(" ")}`;
        ui.feedback.className = "feedback bad";
        playWrong();
        speak(phrase.en.join(" "));
        queue.markWrong();
      }
      setTimeout(showRound, ok ? 900 : 1300);
    });
  }

  showRound();
}

function render() {
  if (route.name === "home") return renderHome();
  if (route.name === "category") return renderCategory();
  if (route.name === "play") return renderPlay();
  renderHome();
}

render();
