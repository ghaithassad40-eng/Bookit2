// Procedural background music engine.
//
// Synthesizes a short looping piece per business using the Web Audio API.
// Nothing is shipped or streamed — every note is generated in the browser,
// so there are zero licensing concerns and no audio assets to load.
//
// Each business industry maps to a `MusicPreset` describing tempo, scale,
// melody, bass and drum pattern, plus the instrument flavour.

export type Instrument = "african" | "lofi" | "guitar" | "bell" | "lead" | "pad" | "ambient";

export interface DrumHit {
  step: number;
  type: "kick" | "snare" | "hat" | "clap" | "bell";
}

export interface MelodyNote {
  step: number;       // 16th-note position in the pattern
  degree: number;     // index into `scale`
  octave: number;     // 0 = root octave
  duration: number;   // length in 16ths
  velocity?: number;  // 0..1
}

export interface BassNote {
  step: number;
  degree: number;
  duration: number;
}

export interface MusicPreset {
  name: string;
  description: string;
  tempo: number;          // BPM
  rootMidi: number;       // MIDI number of scale root
  scale: number[];        // semitone offsets from root
  totalSteps: number;     // pattern length in 16ths (16 = 1 bar in 4/4)
  instrument: Instrument;
  melody: MelodyNote[];
  bass?: BassNote[];
  drums?: DrumHit[];
  /** Optional low-pass cutoff (Hz) for a warmer / more lo-fi feel. */
  filter?: number;
  /** Higher → louder. Default 0.4. */
  gain?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noteFreq(preset: MusicPreset, degree: number, octave: number): number {
  const semis = preset.scale[((degree % preset.scale.length) + preset.scale.length) % preset.scale.length];
  const midi = preset.rootMidi + semis + octave * 12;
  return midiToFreq(midi);
}

// ---------------------------------------------------------------------------
// Voice synthesis primitives
// ---------------------------------------------------------------------------

type Ctx = AudioContext;

function envelope(ctx: Ctx, peak: number, attack: number, decay: number, sustain: number, release: number, length: number) {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(peak * sustain, t + attack + decay);
  g.gain.linearRampToValueAtTime(0, t + length + release);
  return g;
}

function makeOsc(ctx: Ctx, type: OscillatorType, freq: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

function playMelodyNote(
  ctx: Ctx,
  out: AudioNode,
  freq: number,
  durationSec: number,
  instrument: Instrument,
  velocity = 0.7,
) {
  const t = ctx.currentTime;

  switch (instrument) {
    case "african": {
      // Bright marimba-ish: triangle + a touch of square
      const tri = makeOsc(ctx, "triangle", freq);
      const sq = makeOsc(ctx, "square", freq * 2, 5);
      const env = envelope(ctx, 0.35 * velocity, 0.005, 0.15, 0.25, 0.18, durationSec);
      const sqGain = ctx.createGain();
      sqGain.gain.value = 0.06;
      tri.connect(env).connect(out);
      sq.connect(sqGain).connect(env);
      tri.start(t);
      sq.start(t);
      tri.stop(t + durationSec + 0.4);
      sq.stop(t + durationSec + 0.4);
      break;
    }
    case "bell": {
      // FM-like bell using two oscillators
      const carrier = makeOsc(ctx, "sine", freq);
      const mod = makeOsc(ctx, "sine", freq * 3.01);
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 0.6;
      const env = envelope(ctx, 0.4 * velocity, 0.002, 0.4, 0.05, 0.6, durationSec);
      mod.connect(modGain).connect(carrier.frequency);
      carrier.connect(env).connect(out);
      mod.start(t);
      carrier.start(t);
      mod.stop(t + durationSec + 0.7);
      carrier.stop(t + durationSec + 0.7);
      break;
    }
    case "guitar": {
      const sq = makeOsc(ctx, "sawtooth", freq);
      const env = envelope(ctx, 0.32 * velocity, 0.005, 0.18, 0.4, 0.2, durationSec);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 2400;
      sq.connect(filt).connect(env).connect(out);
      sq.start(t);
      sq.stop(t + durationSec + 0.3);
      break;
    }
    case "lofi": {
      const sine = makeOsc(ctx, "sine", freq);
      const tri = makeOsc(ctx, "triangle", freq * 2, -8);
      const env = envelope(ctx, 0.3 * velocity, 0.01, 0.2, 0.45, 0.3, durationSec);
      const triGain = ctx.createGain();
      triGain.gain.value = 0.08;
      sine.connect(env).connect(out);
      tri.connect(triGain).connect(env);
      sine.start(t);
      tri.start(t);
      sine.stop(t + durationSec + 0.4);
      tri.stop(t + durationSec + 0.4);
      break;
    }
    case "lead": {
      const saw = makeOsc(ctx, "sawtooth", freq);
      const sq = makeOsc(ctx, "square", freq, 7);
      const env = envelope(ctx, 0.3 * velocity, 0.005, 0.1, 0.6, 0.18, durationSec);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1800;
      saw.connect(filt);
      sq.connect(filt);
      filt.connect(env).connect(out);
      saw.start(t);
      sq.start(t);
      saw.stop(t + durationSec + 0.3);
      sq.stop(t + durationSec + 0.3);
      break;
    }
    case "pad":
    case "ambient": {
      const a = makeOsc(ctx, "sine", freq);
      const b = makeOsc(ctx, "sine", freq * 2, 7);
      const c = makeOsc(ctx, "triangle", freq * 0.5, -7);
      const env = envelope(ctx, 0.25 * velocity, 0.4, 0.4, 0.7, 0.8, durationSec);
      const bGain = ctx.createGain(); bGain.gain.value = 0.12;
      const cGain = ctx.createGain(); cGain.gain.value = 0.18;
      a.connect(env).connect(out);
      b.connect(bGain).connect(env);
      c.connect(cGain).connect(env);
      a.start(t); b.start(t); c.start(t);
      const stopAt = t + durationSec + 1.0;
      a.stop(stopAt); b.stop(stopAt); c.stop(stopAt);
      break;
    }
  }
}

function playBassNote(ctx: Ctx, out: AudioNode, freq: number, durationSec: number, velocity = 0.7) {
  const o = makeOsc(ctx, "sawtooth", freq * 0.5);
  const env = envelope(ctx, 0.4 * velocity, 0.005, 0.05, 0.6, 0.1, durationSec);
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 700;
  o.connect(filt).connect(env).connect(out);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + durationSec + 0.2);
}

function playDrum(ctx: Ctx, out: AudioNode, type: DrumHit["type"]) {
  const t = ctx.currentTime;
  switch (type) {
    case "kick": {
      const o = makeOsc(ctx, "sine", 110);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.6, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(35, t + 0.18);
      o.connect(env).connect(out);
      o.start(t);
      o.stop(t + 0.3);
      break;
    }
    case "snare": {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "highpass";
      filt.frequency.value = 1200;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.4, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      noise.connect(filt).connect(env).connect(out);
      noise.start(t);
      noise.stop(t + 0.2);
      break;
    }
    case "hat": {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "highpass";
      filt.frequency.value = 7000;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.18, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(filt).connect(env).connect(out);
      noise.start(t);
      noise.stop(t + 0.06);
      break;
    }
    case "clap": {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
      noise.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1800;
      filt.Q.value = 1.2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.45, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      noise.connect(filt).connect(env).connect(out);
      noise.start(t);
      noise.stop(t + 0.18);
      break;
    }
    case "bell": {
      const o = makeOsc(ctx, "sine", 1300);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.18, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(env).connect(out);
      o.start(t);
      o.stop(t + 0.18);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private preset: MusicPreset | null = null;
  private playing = false;
  private volume = 0.5;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume * (this.preset?.gain ?? 0.4);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  currentPreset(): MusicPreset | null {
    return this.preset;
  }

  async start(preset: MusicPreset) {
    if (this.playing && this.preset === preset) return;
    if (this.playing) this.stop();

    const ctor = (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!ctor) return;

    this.ctx = new ctor();
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // continue, schedule will retry on next interaction
      }
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * (preset.gain ?? 0.4);
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = preset.filter ?? 14000;
    this.master.connect(this.filter).connect(this.ctx.destination);

    this.preset = preset;
    this.step = 0;
    this.playing = true;
    this.scheduleLoop();
  }

  stop() {
    this.playing = false;
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.master = null;
    this.filter = null;
    this.preset = null;
  }

  private scheduleLoop() {
    if (!this.preset || !this.ctx || !this.master) return;
    const sixteenthMs = (60_000 / this.preset.tempo) / 4;
    const tick = () => {
      if (!this.playing || !this.preset || !this.ctx || !this.master) return;
      const step = this.step % this.preset.totalSteps;
      const sixteenthSec = sixteenthMs / 1000;

      // Melody
      this.preset.melody
        .filter((n) => n.step === step)
        .forEach((n) => {
          const f = noteFreq(this.preset!, n.degree, n.octave);
          playMelodyNote(this.ctx!, this.master!, f, n.duration * sixteenthSec, this.preset!.instrument, n.velocity ?? 0.7);
        });

      // Bass
      this.preset.bass
        ?.filter((n) => n.step === step)
        .forEach((n) => {
          const f = noteFreq(this.preset!, n.degree, -1);
          playBassNote(this.ctx!, this.master!, f, n.duration * sixteenthSec);
        });

      // Drums
      this.preset.drums
        ?.filter((d) => d.step === step)
        .forEach((d) => playDrum(this.ctx!, this.master!, d.type));

      this.step = (this.step + 1) % this.preset.totalSteps;
      this.timer = window.setTimeout(tick, sixteenthMs);
    };
    tick();
  }
}

// ---------------------------------------------------------------------------
// Per-industry presets — each captures the vibe of the sport / business
// without quoting any copyrighted melody.
// ---------------------------------------------------------------------------

const FOOTBALL_PRESET: MusicPreset = {
  name: "Stadium Anthem",
  description: "Festive Latin-African groove that makes you want to chant.",
  tempo: 128,
  rootMidi: 62, // D
  scale: [0, 2, 4, 7, 9], // major pentatonic — the "Waka"-like brightness
  totalSteps: 32,
  instrument: "african",
  melody: [
    // Bar 1
    { step: 0,  degree: 0, octave: 1, duration: 1, velocity: 0.85 },
    { step: 2,  degree: 2, octave: 1, duration: 1 },
    { step: 4,  degree: 4, octave: 1, duration: 2, velocity: 0.9 },
    { step: 8,  degree: 3, octave: 1, duration: 1 },
    { step: 10, degree: 2, octave: 1, duration: 1 },
    { step: 12, degree: 0, octave: 1, duration: 4, velocity: 0.8 },
    // Bar 2
    { step: 16, degree: 2, octave: 1, duration: 1 },
    { step: 18, degree: 4, octave: 1, duration: 1 },
    { step: 20, degree: 3, octave: 1, duration: 2 },
    { step: 24, degree: 2, octave: 1, duration: 1 },
    { step: 26, degree: 0, octave: 1, duration: 1 },
    { step: 28, degree: 0, octave: 2, duration: 4, velocity: 0.95 },
  ],
  bass: [
    { step: 0,  degree: 0, duration: 4 },
    { step: 6,  degree: 2, duration: 2 },
    { step: 8,  degree: 3, duration: 4 },
    { step: 14, degree: 0, duration: 2 },
    { step: 16, degree: 0, duration: 4 },
    { step: 22, degree: 2, duration: 2 },
    { step: 24, degree: 4, duration: 4 },
    { step: 30, degree: 0, duration: 2 },
  ],
  drums: [
    // Pulse on every quarter
    ...Array.from({ length: 8 }, (_, i) => ({ step: i * 4, type: "kick" as const })),
    // Claps on 2 and 4 of each bar (steps 4, 12, 20, 28)
    { step: 4, type: "clap" }, { step: 12, type: "clap" },
    { step: 20, type: "clap" }, { step: 28, type: "clap" },
    // Hats on every 8th
    ...Array.from({ length: 16 }, (_, i) => ({ step: i * 2, type: "hat" as const })),
  ],
  gain: 0.42,
};

const BASKETBALL_PRESET: MusicPreset = {
  name: "Hardwood Bounce",
  description: "Hip-hop bounce, low slung, head-nodding tempo.",
  tempo: 92,
  rootMidi: 60, // C
  scale: [0, 3, 5, 7, 10], // minor pentatonic
  totalSteps: 16,
  instrument: "lead",
  melody: [
    { step: 0,  degree: 0, octave: 1, duration: 2 },
    { step: 3,  degree: 2, octave: 1, duration: 1 },
    { step: 6,  degree: 1, octave: 1, duration: 2 },
    { step: 10, degree: 0, octave: 1, duration: 2 },
    { step: 13, degree: 4, octave: 0, duration: 3 },
  ],
  bass: [
    { step: 0,  degree: 0, duration: 4 },
    { step: 6,  degree: 2, duration: 2 },
    { step: 8,  degree: 3, duration: 4 },
    { step: 14, degree: 0, duration: 2 },
  ],
  drums: [
    { step: 0,  type: "kick" }, { step: 6, type: "kick" }, { step: 10, type: "kick" },
    { step: 4,  type: "snare" }, { step: 12, type: "snare" },
    ...Array.from({ length: 8 }, (_, i) => ({ step: i * 2, type: "hat" as const })),
  ],
  filter: 6500,
  gain: 0.4,
};

const PADEL_PRESET: MusicPreset = {
  name: "Spanish Sun",
  description: "Latin guitar groove with a relaxed swing.",
  tempo: 108,
  rootMidi: 57, // A
  scale: [0, 2, 3, 5, 7, 8, 10], // natural minor
  totalSteps: 16,
  instrument: "guitar",
  melody: [
    { step: 0,  degree: 0, octave: 1, duration: 1 },
    { step: 2,  degree: 4, octave: 1, duration: 1 },
    { step: 4,  degree: 6, octave: 1, duration: 1 },
    { step: 6,  degree: 4, octave: 1, duration: 1 },
    { step: 8,  degree: 5, octave: 1, duration: 1 },
    { step: 10, degree: 4, octave: 1, duration: 1 },
    { step: 12, degree: 2, octave: 1, duration: 1 },
    { step: 14, degree: 0, octave: 1, duration: 2 },
  ],
  bass: [
    { step: 0,  degree: 0, duration: 4 },
    { step: 4,  degree: 3, duration: 4 },
    { step: 8,  degree: 5, duration: 4 },
    { step: 12, degree: 4, duration: 4 },
  ],
  drums: [
    { step: 0,  type: "kick" }, { step: 8, type: "kick" },
    { step: 4,  type: "snare" }, { step: 12, type: "snare" },
    ...Array.from({ length: 8 }, (_, i) => ({ step: i * 2, type: "hat" as const })),
    { step: 7, type: "clap" }, { step: 15, type: "clap" },
  ],
  gain: 0.35,
};

const CRICKET_PRESET: MusicPreset = {
  name: "Village Green",
  description: "Bright pastoral bells, English summer afternoon.",
  tempo: 96,
  rootMidi: 62, // D
  scale: [0, 2, 4, 7, 9], // major pentatonic
  totalSteps: 16,
  instrument: "bell",
  melody: [
    { step: 0,  degree: 0, octave: 1, duration: 2 },
    { step: 3,  degree: 2, octave: 1, duration: 1 },
    { step: 5,  degree: 4, octave: 1, duration: 2 },
    { step: 8,  degree: 3, octave: 1, duration: 2 },
    { step: 11, degree: 2, octave: 1, duration: 1 },
    { step: 13, degree: 0, octave: 1, duration: 3 },
  ],
  bass: [
    { step: 0, degree: 0, duration: 4 },
    { step: 8, degree: 3, duration: 4 },
  ],
  drums: [
    { step: 0,  type: "bell" }, { step: 8, type: "bell" },
  ],
  gain: 0.32,
};

const GYM_PRESET: MusicPreset = {
  name: "Pre-Lift Surge",
  description: "Driving electronic pulse, locker-room intensity.",
  tempo: 138,
  rootMidi: 57, // A
  scale: [0, 3, 5, 7, 10],
  totalSteps: 16,
  instrument: "lead",
  melody: [
    { step: 0,  degree: 0, octave: 1, duration: 1 },
    { step: 2,  degree: 0, octave: 1, duration: 1 },
    { step: 4,  degree: 2, octave: 1, duration: 1 },
    { step: 6,  degree: 3, octave: 1, duration: 1 },
    { step: 8,  degree: 4, octave: 1, duration: 1 },
    { step: 10, degree: 3, octave: 1, duration: 1 },
    { step: 12, degree: 2, octave: 1, duration: 1 },
    { step: 14, degree: 0, octave: 1, duration: 2 },
  ],
  bass: [
    { step: 0, degree: 0, duration: 2 }, { step: 4, degree: 0, duration: 2 },
    { step: 8, degree: 0, duration: 2 }, { step: 12, degree: 0, duration: 2 },
  ],
  drums: [
    { step: 0, type: "kick" }, { step: 4, type: "kick" }, { step: 8, type: "kick" }, { step: 12, type: "kick" },
    { step: 4, type: "snare" }, { step: 12, type: "snare" },
    ...Array.from({ length: 16 }, (_, i) => ({ step: i, type: "hat" as const })),
  ],
  gain: 0.4,
};

const SALON_PRESET: MusicPreset = {
  name: "Lo-fi Mirror",
  description: "Warm Rhodes-style chords, late-afternoon café.",
  tempo: 78,
  rootMidi: 65, // F
  scale: [0, 2, 4, 5, 7, 9, 11],
  totalSteps: 16,
  instrument: "lofi",
  melody: [
    { step: 0,  degree: 0, octave: 1, duration: 4 },
    { step: 2,  degree: 4, octave: 1, duration: 2, velocity: 0.5 },
    { step: 6,  degree: 6, octave: 1, duration: 2, velocity: 0.5 },
    { step: 8,  degree: 5, octave: 1, duration: 4 },
    { step: 12, degree: 2, octave: 1, duration: 4 },
  ],
  bass: [
    { step: 0, degree: 0, duration: 8 },
    { step: 8, degree: 3, duration: 8 },
  ],
  drums: [
    { step: 0, type: "kick" }, { step: 8, type: "kick" },
    { step: 4, type: "snare" }, { step: 12, type: "snare" },
  ],
  filter: 4500,
  gain: 0.34,
};

const CLINIC_PRESET: MusicPreset = {
  name: "Quiet Waiting",
  description: "Calm minimal pad, low-stress ambience.",
  tempo: 60,
  rootMidi: 60, // C
  scale: [0, 2, 4, 5, 7, 9, 11],
  totalSteps: 16,
  instrument: "pad",
  melody: [
    { step: 0, degree: 0, octave: 1, duration: 8 },
    { step: 8, degree: 3, octave: 1, duration: 8 },
  ],
  drums: [],
  gain: 0.28,
};

const YOGA_PRESET: MusicPreset = {
  name: "Stillness",
  description: "Drone + slow-moving pad, breath-led.",
  tempo: 56,
  rootMidi: 60, // C
  scale: [0, 2, 4, 7, 9, 11],
  totalSteps: 16,
  instrument: "ambient",
  melody: [
    { step: 0, degree: 0, octave: 0, duration: 16, velocity: 0.5 },
    { step: 0, degree: 4, octave: 1, duration: 8, velocity: 0.4 },
    { step: 8, degree: 2, octave: 1, duration: 8, velocity: 0.4 },
  ],
  filter: 3500,
  gain: 0.3,
};

export const PRESETS: Record<string, MusicPreset> = {
  football: FOOTBALL_PRESET,
  basketball: BASKETBALL_PRESET,
  padel: PADEL_PRESET,
  cricket: CRICKET_PRESET,
  gym: GYM_PRESET,
  salon: SALON_PRESET,
  barber: SALON_PRESET,
  clinic: CLINIC_PRESET,
  yoga: YOGA_PRESET,
  spa: YOGA_PRESET,
};

export function presetForIndustry(industry: string | null | undefined): MusicPreset {
  if (!industry) return CLINIC_PRESET;
  return PRESETS[industry.toLowerCase()] ?? CLINIC_PRESET;
}
