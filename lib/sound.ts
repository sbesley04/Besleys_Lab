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

/* --- Hyperspace jump (Konami → the Grid) ---------------------------------
   The jump gets a real (if tiny) sound-design chain rather than one oscillator
   per beat. Four layers recur throughout: a SUB for the chest, a detuned saw
   ENGINE through a resonant filter for movement, a bandpassed NOISE layer for
   air, and a procedural plate REVERB for tail. They all land on one shared,
   compressed bus so they glue instead of stacking into clipping.

   Beats, timed against HyperspaceJump.tsx's IN = {flash: 1520, land: 1600}:
     warpCharge()  ~1.5s riser that ends in a held breath just before impact
     warpBoom()    the impact at the white flash, ~1.2s decay
     warpLand()    arrival chime settling into the plate
     warpDown()    the reverse jump home — descending, filter closing, softer

   Everything is scheduled ahead on the AudioContext clock, so the shape is
   sample-accurate and immune to rAF/React jitter, and every node is given a
   finite stop() so the graph stays collectable. Nothing runs forever. */

type WarpBus = {
  ac: AudioContext;
  /** Direct path into the compressor. */
  dry: GainNode;
  /** Reverb send — feed it via `send()`. */
  wet: GainNode;
  /** Shared white-noise table; every air/impact layer plays a slice of it. */
  noise: AudioBuffer;
};

// Cached per AudioContext: the impulse response and the noise table together
// cost ~400k Math.random() calls, which is fine once and silly on every jump.
let busCache: WarpBus | null = null;

/** A block of white noise we loop and window with gain envelopes. Generating
    it once and re-reading it from random offsets is far cheaper than building
    a bespoke buffer per burst, and the random offset keeps repeated jumps from
    reusing an identical whoosh grain (the ear picks that up instantly). */
function whiteNoise(ac: AudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Poor-man's plate: exponentially decaying noise as a convolution impulse.
    `decay` above ~3 keeps the tail from sounding like a gated hall; the two
    channels are generated independently so the tail is stereo-wide for free. */
function impulse(ac: AudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
  }
  return buf;
}

function warpBus(ac: AudioContext): WarpBus | null {
  try {
    if (busCache && busCache.ac === ac) return busCache;

    // The impact stacks a sub, a body tone, a click and a noise blast inside
    // the same 10ms; summed raw that sails past 0dBFS and crunches. A gentle
    // 4:1 with a fast attack catches the peaks and glues the layers while
    // still letting the boom read as louder than the riser before it.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;

    // Master trim. This fires unprompted for someone who just typed a konami
    // code at whatever volume they had set for something else — aim for
    // "felt in the chest", not "hurts".
    const master = ac.createGain();
    master.gain.value = 0.8;
    comp.connect(master).connect(ac.destination);

    const dry = ac.createGain();
    dry.gain.value = 1;
    dry.connect(comp);

    // Send bus is pre-darkened before the convolver: a raw white impulse
    // reverb hisses, and rolling off above ~3.8kHz turns that hiss into the
    // cyan shimmer the Grid wants. Cheaper here than filtering the wet output.
    const conv = ac.createConvolver();
    conv.buffer = impulse(ac, 1.9, 3.6);
    const damp = ac.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3800;
    const wet = ac.createGain();
    wet.gain.value = 0.9;
    wet.connect(damp).connect(conv).connect(comp);

    busCache = { ac, dry, wet, noise: whiteNoise(ac, 2) };
    return busCache;
  } catch {
    return null;
  }
}

/** One pitch-swept oscillator plus its own gain, wired to `dest` and given a
    hard stop time. Gain starts at silence so the caller can write whatever
    envelope it wants on top; frequency ramps exponentially because pitch is
    perceived logarithmically (a linear sweep sounds like it stalls at the top). */
function sweep(
  ac: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  t: number,
  rampEnd: number,
  stop: number,
  detune = 0,
): { osc: OscillatorNode; g: GainNode } {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(1, f0), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), rampEnd);
  g.gain.setValueAtTime(0.0001, t);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(stop);
  return { osc, g };
}

/** A finite slice of the shared noise table into `dest`. */
function noiseVoice(bus: WarpBus, dest: AudioNode, t: number, dur: number) {
  const src = bus.ac.createBufferSource();
  src.buffer = bus.noise;
  src.loop = true;
  src.connect(dest);
  src.start(t, Math.random() * Math.max(0, bus.noise.duration - 0.25));
  src.stop(t + dur);
}

/** Tap `from` into the plate at `amount`. */
function send(bus: WarpBus, from: AudioNode, amount: number) {
  const g = bus.ac.createGain();
  g.gain.value = amount;
  from.connect(g).connect(bus.wet);
}

