// Áudio 100% procedural (WebAudio): sem arquivos. Efeitos por classe, ambiente por bioma e trilha leve.
type Kind = 'slash' | 'chop' | 'stab' | 'punch' | 'dance' | 'holy' | 'arcane';
let ctx: AudioContext | null = null;
let master: GainNode | null = null, sfxBus: GainNode | null = null, musBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const KEY = 'aldoria-audio';
const cfg = (() => { try { return { sfx: 0.7, music: 0.35, muted: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { sfx: 0.7, music: 0.35, muted: false }; } })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ignore */ } };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = cfg.muted ? 0 : 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = cfg.sfx; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = cfg.music; musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
/** o navegador só libera áudio após um gesto do jogador */
export function unlockAudio() { const c = ensure(); if (c && c.state === 'suspended') void c.resume(); }
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlockAudio, { once: false, passive: true });

export const audioCfg = () => ({ ...cfg });
export function setAudio(p: Partial<typeof cfg>) {
  Object.assign(cfg, p); persist();
  if (master) master.gain.value = cfg.muted ? 0 : 1;
  if (sfxBus) sfxBus.gain.value = cfg.sfx;
  if (musBus) musBus.gain.value = cfg.music;
}

// ---------- blocos básicos
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, delay = 0, dest: AudioNode | null = null) {
  const c = ensure(); if (!c || !sfxBus) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest ?? sfxBus); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur: number, vol = 0.3, filt: BiquadFilterType = 'lowpass', f0 = 2000, f1?: number, delay = 0, q = 0.7, dest: AudioNode | null = null) {
  const c = ensure(); if (!c || !sfxBus || !noiseBuf) return;
  const t0 = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = filt; f.Q.value = q; f.frequency.setValueAtTime(f0, t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest ?? sfxBus); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
let lastAt: Record<string, number> = {};
const gate = (k: string, ms: number) => { const n = performance.now(); if (n - (lastAt[k] ?? 0) < ms) return false; lastAt[k] = n; return true; };

// ---------- efeitos
export const sfx = {
  swing(kind: Kind) {
    if (!gate('swing', 60)) return;
    if (kind === 'punch') { noise(0.09, 0.28, 'bandpass', 600, 300); tone(140, 0.1, 'sine', 0.3, 70); }
    else if (kind === 'chop') { noise(0.2, 0.34, 'bandpass', 900, 250, 0, 1.2); tone(110, 0.16, 'sawtooth', 0.12, 60); }
    else if (kind === 'stab') { noise(0.08, 0.25, 'highpass', 2500, 5000); }
    else if (kind === 'dance') { noise(0.12, 0.22, 'bandpass', 2600, 1200, 0, 2); tone(880, 0.1, 'triangle', 0.08, 1320); }
    else if (kind === 'holy') { noise(0.14, 0.24, 'bandpass', 1500, 700); tone(660, 0.25, 'sine', 0.12, 990); }
    else if (kind === 'arcane') { noise(0.14, 0.2, 'bandpass', 1800, 600); tone(520, 0.22, 'triangle', 0.1, 1040); }
    else noise(0.15, 0.3, 'bandpass', 2200, 700, 0, 1.4);
  },
  hit(crit = false) {
    if (!gate('hit', 45)) return;
    noise(0.07, crit ? 0.4 : 0.28, 'lowpass', 1800, 300); tone(crit ? 220 : 160, 0.1, 'square', crit ? 0.18 : 0.1, 80);
    if (crit) { tone(1320, 0.18, 'triangle', 0.1, 1760, 0.02); }
  },
  arrow() { if (!gate('arrow', 70)) return; noise(0.14, 0.2, 'highpass', 1400, 3600); tone(180, 0.07, 'triangle', 0.18, 90); },
  bolt() { if (!gate('bolt', 70)) return; tone(300, 0.14, 'square', 0.12, 160); noise(0.1, 0.18, 'highpass', 3000, 6000); },
  magic(kind: 'fire' | 'orb' | 'beam' | 'note' | 'radiant' | 'skull' | 'thorn' | 'prism' = 'orb') {
    if (!gate('magic', 70)) return;
    if (kind === 'fire') { noise(0.3, 0.3, 'bandpass', 500, 1800, 0, 0.9); tone(200, 0.25, 'sawtooth', 0.08, 420); }
    else if (kind === 'beam') { tone(900, 0.28, 'sawtooth', 0.1, 350); noise(0.2, 0.15, 'highpass', 2500); }
    else if (kind === 'note') { tone(659, 0.18, 'triangle', 0.18); tone(880, 0.22, 'triangle', 0.14, undefined, 0.07); }
    else if (kind === 'radiant') { tone(784, 0.3, 'sine', 0.16); tone(1175, 0.4, 'sine', 0.1, undefined, 0.05); }
    else if (kind === 'skull') { tone(120, 0.4, 'sawtooth', 0.14, 60); noise(0.3, 0.14, 'lowpass', 700, 200); }
    else if (kind === 'thorn') { noise(0.12, 0.22, 'highpass', 2200); tone(420, 0.1, 'triangle', 0.12, 300); }
    else if (kind === 'prism') { for (let i = 0; i < 4; i++) tone(880 * (1 + i * 0.25), 0.18, 'sine', 0.09, undefined, i * 0.04); }
    else { tone(440, 0.25, 'sine', 0.16, 880); tone(660, 0.25, 'triangle', 0.08, 990, 0.03); }
  },
  skill() { noise(0.35, 0.25, 'bandpass', 700, 2200, 0, 1.1); tone(330, 0.3, 'sawtooth', 0.1, 660); },
  nova() { tone(90, 0.5, 'sine', 0.35, 40); noise(0.5, 0.3, 'lowpass', 1500, 120); },
  buff() { tone(523, 0.18, 'sine', 0.15); tone(659, 0.18, 'sine', 0.15, undefined, 0.09); tone(784, 0.3, 'sine', 0.15, undefined, 0.18); },
  summon() { tone(110, 0.6, 'sawtooth', 0.12, 220); tone(165, 0.6, 'triangle', 0.1, 330, 0.05); noise(0.5, 0.12, 'bandpass', 400, 1200); },
  hurt() { if (!gate('hurt', 120)) return; tone(200, 0.16, 'sawtooth', 0.22, 80); noise(0.12, 0.22, 'lowpass', 1200, 300); },
  miss() { if (!gate('miss', 90)) return; noise(0.08, 0.1, 'highpass', 3000, 5000); },
  die() { tone(220, 0.6, 'sawtooth', 0.18, 50); noise(0.5, 0.16, 'lowpass', 900, 80); },
  mobDie() { if (!gate('mdie', 80)) return; tone(260, 0.22, 'triangle', 0.16, 70); noise(0.15, 0.14, 'lowpass', 1200, 200); },
  boss() { tone(70, 1.1, 'sawtooth', 0.3, 38); noise(1.0, 0.25, 'lowpass', 500, 90); },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, undefined, i * 0.1)); },
  coin() { if (!gate('coin', 50)) return; tone(1568, 0.08, 'square', 0.1); tone(2093, 0.18, 'square', 0.1, undefined, 0.07); },
  potion() { tone(300, 0.1, 'sine', 0.2, 500); tone(500, 0.1, 'sine', 0.2, 700, 0.1); noise(0.2, 0.12, 'bandpass', 1500, 2500, 0.05); },
  loot(rarity = 0) { [880, 1175, 1568].slice(0, 1 + Math.min(2, rarity)).forEach((f, i) => tone(f, 0.22, 'triangle', 0.12 + rarity * 0.02, undefined, i * 0.07)); },
  click() { if (!gate('click', 40)) return; tone(700, 0.04, 'square', 0.05); },
  buy() { tone(784, 0.08, 'square', 0.1); tone(1175, 0.14, 'square', 0.1, undefined, 0.07); },
  nope() { tone(160, 0.14, 'square', 0.12, 120); },
  door() { noise(0.18, 0.2, 'lowpass', 600, 200); tone(90, 0.2, 'sine', 0.2, 60); },
  step() { if (!gate('step', 230)) return; noise(0.05, 0.05, 'lowpass', 700 + Math.random() * 300); },
  enchant() { [400, 600, 900, 1350].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, undefined, i * 0.06)); noise(0.5, 0.1, 'highpass', 4000); },
};

