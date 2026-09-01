type Quality = "low" | "medium" | "high";

interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  musicOn: boolean;
  sfxOn: boolean;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: number | null = null;
let unlocked = false;
let settings: AudioSettings = {
  master: 0.7,
  music: 0.28,
  sfx: 0.7,
  muted: false,
  musicOn: true,
  sfxOn: true,
};

function curve(v: number) {
  return v * v;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: "interactive" });
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyGains();
  }
  return ctx;
}

function applyGains() {
  if (!ctx || !masterGain || !musicGain || !sfxGain) return;
  const t = ctx.currentTime;
  const master = settings.muted ? 0 : curve(settings.master);
  masterGain.gain.setTargetAtTime(master, t, 0.03);
  musicGain.gain.setTargetAtTime(settings.musicOn ? curve(settings.music) : 0, t, 0.05);
  sfxGain.gain.setTargetAtTime(settings.sfxOn ? curve(settings.sfx) : 0, t, 0.03);
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
  if (settings.musicOn && !settings.muted) startMusic();
}

export function configureAudio(next: Partial<AudioSettings>) {
  settings = { ...settings, ...next };
  applyGains();
  if (unlocked && settings.musicOn && !settings.muted) startMusic();
  if (!settings.musicOn || settings.muted) stopMusic();
}

function envGain(c: AudioContext, dest: AudioNode, peak: number, attack: number, release: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(peak, c.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + attack + release);
  g.connect(dest);
  return g;
}

function tone(freq: number, dur: number, type: OscillatorType, peak = 0.12, detune = 0) {
  const c = ac();
  if (!c || !sfxGain || !unlocked) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = envGain(c, sfxGain, peak, 0.008, dur);
  osc.connect(g);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function noise(dur: number, peak = 0.08, filterFreq = 1200) {
  const c = ac();
  if (!c || !sfxGain || !unlocked) return;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = envGain(c, sfxGain, peak, 0.005, dur);
  src.connect(filter);
  filter.connect(g);
  src.start();
  src.stop(c.currentTime + dur);
}

export type SfxName =
  | "click"
  | "hover"
  | "dice"
  | "dice-land"
  | "coin"
  | "pay"
  | "buy"
  | "card"
  | "build"
  | "timeout"
  | "bankrupt"
  | "win"
  | "chat"
  | "error"
  | "whoosh";

export function playSfx(name: SfxName, quality: Quality = "high") {
  if (!unlocked || settings.muted || !settings.sfxOn) return;
  const lite = quality === "low";
  switch (name) {
    case "click":
      tone(720, 0.06, "square", 0.05);
      break;
    case "hover":
      if (!lite) tone(520, 0.04, "sine", 0.02);
      break;
    case "dice":
      noise(0.22, 0.1, 1800);
      tone(180, 0.18, "triangle", 0.04);
      break;
    case "dice-land":
      tone(240, 0.08, "square", 0.07);
      tone(360, 0.1, "triangle", 0.04, 12);
      break;
    case "coin":
      tone(880, 0.09, "sine", 0.07);
      tone(1320, 0.12, "sine", 0.05);
      break;
    case "pay":
      tone(420, 0.1, "triangle", 0.06);
      tone(280, 0.14, "sine", 0.04);
      break;
    case "buy":
      tone(523, 0.1, "triangle", 0.07);
      tone(659, 0.14, "sine", 0.05);
      tone(784, 0.16, "sine", 0.04);
      break;
    case "card":
      noise(0.16, 0.06, 2400);
      tone(490, 0.12, "sine", 0.05);
      break;
    case "build":
      tone(392, 0.08, "square", 0.05);
      tone(523, 0.12, "triangle", 0.05);
      tone(784, 0.16, "sine", 0.04);
      break;
    case "timeout":
      tone(160, 0.22, "sawtooth", 0.06);
      break;
    case "bankrupt":
      tone(140, 0.3, "sawtooth", 0.08);
      tone(90, 0.4, "triangle", 0.05);
      break;
    case "win":
      tone(523, 0.16, "triangle", 0.08);
      tone(659, 0.18, "triangle", 0.07);
      tone(784, 0.22, "sine", 0.07);
      tone(1046, 0.3, "sine", 0.06);
      break;
    case "chat":
      tone(880, 0.05, "sine", 0.03);
      break;
    case "error":
      tone(220, 0.1, "square", 0.06);
      tone(180, 0.12, "square", 0.04);
      break;
    case "whoosh":
      noise(0.2, 0.05, 900);
      break;
  }
}

function startMusic() {
  const c = ac();
  if (!c || !musicGain || musicTimer != null) return;
  const notes = [196, 246.94, 293.66, 329.63, 392];
  let i = 0;
  const tick = () => {
    if (!ctx || !musicGain || !settings.musicOn || settings.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = notes[i % notes.length]!;
    i += 1;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 2.4);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 900;
    osc.connect(g);
    g.connect(filt);
    filt.connect(musicGain);
    osc.start();
    osc.stop(ctx.currentTime + 2.5);
    musicTimer = window.setTimeout(tick, 2200);
  };
  tick();
}

function stopMusic() {
  if (musicTimer != null) {
    window.clearTimeout(musicTimer);
    musicTimer = null;
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx?.state === "suspended") {
      void ctx.resume();
    }
  });
}