/** How long the riser runs — matches IN.flash (1520ms) in HyperspaceJump.tsx. */
const RISE = 1.5;

/** Charge: a ~1.5s accelerating riser — sub swell, spooling detuned engine and
    rising air — that cuts to near-silence for the last 85ms. That held breath
    is what makes the impact land; without it the boom just merges into the
    riser and the whole thing reads as mush. */
export function warpCharge() {
  try {
    const ac = ctx();
    if (!ac) return;
    const bus = warpBus(ac);
    if (!bus) return;
    const t = ac.currentTime;
    const end = t + RISE;
    const gasp = end - 0.085;
    const stop = end + 0.06;

    // Ignition: without a transient at t=0 the riser fades in from nothing and
    // feels like a mistake. A short knock plus a puff of low noise gives it an
    // attack, like something heavy engaging.
    const kick = sweep(ac, bus.dry, "sine", 74, 38, t, t + 0.14, t + 0.4);
    kick.g.gain.linearRampToValueAtTime(0.34, t + 0.006);
    kick.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const ignBp = ac.createBiquadFilter();
    ignBp.type = "bandpass";
    ignBp.Q.value = 0.8;
    ignBp.frequency.setValueAtTime(520, t);
    const ignG = ac.createGain();
    ignG.gain.setValueAtTime(0.22, t);
    ignG.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    ignBp.connect(ignG).connect(bus.dry);
    noiseVoice(bus, ignBp, t, 0.26);

    // SUB — the chest. 28→52Hz: it starts below where most laptops can even
    // move air, so the swell reads as pressure building before it reads as a
    // pitch, then arrives as a note right as the flash hits.
    const sub = sweep(ac, bus.dry, "sine", 28, 52, t, gasp, stop);
    sub.g.gain.exponentialRampToValueAtTime(0.62, gasp);
    sub.g.gain.exponentialRampToValueAtTime(0.0001, end);

    // Ghost octave. Small speakers roll off hard below ~120Hz, so the sub above
    // is felt on desks and inaudible on a laptop. A quiet triangle an octave up
    // gives those speakers a harmonic to imply the missing fundamental from.
    const ghost = sweep(ac, bus.dry, "triangle", 56, 104, t, gasp, stop);
    ghost.g.gain.exponentialRampToValueAtTime(0.085, gasp);
    ghost.g.gain.exponentialRampToValueAtTime(0.0001, end);

    // ENGINE — two saws 18 cents apart. The beating between them is the whole
    // point: a single saw sounds synthetic and static, a detuned pair sounds
    // like a machine with moving parts.
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    // Q is in dB for lowpass/highpass in WebAudio, so 11 is ~+11dB at the
    // cutoff — resonant enough that the sweep itself sings, well short of the
    // self-oscillating screech that would fight the sub.
    lp.Q.value = 11;
    lp.frequency.setValueAtTime(150, t);
    lp.frequency.exponentialRampToValueAtTime(5200, gasp);

    // Accelerating turbine flutter: an LFO whose *own* rate ramps 5.5→30Hz.
    // Automating the modulator is what sells "spooling up" — a fixed-rate
    // tremolo just sounds like a stutter. It rides a unity-ish gain stage so
    // the depth can never drive the signal negative (which would read as a
    // phase flip at full volume rather than as a dip).
    const trem = ac.createGain();
    trem.gain.setValueAtTime(0.78, t);
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(5.5, t);
    lfo.frequency.exponentialRampToValueAtTime(30, gasp);
    depth.gain.setValueAtTime(0.04, t);
    depth.gain.linearRampToValueAtTime(0.34, gasp);
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(stop);

    const engine = ac.createGain();
    engine.gain.setValueAtTime(0.0001, t);
    engine.gain.exponentialRampToValueAtTime(0.38, gasp);
    engine.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(trem).connect(engine).connect(bus.dry);

    const sawA = sweep(ac, lp, "sawtooth", 55, 330, t, gasp, stop, -9);
    sawA.g.gain.linearRampToValueAtTime(0.32, t + 0.05);
    const sawB = sweep(ac, lp, "sawtooth", 55, 330, t, gasp, stop, +9);
    sawB.g.gain.linearRampToValueAtTime(0.32, t + 0.05);

    // AIR — bandpassed noise climbing 240→6500Hz. The upward sweep is what the
    // ear hears as "accelerating", independent of the pitched layers.
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(240, t);
    bp.frequency.exponentialRampToValueAtTime(6500, gasp);
    const air = ac.createGain();
    air.gain.setValueAtTime(0.0001, t);
    air.gain.exponentialRampToValueAtTime(0.34, gasp);
    air.gain.exponentialRampToValueAtTime(0.0001, end);
    bp.connect(air).connect(bus.dry);
    noiseVoice(bus, bp, t, RISE + 0.05);
    // A touch of plate on the air so the space appears to open up as we go.
    send(bus, air, 0.22);
  } catch {
    /* Garnish sound: never let an audio failure throw into React. */
  }
}

