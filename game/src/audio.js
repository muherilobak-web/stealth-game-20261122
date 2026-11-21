// The Gloaming Archive — every sound is synthesized live with WebAudio:
// oscillators and filtered noise only, no audio files, nothing copied.
// Audio starts only after the player's first gesture, as browsers require.

// Small helper: an oscillator that slides from one pitch to another.
// Silently skips when there is no live audio context (before the first
// gesture, or while the context is suspended).
function synthTone(ctx, type, fromHz, toHz, duration, volume, when) {
  if (!ctx || ctx.state === 'suspended') return;
  const t0 = when || ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const AudioSys = {
  ctx: null,
  muted: false,
  ambientNodes: null,

  // Create the audio context on the first user gesture.
  ensure: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.startAmbient();
    } catch (e) {
      this.ctx = null;
    }
  },

  setMuted: function (muted) {
    this.muted = muted;
    if (this.ctx) {
      this.ctx.suspend();
      if (!muted) this.ctx.resume();
    }
  },

  // A very quiet low drone that sits under the whole game.
  startAmbient: function () {
    if (!this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.018;
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    this.ambientNodes = { osc: osc, osc2: osc2, gain: gain };
  },

  // Soft thud for the player's own step.
  playerStep: function () {
    if (!this.ctx || this.muted) return;
    synthTone(this.ctx, 'sine', 95, 60, 0.09, 0.12);
  },

  // A warden's step: louder, panned left/right by direction from the
  // player, so the player can hear which way a warden is coming from.
  guardStep: function (pan, volume) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(70, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22 * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  },

  // Gentle chime when a relic page or ink pot is picked up.
  pagePickup: function () {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    synthTone(ctx, 'sine', 660, 660, 0.25, 0.14);
    synthTone(ctx, 'sine', 990, 990, 0.3, 0.1, ctx.currentTime + 0.07);
  },

  // Metallic clink and a soft landing thud for a thrown coin.
  coinThrow: function () {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    synthTone(ctx, 'square', 2400, 1800, 0.08, 0.06);
    synthTone(ctx, 'sine', 140, 90, 0.12, 0.1, ctx.currentTime + 0.18);
  },

  // Rising sting when the alarm goes up.
  alarmSting: function () {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    synthTone(ctx, 'sawtooth', 220, 440, 0.5, 0.12);
    synthTone(ctx, 'sawtooth', 233, 466, 0.5, 0.12, ctx.currentTime + 0.05);
  },

  // Falling notes when the player is caught.
  caughtSound: function () {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    synthTone(ctx, 'triangle', 392, 392, 0.3, 0.16);
    synthTone(ctx, 'triangle', 311, 311, 0.35, 0.16, ctx.currentTime + 0.25);
    synthTone(ctx, 'triangle', 233, 180, 0.5, 0.16, ctx.currentTime + 0.55);
  },

  // Rising arpeggio when a level is finished.
  winSound: function () {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      synthTone(ctx, 'sine', notes[i], notes[i], 0.35, 0.14, ctx.currentTime + i * 0.12);
    }
  },
};
