// Soft-body vehicle: a cloud of point masses (nodes) connected by spring/damper
// beams. Beams yield plastically (deform) and snap (break); wheels are rings of
// nodes with a node-level friction model against the ground; drivetrain torque
// is applied as forces on tyre nodes, so slip, traction loss and weight transfer
// all emerge from the simulation instead of being scripted.

import { Drivetrain } from './drivetrain.js';
import { SURFACE_PROPS, GroundSample } from './terrain.js';

export const BT = {
  NORMAL: 0, // spring + damper, both directions
  SUPPORT: 1, // spring acts only when stretched (a rope that can't be pushed)
  BOUNDED: 2, // suspension spring: damper rebound/bump asymmetry + hard stops
  BROKEN: 3,
};

export const NF = {
  COLLIDE: 1, // collides with world and other vehicles
  TIRE: 2, // tyre tread (friction model + wheel contact)
  SKIN_TRI: 4, // vertex of a collision triangle
};

const G = 9.81;
const AIR_RHO = 1.2;

const _gs = new GroundSample();

export class Vehicle {
  /** @param {object} bp blueprint produced by the builder */
  constructor(bp) {
    this.bp = bp;
    this.name = bp.name;
    this.id = Vehicle._nextId++;
    const N = (this.nc = bp.nodeCount);
    const B = (this.bc = bp.beamCount);

    this.pos0 = Float64Array.from(bp.pos);
    this.pos = Float64Array.from(bp.pos);
    this.vel = new Float64Array(3 * N);
    this.frc = new Float64Array(3 * N);
    this.mass = Float64Array.from(bp.mass);
    this.invMass = this.mass.map((m) => 1 / m);
    this.radius = Float64Array.from(bp.radius);
    this.nmu = Float64Array.from(bp.nmu);
    this.nflags = Uint8Array.from(bp.nflags);
    this.nfn = new Float64Array(N); // last normal force per node (for tyre load)
    this.nodeNames = bp.nodeNames;
    this.totalMass = this.mass.reduce((a, b) => a + b, 0);

    this.b1 = Int32Array.from(bp.b1);
    this.b2 = Int32Array.from(bp.b2);
    this.L0 = Float64Array.from(bp.L0);
    this.Lorig = Float64Array.from(bp.L0);
    this.Lbase = Float64Array.from(bp.L0);
    this.K = Float64Array.from(bp.K);
    this.C = Float64Array.from(bp.C);
    this.CReb = Float64Array.from(bp.CReb);
    this.btype = Uint8Array.from(bp.btype);
    this.btype0 = Uint8Array.from(bp.btype);
    this.defF = Float64Array.from(bp.defF);
    this.defF0 = Float64Array.from(bp.defF);
    this.brkF = Float64Array.from(bp.brkF);
    this.lo = Float64Array.from(bp.lo);
    this.hi = Float64Array.from(bp.hi);
    this.kStop = Float64Array.from(bp.kStop);
    this.bgroup = Int32Array.from(bp.bgroup);
    this.bforce = new Float32Array(B); // last spring force, for debug view / audio
    this.cMax = new Float64Array(B);
    this.mred = new Float64Array(B);
    for (let i = 0; i < B; i++) {
      const ma = this.mass[this.b1[i]];
      const mb = this.mass[this.b2[i]];
      this.mred[i] = (ma * mb) / (ma + mb);
    }
    this._dt = 0;

    this.skinTris = Int32Array.from(bp.skinTris);
    this.tireTris = Int32Array.from(bp.tireTris);
    this.collisionTris = new Int32Array(this.skinTris.length + this.tireTris.length);
    this.collisionTris.set(this.skinTris, 0);
    this.collisionTris.set(this.tireTris, this.skinTris.length);
    this.collideNodes = [];
    for (let i = 0; i < N; i++) if (this.nflags[i] & NF.COLLIDE) this.collideNodes.push(i);
    this.collideNodes = Int32Array.from(this.collideNodes);
    this.dragNodes = Int32Array.from(bp.dragNodes);

    this.refs = bp.refs; // named node indices: front, back, left, right, ...
    this.cfg = bp.cfg;

    // wheels
    this.wheels = bp.wheels.map((w, idx) => {
      const wheel = { ...w, index: idx };
      wheel.omega = 0;
      wheel.angle = 0;
      wheel.axis = [0, 0, 0];
      wheel.center = [0, 0, 0];
      wheel.vFwd = 0;
      wheel.slip = 0;
      wheel.absFactor = 1;
      wheel.load = 0;
      wheel.torque = 0;
      wheel.treadAll = Int32Array.from([...w.treadIn, ...w.treadOut]);
      wheel.brakeTorqueNow = 0;
      return wheel;
    });
    this.steerBeams = bp.steerBeams;
    this.steerTables = bp.steerTables;
    this.springBeams = Int32Array.from(bp.springBeams);
    this.arbs = bp.arbs || [];

    this.drive = new Drivetrain(bp.drive, this.wheels);

    // runtime state
    this.input = {
      throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0,
      shiftUp: false, shiftDown: false,
      lights: false, horn: false, signal: 0,
    };
    this.steerAngle = 0; // normalised -1..1 actually applied (right positive)
    this.frame = {
      f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0],
      com: [0, 0, 0], vcom: [0, 0, 0],
      speed: 0, // signed speed along forward axis (m/s)
      gforce: [0, 0, 0],
    };
    this.aabb = new Float64Array(6);
    this.maxSpeedSq = 0;
    this.asleep = false;
    this.sleepTimer = 0;
    this.damage = { deformed: 0, broken: 0, energy: 0, fraction: 0, impact: 0 };
    this.impactAccum = 0; // consumed by audio each frame
    this.surfaceUnderWheel = SURFACE_PROPS[0];
    this.broken = new Set(); // beam indices that broke (renderer hides skin)
    this.dirtyBroken = false;
    this.slipEnergy = 0;
    this.drag = 0;
    this.alive = true;
    this.yawLast = 0;
    this._prevVel = null;
    this.setDt(1 / 2000);
    this.updateFrame();
    this.comRest = this.frame.com.slice();
  }

  setDt(dt) {
    this._dt = dt;
    for (let i = 0; i < this.bc; i++) this.cMax[i] = (0.6 * this.mred[i]) / dt;
    this.contactW = 0.4 / dt;
    if (this.contactDamp === undefined) { this.contactDamp = 1.4; this.tireContactDamp = 0.2; }
  }

  // ----------------------------------------------------------- lifecycle
  reset() {
    this.pos.set(this.pos0);
    this.vel.fill(0);
    this.frc.fill(0);
    this.L0.set(this.Lorig);
    this.Lbase.set(this.Lorig);
    this.btype.set(this.btype0);
    this.defF.set(this.defF0);
    this.bforce.fill(0);
    this.broken.clear();
    this.damage = { deformed: 0, broken: 0, energy: 0, fraction: 0, impact: 0 };
    this.steerAngle = 0;
    this.asleep = false;
    this.sleepTimer = 0;
    this.drive.reset();
    for (const w of this.wheels) { w.omega = 0; w.absFactor = 1; }
    this.updateFrame();
  }

  /** Bake current L0 as the new "undeformed" state (used after preload settling). */
  rebase() {
    this.Lorig.set(this.L0);
    this.Lbase.set(this.L0);
  }

  /**
   * Move the (reset) vehicle so that its origin sits at world (x, y, z) with yaw
   * (radians, 0 = facing -Z). Wheels are dropped onto the surface at `ground`.
   */
  place(x, z, yaw, world, lift = 0.03) {
    this.reset();
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let minY = Infinity;
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i;
      const lx = this.pos0[o], ly = this.pos0[o + 1], lz = this.pos0[o + 2];
      // rotation about +Y by yaw
      this.pos[o] = x + c * lx + s * lz;
      this.pos[o + 1] = ly;
      this.pos[o + 2] = z - s * lx + c * lz;
      if ((this.nflags[i] & NF.TIRE) || (this.nflags[i] & NF.COLLIDE)) {
        const gh = world ? world.heightAt(this.pos[o], this.pos[o + 2]) : 0;
        const d = ly - gh;
        if (d < minY) minY = d;
      }
    }
    // lift so lowest point is `lift` above ground
    const dy = -minY + lift;
    for (let i = 0; i < this.nc; i++) this.pos[3 * i + 1] += dy;
    this.updateFrame();
  }

  /** Put the (possibly damaged) vehicle upright again, keeping its heading and shape. */
  recover(world, lift = 0.6) {
    this.updateFrame();
    const fr = this.frame;
    // target basis: forward projected onto the ground plane, up = +Y
    let fx = fr.f[0], fz = fr.f[2];
    const l = Math.hypot(fx, fz);
    if (l < 0.2) { fx = fr.u[0]; fz = fr.u[2]; }
    const il = 1 / (Math.hypot(fx, fz) || 1); fx *= il; fz *= il;
    const tf = [fx, 0, fz], tu = [0, 1, 0];
    // right = up x (-forward): f=(0,0,-1), u=(0,1,0) -> (1,0,0)
    const nf = [-tf[0], -tf[1], -tf[2]];
    const R = [tu[1] * nf[2] - tu[2] * nf[1], tu[2] * nf[0] - tu[0] * nf[2], tu[0] * nf[1] - tu[1] * nf[0]];
    const B0 = [fr.r, fr.u, fr.f];     // current basis rows
    const B1 = [R, tu, tf];             // target basis rows
    // rotation M = sum_k B1[k] (x) B0[k]
    const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 * i + j] += B1[k][i] * B0[k][j];
    const c = fr.com;
    let minY = Infinity;
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i;
      const dx = this.pos[o] - c[0], dy = this.pos[o + 1] - c[1], dz = this.pos[o + 2] - c[2];
      this.pos[o] = c[0] + M[0] * dx + M[1] * dy + M[2] * dz;
      this.pos[o + 1] = c[1] + M[3] * dx + M[4] * dy + M[5] * dz;
      this.pos[o + 2] = c[2] + M[6] * dx + M[7] * dy + M[8] * dz;
      this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0;
    }
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i;
      const gh = world ? world.heightAt(this.pos[o], this.pos[o + 2]) : 0;
      minY = Math.min(minY, this.pos[o + 1] - gh);
    }
    const dy = lift - minY;
    for (let i = 0; i < this.nc; i++) this.pos[3 * i + 1] += dy;
    for (const w of this.wheels) w.omega = 0;
    this.drive.omegaE = Math.max(this.drive.omegaE * 0.5, 0);
    this.wake();
    this.updateFrame();
  }

  // -------------------------------------------------------------- frame
  updateFrame() {
    const p = this.pos, v = this.vel, R = this.refs, fr = this.frame;
    const fa = 3 * R.front, ba = 3 * R.back, la = 3 * R.left, ra = 3 * R.right;
    let fx = p[fa] - p[ba], fy = p[fa + 1] - p[ba + 1], fz = p[fa + 2] - p[ba + 2];
    let il = 1 / Math.hypot(fx, fy, fz);
    fx *= il; fy *= il; fz *= il;
    let rx = p[ra] - p[la], ry = p[ra + 1] - p[la + 1], rz = p[ra + 2] - p[la + 2];
    // make right perpendicular to forward
    const d = rx * fx + ry * fy + rz * fz;
    rx -= d * fx; ry -= d * fy; rz -= d * fz;
    il = 1 / Math.hypot(rx, ry, rz);
    rx *= il; ry *= il; rz *= il;
    // up = r x f
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    fr.f[0] = fx; fr.f[1] = fy; fr.f[2] = fz;
    fr.r[0] = rx; fr.r[1] = ry; fr.r[2] = rz;
    fr.u[0] = ux; fr.u[1] = uy; fr.u[2] = uz;
    // centre of mass & velocity
    let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
    const m = this.mass;
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i, mi = m[i];
      cx += p[o] * mi; cy += p[o + 1] * mi; cz += p[o + 2] * mi;
      vx += v[o] * mi; vy += v[o + 1] * mi; vz += v[o + 2] * mi;
    }
    const it = 1 / this.totalMass;
    fr.com[0] = cx * it; fr.com[1] = cy * it; fr.com[2] = cz * it;
    fr.vcom[0] = vx * it; fr.vcom[1] = vy * it; fr.vcom[2] = vz * it;
    fr.speed = fr.vcom[0] * fx + fr.vcom[1] * fy + fr.vcom[2] * fz;
  }

  computeAabb() {
    const p = this.pos, a = this.aabb;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i;
      const x = p[o], y = p[o + 1], z = p[o + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    a[0] = x0; a[1] = y0; a[2] = z0; a[3] = x1; a[4] = y1; a[5] = z1;
  }

  // -------------------------------------------------------------- wheels
  updateWheels() {
    const p = this.pos, v = this.vel, fr = this.frame;
    const fwd = fr.f;
    for (const w of this.wheels) {
      const hi = 3 * w.hubIn, ho = 3 * w.hubOut;
      const cx = 0.5 * (p[hi] + p[ho]), cy = 0.5 * (p[hi + 1] + p[ho + 1]), cz = 0.5 * (p[hi + 2] + p[ho + 2]);
      const hvx = 0.5 * (v[hi] + v[ho]), hvy = 0.5 * (v[hi + 1] + v[ho + 1]), hvz = 0.5 * (v[hi + 2] + v[ho + 2]);
      // axis points towards the vehicle's left; positive rotation about it = rolling forward
      let ax, ay, az;
      if (w.side > 0) { ax = p[hi] - p[ho]; ay = p[hi + 1] - p[ho + 1]; az = p[hi + 2] - p[ho + 2]; }
      else { ax = p[ho] - p[hi]; ay = p[ho + 1] - p[hi + 1]; az = p[ho + 2] - p[hi + 2]; }
      const il = 1 / Math.hypot(ax, ay, az);
      ax *= il; ay *= il; az *= il;
      let num = 0, den = 0, fn = 0;
      const t = w.treadAll;
      for (let k = 0; k < t.length; k++) {
        const n = t[k], o = 3 * n;
        let rx = p[o] - cx, ry = p[o + 1] - cy, rz = p[o + 2] - cz;
        const dd = rx * ax + ry * ay + rz * az;
        rx -= dd * ax; ry -= dd * ay; rz -= dd * az;
        const rr = rx * rx + ry * ry + rz * rz;
        const ux = v[o] - hvx, uy = v[o + 1] - hvy, uz = v[o + 2] - hvz;
        // (r x u) . a
        const cxp = ry * uz - rz * uy, cyp = rz * ux - rx * uz, czp = rx * uy - ry * ux;
        num += cxp * ax + cyp * ay + czp * az;
        den += rr;
        fn += this.nfn[n];
      }
      w.omega = num / den;
      w.axis[0] = ax; w.axis[1] = ay; w.axis[2] = az;
      w.center[0] = cx; w.center[1] = cy; w.center[2] = cz;
      w.vFwd = hvx * fwd[0] + hvy * fwd[1] + hvz * fwd[2];
      w.load = fn;
      w.inertiaEff = den / t.length * w.treadMass; // sum m*r^2 (uniform mass assumed)
    }
  }

  /** Tangential force ring that applies torque T (about the wheel axis) to the tyre. */
  _applyWheelTorque(w, T) {
    if (T === 0) return;
    const p = this.pos, f = this.frc;
    const t = w.treadAll;
    const [ax, ay, az] = w.axis;
    const [cx, cy, cz] = w.center;
    const per = T / t.length;
    for (let k = 0; k < t.length; k++) {
      const o = 3 * t[k];
      let rx = p[o] - cx, ry = p[o + 1] - cy, rz = p[o + 2] - cz;
      const d = rx * ax + ry * ay + rz * az;
      rx -= d * ax; ry -= d * ay; rz -= d * az;
      const rl = Math.hypot(rx, ry, rz) || 1;
      // tangent = a x r / |r|
      const tx = (ay * rz - az * ry) / rl;
      const ty = (az * rx - ax * rz) / rl;
      const tz = (ax * ry - ay * rx) / rl;
      const fo = per / rl;
      f[o] += tx * fo; f[o + 1] += ty * fo; f[o + 2] += tz * fo;
    }
  }

  /** Apply torque vector (tx,ty,tz) as a force couple on two nodes. */
  _applyCouple(nA, nB, tx, ty, tz) {
    const p = this.pos, f = this.frc;
    const a = 3 * nA, b = 3 * nB;
    const lx = p[b] - p[a], ly = p[b + 1] - p[a + 1], lz = p[b + 2] - p[a + 2];
    const l2 = lx * lx + ly * ly + lz * lz;
    if (l2 < 1e-9) return;
    // F = (tau x l) / |l|^2 on B, -F on A
    const fx = (ty * lz - tz * ly) / l2;
    const fy = (tz * lx - tx * lz) / l2;
    const fz = (tx * ly - ty * lx) / l2;
    f[b] += fx; f[b + 1] += fy; f[b + 2] += fz;
    f[a] -= fx; f[a + 1] -= fy; f[a + 2] -= fz;
  }

  // ------------------------------------------------------------ steering
  _steerTargets() {
    // returns normalised steering (-1..1, right positive) after speed shaping
    return this.steerAngle;
  }

  _applySteering(dt) {
    const s = this.input.steer;
    // slew-limit the hydraulic steering so rapid inputs don't whip the tie rods
    const maxRate = 4.0; // full lock per second
    const d = s - this.steerAngle;
    const step = maxRate * dt;
    this.steerAngle += Math.abs(d) < step ? d : Math.sign(d) * step;
    const cfg = this.bp.steer;
    if (!cfg) return;
    const sa = this.steerAngle;
    const dc = sa * cfg.maxAngle; // virtual centre-wheel angle (rad), right positive
    let deltaL, deltaR; // angles of left/right wheel, right positive
    if (Math.abs(dc) < 1e-5) { deltaL = deltaR = 0; }
    else {
      const wb = cfg.wheelbase, hw = cfg.track * 0.5;
      const Rt = wb / Math.tan(Math.abs(dc));
      const inner = Math.atan(wb / (Rt - hw)) ;
      const outer = Math.atan(wb / (Rt + hw));
      const k = cfg.ackermann; // 0..1 blend between parallel and full Ackermann
      const iA = Math.abs(dc) + (inner - Math.abs(dc)) * k;
      const oA = Math.abs(dc) + (outer - Math.abs(dc)) * k;
      if (dc > 0) { deltaR = iA; deltaL = oA; } else { deltaL = -iA; deltaR = -oA; }
    }
    for (const sb of this.steerBeams) {
      const ang = sb.side > 0 ? deltaR : deltaL;
      const table = this.steerTables[sb.table];
      this.L0[sb.beam] = this.Lbase[sb.beam] + table.lookup(ang);
    }
  }

  // --------------------------------------------------------------- forces
  computeForces(dt, world, simTime = 0) {
    if (dt !== this._dt) this.setDt(dt);
    this.frc.fill(0);
    this.updateFrame();
    this._applySteering(dt);
    this._beams(dt);
    this.updateWheels();
    this._driveAndBrakes(dt);
    this._aero();
    this._arbs();
    this._gravity();
    this._contacts(dt, world);
  }

  _gravity() {
    const f = this.frc, m = this.mass;
    for (let i = 0; i < this.nc; i++) f[3 * i + 1] -= m[i] * G;
  }

  _beams(dt) {
    const pos = this.pos, vel = this.vel, frc = this.frc;
    const b1 = this.b1, b2 = this.b2, L0 = this.L0, K = this.K, C = this.C, CReb = this.CReb;
    const bt = this.btype, defF = this.defF, brkF = this.brkF, cMax = this.cMax;
    const lo = this.lo, hi = this.hi, kStop = this.kStop, bforce = this.bforce;
    let deformEnergy = 0;
    for (let i = 0; i < this.bc; i++) {
      const t = bt[i];
      if (t === BT.BROKEN) continue;
      const a = b1[i] * 3, b = b2[i] * 3;
      let dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-7) continue;
      const il = 1 / len;
      dx *= il; dy *= il; dz *= il;
      const vr = (vel[b] - vel[a]) * dx + (vel[b + 1] - vel[a + 1]) * dy + (vel[b + 2] - vel[a + 2]) * dz;
      const x = len - L0[i];
      let f;
      if (t === BT.NORMAL) {
        const fs = K[i] * x;
        let c = C[i];
        if (c > cMax[i]) c = cMax[i];
        f = fs + c * vr;
        if (fs > brkF[i]) { this._breakBeam(i); continue; }
        const afs = fs < 0 ? -fs : fs;
        if (afs > defF[i]) {
          // plastic yield: move rest length so that the spring sits at yield force
          const dL = (afs - defF[i]) / K[i];
          const L0n = fs > 0 ? L0[i] + dL : L0[i] - dL;
          const minL = 0.25 * this.Lorig[i];
          L0[i] = L0n < minL ? minL : L0n;
          this.Lbase[i] = L0[i];
          deformEnergy += (afs - defF[i]) * dL;
          if (!this._deformedFlag) this._deformedFlag = new Uint8Array(this.bc);
          if (!this._deformedFlag[i]) { this._deformedFlag[i] = 1; this.damage.deformed++; }
          // work-hardening as the beam crushes
          const comp = 1 - L0[i] / this.Lorig[i];
          if (comp > 0.15 || comp < -0.15) defF[i] = this.defF0[i] * (1 + 4 * (Math.abs(comp) - 0.15));
        }
        bforce[i] = fs;
      } else if (t === BT.SUPPORT) {
        if (x <= 0) { bforce[i] = 0; continue; }
        const fs = K[i] * x;
        let c = C[i];
        if (c > cMax[i]) c = cMax[i];
        f = fs + c * vr;
        if (f < 0) f = 0;
        if (fs > brkF[i]) { this._breakBeam(i); continue; }
        if (fs > defF[i]) {
          const dL = (fs - defF[i]) / K[i];
          L0[i] += dL;
          this.Lbase[i] = L0[i];
          deformEnergy += (fs - defF[i]) * dL;
          if (!this._deformedFlag) this._deformedFlag = new Uint8Array(this.bc);
          if (!this._deformedFlag[i]) { this._deformedFlag[i] = 1; this.damage.deformed++; }
        }
        bforce[i] = fs;
      } else {
        // BOUNDED suspension element
        const fs = K[i] * x;
        let c = vr < 0 ? C[i] : CReb[i]; // vr<0: closing (bump), vr>0: opening (rebound)
        if (c > cMax[i]) c = cMax[i];
        f = fs + c * vr;
        if (len < lo[i]) f += kStop[i] * (len - lo[i]);
        else if (len > hi[i]) f += kStop[i] * (len - hi[i]);
        bforce[i] = f;
        if ((f > brkF[i] || -f > brkF[i] * 2)) { this._breakBeam(i); continue; }
      }
      const fx = f * dx, fy = f * dy, fz = f * dz;
      frc[a] += fx; frc[a + 1] += fy; frc[a + 2] += fz;
      frc[b] -= fx; frc[b + 1] -= fy; frc[b + 2] -= fz;
    }
    if (deformEnergy > 0) {
      this.damage.energy += deformEnergy;
      this.impactAccum += deformEnergy;
    }
  }

  _breakBeam(i) {
    this.btype[i] = BT.BROKEN;
    this.bforce[i] = 0;
    this.broken.add(i);
    this.damage.broken++;
    this.dirtyBroken = true;
    this.impactAccum += 400;
    // beams in the same break-group snap together (bolted assemblies, doors...)
    const g = this.bgroup[i];
    if (g > 0) {
      for (let j = 0; j < this.bc; j++) {
        if (this.bgroup[j] === g && this.btype[j] !== BT.BROKEN) {
          this.btype[j] = BT.BROKEN;
          this.broken.add(j);
          this.damage.broken++;
        }
      }
    }
  }

  _aero() {
    const bp = this.bp.aero;
    if (!bp) return;
    const v = this.vel, f = this.frc, fr = this.frame;
    const nd = this.dragNodes.length;
    const cd = (0.5 * AIR_RHO * bp.cdA) / nd;
    for (let k = 0; k < nd; k++) {
      const o = 3 * this.dragNodes[k];
      const vx = v[o] - (this.wind ? this.wind[0] : 0), vy = v[o + 1], vz = v[o + 2] - (this.wind ? this.wind[2] : 0);
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      f[o] -= cd * sp * vx; f[o + 1] -= cd * sp * vy; f[o + 2] -= cd * sp * vz;
    }
    // downforce / lift at the axles along the car's up vector
    const sp2 = fr.vcom[0] * fr.vcom[0] + fr.vcom[2] * fr.vcom[2];
    if (bp.clA && sp2 > 1) {
      const F = 0.5 * AIR_RHO * bp.clA * sp2; // positive = downforce
      const ff = F * (bp.frontBias ?? 0.45);
      const fb = F - ff;
      const u = fr.u;
      const fa = 3 * this.refs.aeroFront, ba = 3 * this.refs.aeroRear;
      f[fa] -= u[0] * ff; f[fa + 1] -= u[1] * ff; f[fa + 2] -= u[2] * ff;
      f[ba] -= u[0] * fb; f[ba + 1] -= u[1] * fb; f[ba + 2] -= u[2] * fb;
    }
  }

  _arbs() {
    // anti-roll bars: couple the vertical (vehicle-up) travel of left/right wheels
    if (!this.arbs.length) return;
    const p = this.pos, f = this.frc, u = this.frame.u;
    for (const a of this.arbs) {
      const l = 3 * a.left, r = 3 * a.right, c1 = 3 * a.refL, c2 = 3 * a.refR;
      // height of each lower-arm node above its chassis mount along "up"
      const hl = (p[l] - p[c1]) * u[0] + (p[l + 1] - p[c1 + 1]) * u[1] + (p[l + 2] - p[c1 + 2]) * u[2];
      const hr = (p[r] - p[c2]) * u[0] + (p[r + 1] - p[c2 + 1]) * u[1] + (p[r + 2] - p[c2 + 2]) * u[2];
      const dh = hl - a.h0L - (hr - a.h0R); // difference of wheel travels
      const F = a.k * dh;
      // pull the higher side down, the lower side up (on the unsprung nodes), reaction on chassis
      f[l] -= u[0] * F; f[l + 1] -= u[1] * F; f[l + 2] -= u[2] * F;
      f[r] += u[0] * F; f[r + 1] += u[1] * F; f[r + 2] += u[2] * F;
      f[c1] += u[0] * F; f[c1 + 1] += u[1] * F; f[c1 + 2] += u[2] * F;
      f[c2] -= u[0] * F; f[c2 + 1] -= u[1] * F; f[c2 + 2] -= u[2] * F;
    }
  }

  // --------------------------------------------- drivetrain, brakes, steering
  _driveAndBrakes(dt) {
    const inp = this.input;
    const d = this.drive;
    const tq = d.update(dt, inp, this.wheels, this.frame.speed);
    const R = this.refs;
    for (let wi = 0; wi < this.wheels.length; wi++) {
      const w = this.wheels[wi];
      const Tdrive = tq[wi];
      // brakes -------------------------------------------------------
      let Tb = 0;
      const brakeIn = d.effBrake;
      if (brakeIn > 0 || (inp.handbrake > 0 && w.handbrake)) {
        let demand = brakeIn * w.brakeTorque;
        if (d.abs && brakeIn > 0 && !(inp.handbrake > 0 && w.handbrake)) {
          const vref = Math.max(Math.abs(this.frame.speed), 0.5);
          const slip = (Math.abs(w.omega) * w.radius - Math.abs(w.vFwd)) / vref;
          if (Math.abs(this.frame.speed) > 2.5 && slip < -0.24 && w.omega * this.frame.speed > 0) w.absFactor = Math.max(0, w.absFactor - 30 * dt);
          else w.absFactor = Math.min(1, w.absFactor + 18 * dt);
          demand *= w.absFactor;
        } else w.absFactor = 1;
        if (inp.handbrake > 0 && w.handbrake) demand = Math.max(demand, inp.handbrake * w.handbrakeTorque);
        Tb = demand;
      }
      // rolling resistance
      const surf = this.surfaceUnderWheel;
      const Trr = w.rollRes * w.load * w.radius * surf.rr;
      let Tres = Tb + Trr;
      // never reverse the wheel inside one step
      const lim = (w.inertiaEff * Math.abs(w.omega)) / dt;
      let Tbrake = 0;
      if (Tres > 0) {
        Tbrake = Math.min(Tres, lim * 0.95);
        if (w.omega > 0) Tbrake = -Tbrake; // opposing positive rotation
      }
      w.brakeTorqueNow = Tbrake;
      w.torque = Tdrive;
      // apply to tyre ------------------------------------------------
      this._applyWheelTorque(w, Tdrive + Tbrake);
      // reactions
      const ax = w.axis[0], ay = w.axis[1], az = w.axis[2];
      if (Tbrake !== 0) {
        // brake reaction goes into the knuckle: couple on (hub centre, tie node)
        const T = -Tbrake;
        this._applyCouple(w.hubOut, w.tie, T * ax, T * ay, T * az);
      }
      if (Tdrive !== 0 && w.reactNodes) {
        const T = -Tdrive;
        this._applyCouple(w.reactNodes[0], w.reactNodes[1], T * ax, T * ay, T * az);
      }
    }
    // engine reaction (roll of the powertrain on its mounts)
    if (R.engineA >= 0 && d.engineReaction !== 0) {
      const fr = this.frame;
      const axis = this.bp.drive.transverse ? fr.r : fr.f;
      const T = d.engineReaction * (this.bp.drive.transverse ? -1 : 1);
      this._applyCouple(R.engineA, R.engineB, axis[0] * T, axis[1] * T, axis[2] * T);
    }
  }

  // ----------------------------------------------------------- contacts
  _contacts(dt, world) {
    if (!world) return;
    const pos = this.pos;
    const list = this.collideNodes;
    const nfn = this.nfn;
    nfn.fill(0);
    const s = _gs;
    let surfAcc = null;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const o = 3 * i;
      const x = pos[o], y = pos[o + 1], z = pos[o + 2];
      const r = this.radius[i];
      world.sample(x, z, s);
      const pen = s.h - (y - r * s.ny);
      let mu = this.nmu[i];
      if (pen > 0) {
        const sp = SURFACE_PROPS[s.s];
        if (this.nflags[i] & NF.TIRE) { mu *= sp.grip; surfAcc = sp; }
        else mu *= 0.5 + 0.5 * sp.grip;
        this._contact(i, s.nx, s.ny, s.nz, pen, mu, dt, this.nflags[i] & NF.TIRE);
      }
      // static boxes
      const bl = world.boxesAt ? world.boxesAt(x, z) : undefined;
      if (bl) {
        for (let q = 0; q < bl.length; q++) {
          const bx = world.boxes[bl[q]];
          if (x < bx.minX - r || x > bx.maxX + r || z < bx.minZ - r || z > bx.maxZ + r || y < bx.minY - r || y > bx.maxY + r) continue;
          this._boxContact(i, bx, x, y, z, r, dt);
        }
      }
    }
    if (surfAcc) this.surfaceUnderWheel = surfAcc;
  }

  _boxContact(i, bx, x, y, z, r, dt) {
    const m = bx.m;
    const dx = x - bx.x, dy = y - bx.y, dz = z - bx.z;
    // local = R^T d
    const lx = m[0] * dx + m[3] * dy + m[6] * dz;
    const ly = m[1] * dx + m[4] * dy + m[7] * dz;
    const lz = m[2] * dx + m[5] * dy + m[8] * dz;
    const px = bx.hx + r - Math.abs(lx);
    if (px <= 0) return;
    const py = bx.hy + r - Math.abs(ly);
    if (py <= 0) return;
    const pz = bx.hz + r - Math.abs(lz);
    if (pz <= 0) return;
    // choose the axis of least penetration, biased to push out of the top face
    let ax = 0, pen = px;
    const pyb = ly > 0 ? py * 0.7 : py;
    if (pyb < pen) { ax = 1; pen = pyb; }
    if (pz < pen) { ax = 2; pen = pz; }
    let nx, ny, nz;
    if (ax === 0) { const sg = lx > 0 ? 1 : -1; nx = m[0] * sg; ny = m[3] * sg; nz = m[6] * sg; pen = px; }
    else if (ax === 1) { const sg = ly > 0 ? 1 : -1; nx = m[1] * sg; ny = m[4] * sg; nz = m[7] * sg; pen = py; }
    else { const sg = lz > 0 ? 1 : -1; nx = m[2] * sg; ny = m[5] * sg; nz = m[8] * sg; pen = pz; }
    const sp = SURFACE_PROPS[bx.surface];
    const tire = this.nflags[i] & NF.TIRE;
    const mu = this.nmu[i] * (tire ? sp.grip : 0.5 + 0.5 * sp.grip);
    this._contact(i, nx, ny, nz, pen, mu, dt, tire);
  }

  _contact(i, nx, ny, nz, pen, mu, dt, isTire) {
    const vel = this.vel, frc = this.frc, o = 3 * i, m = this.mass[i];
    const vx = vel[o], vy = vel[o + 1], vz = vel[o + 2];
    const vn = vx * nx + vy * ny + vz * nz;
    const wc = this.contactW;
    let fn = m * wc * wc * pen - (isTire ? this.tireContactDamp : this.contactDamp) * m * wc * vn;
    if (fn <= 0) return;
    this.nfn[i] += fn;
    frc[o] += fn * nx; frc[o + 1] += fn * ny; frc[o + 2] += fn * nz;
    if (mu <= 0) return;
    // tangential: stop the node (static friction) up to the Coulomb limit
    const fx = frc[o], fy = frc[o + 1], fz = frc[o + 2];
    const fnn = fx * nx + fy * ny + fz * nz;
    const ftx = fx - fnn * nx, fty = fy - fnn * ny, ftz = fz - fnn * nz;
    const vtx = vx - vn * nx, vty = vy - vn * ny, vtz = vz - vn * nz;
    const idt = 1 / dt;
    const sx = -(m * vtx * idt + ftx), sy = -(m * vty * idt + fty), sz = -(m * vtz * idt + ftz);
    const sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (sl < 1e-9) return;
    const vts = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz);
    // Stribeck-style curve: static > kinetic
    const kin = isTire ? 0.88 : 0.72;
    const sm = vts / (vts + 1.2);
    const lim = mu * fn * (1 - (1 - kin) * sm);
    const sc = sl <= lim ? 1 : lim / sl;
    frc[o] += sx * sc; frc[o + 1] += sy * sc; frc[o + 2] += sz * sc;
    if (isTire && sl > lim) this.slipEnergy += lim * vts * dt;
  }

  // ---------------------------------------------------------- integrate
  integrate(dt) {
    const pos = this.pos, vel = this.vel, frc = this.frc, im = this.invMass;
    let maxV = 0;
    if (this.drag > 0) { const d = 1 - this.drag * dt; for (let i = 0; i < 3 * this.nc; i++) vel[i] *= d; }
    for (let i = 0; i < this.nc; i++) {
      const o = 3 * i, k = im[i] * dt;
      const vx = (vel[o] += frc[o] * k);
      const vy = (vel[o + 1] += frc[o + 1] * k);
      const vz = (vel[o + 2] += frc[o + 2] * k);
      pos[o] += vx * dt; pos[o + 1] += vy * dt; pos[o + 2] += vz * dt;
      const s = vx * vx + vy * vy + vz * vz;
      if (s > maxV) maxV = s;
    }
    this.maxSpeedSq = maxV;
    for (const w of this.wheels) w.angle += w.omega * dt;
  }

  /** Tick that runs once per rendered frame (not per physics step). */
  frameUpdate(dtFrame) {
    this.updateFrame();
    this.computeAabb();
    // normalised damage 0..1
    const dm = this.damage;
    dm.fraction = Math.min(1, (dm.deformed / Math.max(1, this.bc)) * 3 + (dm.broken / Math.max(1, this.bc)) * 10);
    if (!Number.isFinite(this.pos[0]) || !Number.isFinite(this.vel[0]) || this.maxSpeedSq > 1e5) {
      // numerical blow-up: recover instead of freezing the sim
      this.alive = false;
    }
  }

  wake() {
    this.asleep = false;
    this.sleepTimer = 0;
  }

  /** Pose of a node as [x,y,z]. */
  nodePos(i, out = [0, 0, 0]) {
    const o = 3 * i;
    out[0] = this.pos[o]; out[1] = this.pos[o + 1]; out[2] = this.pos[o + 2];
    return out;
  }
}
Vehicle._nextId = 1;