/** Impact: sub drop + body + click + blast, ringing out over ~1.2s. The four
    hit within 10ms of each other on purpose — a single "boom" oscillator has
    no transient, and a transient with no sub has no weight. */
export function warpBoom() {
  try {
    const ac = ctx();
    if (!ac) return;
    const bus = warpBus(ac);
    if (!bus) return;
    const t = ac.currentTime;

    // SUB DROP — 120→30Hz in 140ms, then a slow crawl to 24Hz. The fast drop
    // is the classic cinematic hit: the pitch fall itself reads as impact,
    // and the long crawl keeps the floor rumbling under the tail.
    const sub = sweep(ac, bus.dry, "sine", 120, 30, t, t + 0.14, t + 1.3);
    sub.osc.frequency.exponentialRampToValueAtTime(24, t + 0.9);
    sub.g.gain.linearRampToValueAtTime(0.9, t + 0.008);
    sub.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);

    // BODY — 90→52Hz triangle. This is the part that actually survives laptop
    // speakers; the sub above is mostly felt, this is what's heard as "thump".
    const body = sweep(ac, bus.dry, "triangle", 90, 52, t, t + 0.2, t + 0.7);
    body.g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    body.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

    // CLICK — 4ms highpassed noise. Almost inaudible alone, but it's what
    // makes the hit sound like it has an edge rather than a fade-in.
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1400, t);
    const clickG = ac.createGain();
    clickG.gain.setValueAtTime(0.0001, t);
    clickG.gain.linearRampToValueAtTime(0.34, t + 0.004);
    clickG.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    hp.connect(clickG).connect(bus.dry);
    noiseVoice(bus, hp, t, 0.12);

    // BLAST — noise through a lowpass collapsing 9k→180Hz over a second. The
    // closing filter is the shockwave passing and the air settling behind it.
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(9000, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 1.0);
    const blast = ac.createGain();
    blast.gain.setValueAtTime(0.0001, t);
    blast.gain.linearRampToValueAtTime(0.42, t + 0.012);
    blast.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    lp.connect(blast).connect(bus.dry);
    noiseVoice(bus, lp, t, 1.15);
    send(bus, blast, 0.4);

    // RING — a quiet stack of fifths struck by the impact, mostly into the
    // plate. Deliberately 220/330/495: warpLand's chime lands 80ms later on
    // 660/990/1320, i.e. the same harmonic series an octave-and-a-fifth up, so
    // the arrival sounds like a consequence of the impact rather than a new
    // sound effect.
    for (const [i, f] of [220, 330, 495].entries()) {
      const p = sweep(ac, bus.dry, "triangle", f, f * 0.985, t, t + 1.1, t + 1.25, i * 4);
      p.g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      p.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
      send(bus, p.g, 0.65);
    }
  } catch {
    /* see warpCharge */
  }
}

/** Land: the Grid rezzing in. Keeps the original cyan two-note chime identity
    but sets it on a settling sub pad and pushes it hard into the plate, so the
    arrival has a room rather than ending dead. Settles in ~1.2s. */
export function warpLand() {
  try {
    const ac = ctx();
    if (!ac) return;
    const bus = warpBus(ac);
    if (!bus) return;
    const t = ac.currentTime;

    // Ground settling — a soft, slowly sagging sub pad under the chime. Slow
    // attack (55ms) so it never reads as a second impact.
    const pad = sweep(ac, bus.dry, "sine", 46, 33, t, t + 0.9, t + 1.35);
    pad.g.gain.linearRampToValueAtTime(0.28, t + 0.055);
    pad.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

    // The chime. Each note is a pair a few cents apart so it shimmers instead
    // of sitting still; the sag from f to f*0.997 is a slight downward drift
    // that makes it sound like it's coming to rest.
    const notes: Array<[freq: number, at: number, dur: number, level: number]> = [
      [660, 0, 0.95, 0.075],
      [990, 0.08, 1.15, 0.06],
      [1320, 0.16, 0.7, 0.035],
    ];
    for (const [f, at, dur, level] of notes) {
      for (const cents of [-4, +4]) {
        const n = sweep(
          ac, bus.dry, f > 1000 ? "sine" : "triangle",
          f, f * 0.997, t + at, t + at + dur, t + at + dur + 0.1, cents,
        );
        n.g.gain.linearRampToValueAtTime(level, t + at + 0.012);
        n.g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        send(bus, n.g, 0.85);
      }
    }

    // Rez sparkle: a very short high noise chirp, almost entirely wet, so the
    // plate catches it and it dissolves into the tail.
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(7200, t + 0.3);
    const spark = ac.createGain();
    spark.gain.setValueAtTime(0.0001, t);
    spark.gain.linearRampToValueAtTime(0.09, t + 0.02);
    spark.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    bp.connect(spark).connect(bus.dry);
    noiseVoice(bus, bp, t, 0.36);
    send(bus, spark, 1.0);
  } catch {
    /* see warpCharge */
  }
}