// ---------- ambiente e trilha (gerativa, por bioma)
const MODES: Record<string, { root: number; scale: number[]; tempo: number; wave: OscillatorType; vol: number }> = {
  town: { root: 261.63, scale: [0, 2, 4, 7, 9, 12], tempo: 1.7, wave: 'triangle', vol: 0.5 },
  fields: { root: 261.63, scale: [0, 2, 4, 7, 9, 12], tempo: 1.9, wave: 'triangle', vol: 0.45 },
  forest: { root: 220, scale: [0, 2, 3, 7, 8, 12], tempo: 2.4, wave: 'sine', vol: 0.5 },
  crypt: { root: 196, scale: [0, 1, 5, 7, 8, 12], tempo: 3.1, wave: 'sine', vol: 0.45 },
  orcs: { root: 174.6, scale: [0, 3, 5, 7, 10, 12], tempo: 1.5, wave: 'sawtooth', vol: 0.2 },
  ogre: { root: 146.8, scale: [0, 1, 4, 5, 7, 8], tempo: 2.8, wave: 'sawtooth', vol: 0.2 },
  dungeon: { root: 123.5, scale: [0, 1, 3, 6, 7], tempo: 3.6, wave: 'sine', vol: 0.45 },
  boss: { root: 110, scale: [0, 1, 4, 5, 7], tempo: 0.9, wave: 'sawtooth', vol: 0.18 },
};
let mode = 'fields', musTimer = 0, musOn = false, step = 0;
const modeFor = (z: string) => (z.startsWith('v_') || z === 'town' ? 'town' : MODES[z] ? z : 'fields');
export function setMusicZone(zone: string, opts?: { dungeon?: boolean; boss?: boolean; interior?: boolean }) {
  mode = opts?.boss ? 'boss' : opts?.dungeon ? 'dungeon' : opts?.interior ? 'town' : modeFor(zone);
}
function musicTick() {
  const c = ensure(); if (!c || !musBus || c.state !== 'running' || cfg.muted || cfg.music <= 0.001) return;
  const m = MODES[mode];
  const n = m.scale[Math.floor(Math.random() * m.scale.length)];
  const f = m.root * Math.pow(2, n / 12) * (Math.random() < 0.25 ? 2 : 1);
  tone(f, m.tempo * 1.6, m.wave, 0.06 * m.vol * 2, undefined, 0, musBus);
  if (step % 4 === 0) tone(m.root / 2, m.tempo * 3.4, 'sine', 0.07 * m.vol * 2, undefined, 0, musBus);          // pedal grave
  if (step % 8 === 4) tone(m.root * Math.pow(2, m.scale[2] / 12), m.tempo * 3, 'sine', 0.045 * m.vol * 2, undefined, 0.3, musBus);
  if (mode === 'forest' || mode === 'fields') { if (Math.random() < 0.2) noise(0.5, 0.025, 'bandpass', 3000 + Math.random() * 1500, 4500, 0, 4, musBus); } // pássaros/vento
  step++;
}
export function startMusic() {
  if (musOn) return; musOn = true;
  const loop = () => { musicTick(); musTimer = window.setTimeout(loop, (MODES[mode].tempo * 0.55) * 1000 * (0.8 + Math.random() * 0.5)); };
  loop();
}
export function stopMusic() { musOn = false; window.clearTimeout(musTimer); }
