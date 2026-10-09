// Procedural vehicle audio: engine (firing-order harmonics), intake/exhaust
// roar, tyre squeal, wind and crash impacts. Everything is synthesised.
export class AudioEngine {
  constructor() { this.ctx = null; this.enabled = true; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.55; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.connect(this.master); this.bus = comp;
    // engine: 3 harmonic oscillators through a waveshaper and filter
    this.eng = { oscs: [], gain: c.createGain(), filter: c.createBiquadFilter(), shaper: c.createWaveShaper() };
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 2.2); }
    this.eng.shaper.curve = curve;
    this.eng.filter.type = 'lowpass'; this.eng.filter.frequency.value = 800; this.eng.filter.Q.value = 1.2;
    for (const [type, mul, g] of [['sawtooth', 1, 0.5], ['square', 2, 0.22], ['sawtooth', 0.5, 0.35], ['triangle', 4, 0.12]]) {
      const o = c.createOscillator(); o.type = type; const og = c.createGain(); og.gain.value = g;
      o.connect(og); og.connect(this.eng.shaper); o.start();
      this.eng.oscs.push({ o, mul });
    }
    this.eng.shaper.connect(this.eng.filter); this.eng.filter.connect(this.eng.gain); this.eng.gain.connect(this.bus);
    this.eng.gain.gain.value = 0;
    // noise source
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(); return { s, fl, g }; };
    this.squeal = mk('bandpass', 1500, 6);
    this.wind = mk('lowpass', 500, 0.5);
    this.roll = mk('lowpass', 220, 0.8);
    this.noiseBuf = nb;
  }

  update(v, dt) {
    if (!this.ctx || !v) return;
    const c = this.ctx, t = c.currentTime;
    const d = v.drive, e = d.cfg.engine;
    const rpm = d.rpm;
    const cyl = v.bp.cfg.engine.includes('V8') ? 8 : 4;
    const f0 = (rpm / 60) * (cyl / 2);
    this.eng.oscs.forEach(({ o, mul }) => o.frequency.setTargetAtTime(Math.max(8, f0 * mul), t, 0.03));
    const load = d.thrApplied;
    this.eng.filter.frequency.setTargetAtTime(350 + load * 1400 + (rpm / e.redline) * 1800, t, 0.05);
    this.eng.gain.gain.setTargetAtTime(this.enabled ? 0.12 + load * 0.22 + (d.limiter ? 0.0 : 0) : 0, t, 0.05);
    // squeal from tyre slip
    let slip = 0;
    for (const w of v.wheels) {
      if (w.load < 300) continue;
      const vs = Math.max(2, Math.abs(w.vFwd));
      const long = Math.abs(w.omega * w.radius - w.vFwd) / vs;
      slip = Math.max(slip, Math.min(1, Math.max(0, long - 0.12) * 2.2));
    }
    const lat = Math.abs(v.frame.vcom[0] * v.frame.r[0] + v.frame.vcom[2] * v.frame.r[2]);
    slip = Math.max(slip, Math.min(1, Math.max(0, lat - 2.2) / 6)) * (Math.abs(v.frame.speed) > 3 ? 1 : 0.4);
    this.squeal.g.gain.setTargetAtTime(this.enabled ? slip * 0.22 : 0, t, 0.05);
    this.squeal.fl.frequency.setTargetAtTime(1100 + slip * 900 + Math.abs(v.frame.speed) * 8, t, 0.1);
    const sp = Math.abs(v.frame.speed);
    this.wind.g.gain.setTargetAtTime(this.enabled ? Math.min(0.28, (sp / 70) ** 2 * 0.3) : 0, t, 0.1);
    this.wind.fl.frequency.setTargetAtTime(300 + sp * 20, t, 0.1);
    this.roll.g.gain.setTargetAtTime(this.enabled ? Math.min(0.12, sp / 120) : 0, t, 0.1);
    // crash impacts
    const imp = v.impactAccum; v.impactAccum = 0;
    if (imp > 80 && this.enabled) this.thud(Math.min(1, imp / 4000));
  }

  thud(strength) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 180 + Math.random() * 900; f.Q.value = 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 + strength * 0.8, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + strength * 0.4);
    src.connect(f); f.connect(g); g.connect(this.bus); src.start(t, Math.random()); src.stop(t + 0.7);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const og = c.createGain(); og.gain.setValueAtTime(strength * 0.7, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + 0.35);
  }
}