/** The jump home: warpCharge run backwards. Pitch falls, the resonant filter
    closes, the turbine flutter decelerates, and it lands on a muted thud
    instead of the full impact — leaving the Grid should feel like powering
    down, not like a second explosion. Matches OUT.flash (460ms). */
export function warpDown() {
  try {
    const ac = ctx();
    if (!ac) return;
    const bus = warpBus(ac);
    if (!bus) return;
    const t = ac.currentTime;
    const fall = 0.46; // the reverse flash
    const hit = t + fall;

    // ENGINE — the same detuned pair, falling, with the lowpass closing down
    // over it. Resonance is a little lower than the riser's so the descent
    // sounds like it's losing energy rather than screaming.
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 8;
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(240, hit);

    // Flutter running down: 26→4Hz, the turbine winding to a stop.
    const trem = ac.createGain();
    trem.gain.setValueAtTime(0.8, t);
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(26, t);
    lfo.frequency.exponentialRampToValueAtTime(4, hit);
    depth.gain.setValueAtTime(0.3, t);
    depth.gain.linearRampToValueAtTime(0.05, hit);
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(hit + 0.1);

    const engine = ac.createGain();
    engine.gain.setValueAtTime(0.0001, t);
    engine.gain.linearRampToValueAtTime(0.36, t + 0.05);
    engine.gain.exponentialRampToValueAtTime(0.0001, hit + 0.06);
    lp.connect(trem).connect(engine).connect(bus.dry);

    const sawA = sweep(ac, lp, "sawtooth", 340, 48, t, hit, hit + 0.1, -9);
    sawA.g.gain.linearRampToValueAtTime(0.32, t + 0.03);
    const sawB = sweep(ac, lp, "sawtooth", 340, 48, t, hit, hit + 0.1, +9);
    sawB.g.gain.linearRampToValueAtTime(0.32, t + 0.03);

    // AIR sweeping down — the mirror of the riser's climb.
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(5400, t);
    bp.frequency.exponentialRampToValueAtTime(260, hit);
    const air = ac.createGain();
    air.gain.setValueAtTime(0.0001, t);
    air.gain.linearRampToValueAtTime(0.3, t + 0.04);
    air.gain.exponentialRampToValueAtTime(0.0001, hit + 0.06);
    bp.connect(air).connect(bus.dry);
    noiseVoice(bus, bp, t, fall + 0.1);
    send(bus, air, 0.2);

    // SUB — a bed that sinks with the engine, then a soft landing thud at the
    // flash. Roughly half the boom's level and with a 12ms attack instead of
    // 8ms, which is enough to read as "muffled" rather than "hit".
    const bed = sweep(ac, bus.dry, "sine", 60, 27, t, hit, hit + 0.05);
    bed.g.gain.exponentialRampToValueAtTime(0.34, t + 0.12);
    bed.g.gain.exponentialRampToValueAtTime(0.0001, hit + 0.04);

    const thud = sweep(ac, bus.dry, "sine", 68, 26, hit, hit + 0.18, hit + 0.85);
    thud.g.gain.linearRampToValueAtTime(0.5, hit + 0.012);
    thud.g.gain.exponentialRampToValueAtTime(0.0001, hit + 0.75);
    const thudBody = sweep(ac, bus.dry, "triangle", 82, 48, hit, hit + 0.2, hit + 0.6);
    thudBody.g.gain.linearRampToValueAtTime(0.16, hit + 0.015);
    thudBody.g.gain.exponentialRampToValueAtTime(0.0001, hit + 0.5);

    // Muffled noise puff on the landing — lowpassed hard so it's a "whump",
    // not the boom's bright blast.
    const tlp = ac.createBiquadFilter();
    tlp.type = "lowpass";
    tlp.frequency.setValueAtTime(1200, hit);
    tlp.frequency.exponentialRampToValueAtTime(160, hit + 0.5);
    const puff = ac.createGain();
    puff.gain.setValueAtTime(0.0001, hit);
    puff.gain.linearRampToValueAtTime(0.2, hit + 0.012);
    puff.gain.exponentialRampToValueAtTime(0.0001, hit + 0.55);
    tlp.connect(puff).connect(bus.dry);
    noiseVoice(bus, tlp, hit, 0.6);
    send(bus, puff, 0.3);
  } catch {
    /* see warpCharge */
  }
}
