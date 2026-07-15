/** Lightweight UI / game SFX via Web Audio API (no asset files). */

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = Boolean(on);
}

export function isSoundEnabled() {
  return enabled;
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, {
  type = "sine",
  start = 0,
  duration = 0.12,
  gain = 0.08,
  attack = 0.01,
  decay = 0.08,
} = {}) {
  const ac = getCtx();
  if (!ac || !enabled) return;

  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.02, duration));
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + decay);
}

function noiseBurst({ start = 0, duration = 0.06, gain = 0.04, filterFreq = 1200 } = {}) {
  const ac = getCtx();
  if (!ac || !enabled) return;

  const t0 = ac.currentTime + start;
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + duration);
}

/** Soft UI tap */
export function playClick() {
  tone(520, { type: "triangle", duration: 0.06, gain: 0.05, attack: 0.005 });
  tone(780, { type: "sine", start: 0.02, duration: 0.05, gain: 0.03 });
}

/** Placing a letter / chip */
export function playPlace() {
  tone(640, { type: "triangle", duration: 0.05, gain: 0.045, attack: 0.004 });
}

/** Memory card flip */
export function playFlip() {
  noiseBurst({ duration: 0.05, gain: 0.035, filterFreq: 1800 });
  tone(420, { type: "triangle", duration: 0.07, gain: 0.035 });
}

/** Correct answer */
export function playCorrect() {
  tone(523.25, { type: "sine", duration: 0.1, gain: 0.07 });
  tone(659.25, { type: "sine", start: 0.08, duration: 0.12, gain: 0.07 });
  tone(783.99, { type: "triangle", start: 0.16, duration: 0.16, gain: 0.06 });
}

/** Wrong answer */
export function playWrong() {
  tone(220, { type: "square", duration: 0.12, gain: 0.035, attack: 0.01 });
  tone(180, { type: "square", start: 0.08, duration: 0.14, gain: 0.03 });
}

/** End-of-game fanfare (strength 0–3 stars) */
export function playWin(stars = 2) {
  if (stars <= 0) {
    tone(300, { type: "triangle", duration: 0.15, gain: 0.05 });
    tone(260, { type: "triangle", start: 0.12, duration: 0.18, gain: 0.04 });
    return;
  }
  tone(523.25, { type: "sine", duration: 0.12, gain: 0.07 });
  tone(659.25, { type: "sine", start: 0.1, duration: 0.12, gain: 0.07 });
  tone(783.99, { type: "sine", start: 0.2, duration: 0.14, gain: 0.07 });
  if (stars >= 2) {
    tone(1046.5, { type: "triangle", start: 0.32, duration: 0.22, gain: 0.06 });
  }
  if (stars >= 3) {
    tone(1318.5, { type: "sine", start: 0.42, duration: 0.28, gain: 0.05 });
  }
}

/** Stars earned sparkle */
export function playStar() {
  tone(880, { type: "sine", duration: 0.08, gain: 0.05 });
  tone(1320, { type: "triangle", start: 0.06, duration: 0.14, gain: 0.045 });
}

/** New theme unlocked */
export function playUnlock() {
  tone(392, { type: "sine", duration: 0.1, gain: 0.06 });
  tone(523.25, { type: "sine", start: 0.1, duration: 0.1, gain: 0.06 });
  tone(659.25, { type: "sine", start: 0.2, duration: 0.12, gain: 0.06 });
  tone(784, { type: "triangle", start: 0.32, duration: 0.22, gain: 0.055 });
}

/** Pair matched in memory */
export function playMatch() {
  tone(587.33, { type: "sine", duration: 0.09, gain: 0.06 });
  tone(880, { type: "triangle", start: 0.07, duration: 0.14, gain: 0.05 });
}

/** Unlock AudioContext on first user gesture */
export function unlockAudio() {
  getCtx();
}
