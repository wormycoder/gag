// Engine -> clutch -> gearbox -> transfer/centre diff -> axle diffs -> wheels.
// Each physics step it reads the real wheel speeds produced by the soft-body
// simulation and returns the torque to push into each wheel. Nothing here knows
// about vehicle speed: the car accelerates only as fast as the tyres can grip.

const RPM2RAD = Math.PI / 30;
const RAD2RPM = 30 / Math.PI;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function makeCurve(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
      }
    }
    return ys[ys.length - 1];
  };
}

export class Drivetrain {
  constructor(cfg, wheels) {
    this.cfg = cfg;
    this.n = wheels.length;
    this.torque = new Float64Array(this.n);
    this.curve = makeCurve(cfg.engine.curve);
    this.abs = cfg.abs !== false;
    this.tcs = !!cfg.tcs;
    this.lowRange = false;
    this.reset();
  }

  reset() {
    const e = this.cfg.engine;
    this.omegaE = e.idle * RPM2RAD;
    this.rpm = e.idle;
    this.gear = 0; // -1 reverse, 0 neutral, 1..n
    this.auto = this.cfg.gearbox.auto !== false;
    this.dir = 'D';
    this.shiftTimer = 0;
    this.sinceShift = 10;
    this.shiftLen = 0.2;
    this.clutchEng = 0;
    this.limiter = false;
    this.running = true;
    this.engineReaction = 0;
    this.effBrake = 0;
    this.effThrottle = 0;
    this.thrApplied = 0;
    this.revDelay = 0;
    this.load = 0;
    this.clutchSlip = 0;
    this.tcsActive = false;
    if (this.auto) this.gear = 1;
  }

  get gearLabel() {
    if (this.cfg.gearbox.auto && this.auto) {
      if (this.dir === 'R') return 'R';
      if (this.dir === 'N') return 'N';
      return 'D' + (this.gear > 0 ? this.gear : '');
    }
    if (this.gear < 0) return 'R';
    if (this.gear === 0) return 'N';
    return String(this.gear);
  }

  _ratio() {
    const g = this.cfg.gearbox;
    if (this.gear === 0) return 0;
    const low = this.lowRange && this.cfg.transferLow ? this.cfg.transferLow : 1;
    if (this.gear < 0) return -g.reverse * g.final * low;
    return g.ratios[this.gear - 1] * g.final * low;
  }

  toggleAuto() {
    this.auto = !this.auto;
    if (this.auto) {
      this.dir = this.gear < 0 ? 'R' : 'D';
      if (this.gear <= 0) this.gear = 1;
    } else if (this.dir === 'R') this.gear = -1;
    return this.auto;
  }

  shift(to) {
    if (to === this.gear) return;
    this.gear = to;
    this.shiftLen = this.auto ? this.cfg.gearbox.shiftTime * 1.2 : this.cfg.gearbox.shiftTime;
    this.shiftTimer = this.shiftLen;
    this.sinceShift = 0;
  }

