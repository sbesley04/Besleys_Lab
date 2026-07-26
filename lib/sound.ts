// Tiny WebAudio synth effects — no audio assets, just oscillators. Each call
// is wrapped in try/catch because autoplay policies can block the context
// until the user interacts; a silent failure is fine for garnish sounds.

function ctx(): AudioContext | null {
  try {
    const w = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
      __blAudio?: AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    const ac = (w.__blAudio ??= new Ctor());
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.08) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Soft underwater bloop — the bladderfish. */
export function bloop() {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

/** Happy little grub chirp. */
export function chirp() {
  tone(880, 0, 0.12, "square", 0.05);
  tone(1320, 0.1, 0.12, "square", 0.05);
  tone(1760, 0.2, 0.2, "square", 0.05);
}

/** A short "baa"-ish wobble for the sheep. */
export function baa() {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const vib = ac.createOscillator();
  const vibGain = ac.createGain();
  const g = ac.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, t);
  vib.frequency.setValueAtTime(9, t);
  vibGain.gain.setValueAtTime(22, t);
  vib.connect(vibGain).connect(osc.frequency);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  vib.start(t);
  osc.stop(t + 0.55);
  vib.stop(t + 0.55);
}
