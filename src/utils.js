export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

export function speak(text, { rate = 0.85, lang = "en-GB" } = {}) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.speak(u);
  });
}

export function celebrate(el) {
  if (!el) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

export function confettiBurst(root) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  const colors = ["#f0a202", "#e85d4c", "#2bb673", "#3d8bfd", "#fff"];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("span");
    p.className = "confetti";
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.25}s`;
    p.style.setProperty("--x", `${(Math.random() - 0.5) * 160}px`);
    layer.appendChild(p);
  }
  root.appendChild(layer);
  setTimeout(() => layer.remove(), 1200);
}