  /**
   * @param {number} dt
   * @param {object} inp vehicle input (throttle, brake, shiftUp, shiftDown...)
   * @param {Array} wheels vehicle wheels (omega, inertiaEff, driven, axle, side, radius, vFwd)
   * @param {number} speed signed forward speed (m/s)
   * @returns {Float64Array} torque per wheel
   */
  update(dt, inp, wheels, speed) {
    const cfg = this.cfg;
    const e = cfg.engine;
    const gb = cfg.gearbox;
    const T = this.torque;
    T.fill(0);
    this.sinceShift += dt;
    if (this.shiftTimer > 0) this.shiftTimer -= dt;

    // ---------------------------------------------------- driver intent
    let thr = inp.throttle, brk = inp.brake;
    const stopped = Math.abs(speed) < 0.9;
    if (this.auto && gb.auto !== false) {
      if (this.dir === 'D' && stopped && inp.brake > 0.1 && inp.throttle < 0.05) this.revDelay += dt;
      else if (this.dir === 'R' && stopped && inp.throttle > 0.1 && inp.brake < 0.05) this.revDelay += dt;
      else this.revDelay = 0;
      if (this.revDelay > 0.3 && this.dir !== 'N') {
        this.dir = this.dir === 'D' ? 'R' : 'D';
        this.revDelay = 0;
        this.gear = this.dir === 'R' ? -1 : 1;
        this.shiftLen = 0.25;
        this.shiftTimer = 0.25;
        this.sinceShift = 0;
      }
      if (this.dir === 'R') { thr = inp.brake; brk = inp.throttle; }
      if (this.dir === 'N') { /* pedals as-is */ }
    }
    this.effBrake = brk;
    this.effThrottle = thr;

    // manual shifting ---------------------------------------------------
    if (inp.shiftUp) {
      inp.shiftUp = false;
      if (!this.auto) { if (this.gear < gb.ratios.length) this.shift(this.gear === -1 ? 0 : this.gear + 1); }
      else if (this.dir === 'D' && this.gear < gb.ratios.length) this.shift(this.gear + 1);
    }
    if (inp.shiftDown) {
      inp.shiftDown = false;
      if (!this.auto) { if (this.gear > -1) this.shift(this.gear - 1); }
      else if (this.dir === 'D' && this.gear > 1) this.shift(this.gear - 1);
    }

    // ------------------------------------------------------- driveline
    const driven = [];
    let fSum = 0, fN = 0, rSum = 0, rN = 0, Idl = 0;
    for (let i = 0; i < this.n; i++) {
      const w = wheels[i];
      if (!w.driven) continue;
      driven.push(i);
      Idl += w.inertiaEff || 1;
      if (w.axle === 'front') { fSum += w.omega; fN++; } else { rSum += w.omega; rN++; }
    }
    const wF = fN ? fSum / fN : 0;
    const wR = rN ? rSum / rN : 0;
    const split = fN && rN ? cfg.diffs.center.split : fN ? 1 : 0;
    const wOut = wF * split + wR * (1 - split);
    const ratio = this._ratio();

    // auto gearbox ------------------------------------------------------
    if (this.auto && this.dir === 'D' && this.shiftTimer <= 0 && this.sinceShift > 0.7 && gb.auto !== false) {
      const wheelRpm = Math.abs(wOut) * RAD2RPM;
      const g = this.gear;
      const cur = gb.ratios[g - 1] * gb.final * (this.lowRange && cfg.transferLow ? cfg.transferLow : 1);
      const rpmNow = wheelRpm * cur;
      const up = e.redline * (gb.upshift ?? 0.55) + e.redline * 0.36 * thr * thr;
      let dn = e.redline * (gb.downshift ?? 0.24) + e.redline * 0.2 * thr;
      if (thr > 0.85) dn = Math.max(dn, e.redline * 0.5);
      if (g < gb.ratios.length && rpmNow > up && speed > 1) this.shift(g + 1);
      else if (g > 1) {
        const lower = gb.ratios[g - 2] / gb.ratios[g - 1];
        if (rpmNow < dn && rpmNow * lower < e.redline * 0.88) this.shift(g - 1);
      }
    }

    // ----------------------------------------------------------- engine
    this.rpm = this.omegaE * RAD2RPM;
    const rpm = this.rpm;
    let thrEff = thr;
    // TCS: back off throttle if a driven wheel is spinning far faster than the ground
    this.tcsActive = false;
    if (this.tcs && thr > 0.05 && Math.abs(speed) < 80) {
      let worst = 0;
      for (const i of driven) {
        const w = wheels[i];
        const s = (w.omega * w.radius - w.vFwd) / Math.max(Math.abs(w.vFwd), 3);
        if (s > worst) worst = s;
      }
      if (worst > 0.22) { thrEff *= clamp(1 - (worst - 0.22) * 4, 0.1, 1); this.tcsActive = true; }
    }
    // idle governor
    const idleThr = clamp((e.idle - rpm) * 0.0035 + 0.07, 0, 0.6);
    thrEff = Math.max(thrEff, this.running ? idleThr : 0);
    if (rpm > e.redline) this.limiter = true;
    else if (rpm < e.redline - 220) this.limiter = false;
    let Teng;
    if (!this.running) Teng = -(e.brakeBase + e.brakePerKrpm * rpm * 0.001);
    else if (this.limiter) Teng = -(e.brakeBase + e.brakePerKrpm * rpm * 0.001);
    else {
      const shape = Math.pow(thrEff, e.throttleCurve ?? 1.15);
      Teng = this.curve(rpm) * shape - (1 - thrEff) * (e.brakeBase + e.brakePerKrpm * rpm * 0.001);
    }
    this.thrApplied = thrEff;
    this.load = thrEff;

    // ------------------------------------------------------------ clutch
    let engage = 0;
    if (this.gear !== 0 && this.shiftTimer <= 0 && this.dir !== 'N') {
      const cl = cfg.clutch;
      const eRpm = smooth(cl.start, cl.lock, Math.max(rpm, Math.abs(wOut * ratio) * RAD2RPM * 0.9));
      engage = Math.max(eRpm, cl.creep ?? 0.12);
      // manual clutch pedal / stop assist
      if (inp.clutch > 0) engage *= 1 - inp.clutch;
      // after a shift re-engage smoothly
      engage *= smooth(0, 0.18, this.sinceShift - this.shiftLen);
    }
    this.clutchEng = engage;
    let Tc = 0;
    if (engage > 0 && ratio !== 0 && driven.length) {
      const wIn = wOut * ratio;
      const dw = this.omegaE - wIn;
      const Ieq = 1 / (1 / e.inertia + (ratio * ratio) / Math.max(Idl, 0.05));
      const cC = (0.45 * Ieq) / dt;
      const cap = cfg.clutch.capacity * engage;
      Tc = clamp(cC * dw, -cap, cap);
      this.clutchSlip = dw;
    } else this.clutchSlip = 0;

    // engine integration (semi-implicit)
    this.omegaE += ((Teng - Tc) / e.inertia) * dt;
    if (this.omegaE < 0) this.omegaE = 0;
    if (!this.running && this.omegaE < 5) this.omegaE = 0;
    this.engineReaction = Tc;

    // ------------------------------------------------------ distribution
    const Tout = Tc * ratio;
    if (Tout === 0 && driven.length === 0) return T;
    const D = cfg.diffs;
    // centre diff (only if both axles driven)
    let Tf = Tout * split, Tr = Tout * (1 - split);
    if (fN && rN) {
      const c = D.center;
      const kd = (0.3 * (Idl / driven.length)) / dt;
      const cap = (c.preload || 0) + (c.lock || 0) * Math.abs(Tout);
      const bias = clamp(kd * (wF - wR), -cap, cap);
      Tf -= bias; Tr += bias;
    }
    this._axle(wheels, 'front', Tf, D.front, dt);
    this._axle(wheels, 'rear', Tr, D.rear, dt);
    return T;
  }

  _axle(wheels, axle, Tin, d, dt) {
    let L = -1, R = -1;
    for (let i = 0; i < this.n; i++) {
      const w = wheels[i];
      if (!w.driven || w.axle !== axle) continue;
      if (w.side < 0) L = i; else R = i;
    }
    const T = this.torque;
    if (L >= 0 && R >= 0) {
      const wl = wheels[L].omega, wr = wheels[R].omega;
      const cap = d ? (d.preload || 0) + (Tin > 0 ? d.power || 0 : d.coast || 0) * Math.abs(Tin) : 0;
      let dT = 0;
      if (d && d.type === 'locked') dT = clamp(((0.3 * wheels[L].inertiaEff) / dt) * (wl - wr), -1e5, 1e5);
      else if (cap > 0) dT = clamp(((0.3 * wheels[L].inertiaEff) / dt) * (wl - wr), -cap, cap);
      T[L] = Tin * 0.5 - dT;
      T[R] = Tin * 0.5 + dT;
    } else if (L >= 0) T[L] = Tin;
    else if (R >= 0) T[R] = Tin;
  }
}
