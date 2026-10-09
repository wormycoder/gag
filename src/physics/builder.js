// Procedural vehicle builder. Cars are described with a handful of physical
// parameters (body sections, axle positions, spring rates...) and this module
// turns them into a node/beam blueprint: a triangulated monocoque shell, engine
// and driver mass nodes on mounts, wheels as rings of tyre nodes and fully
// articulated suspension (double wishbone, solid axle) with working steering.
//
// Coordinates used by car definitions: x = right (+), y = up, f = forward (+).
// They are stored in world convention: x right, y up, z = -f (forward is -Z).

import { BT, NF } from './vehicle.js';

export class SteerTable {
  constructor(min, max, values) {
    this.min = min; this.max = max; this.values = values;
    this.step = (max - min) / (values.length - 1);
  }
  lookup(a) {
    let t = (a - this.min) / this.step;
    if (t <= 0) return this.values[0];
    const n = this.values.length - 1;
    if (t >= n) return this.values[n];
    const i = t | 0; t -= i;
    return this.values[i] * (1 - t) + this.values[i + 1] * t;
  }
}

const sqrt = Math.sqrt;

export class Builder {
  constructor(name, cfg = {}) {
    this.name = name;
    this.cfg = cfg;
    this.pos = [];
    this.mass = [];
    this.radius = [];
    this.nmu = [];
    this.nflags = [];
    this.names = [];
    this.nameMap = new Map();
    this.beams = [];
    this.skinTris = [];
    this.tireTris = [];
    this.wheels = [];
    this.steerBeams = [];
    this.steerTables = [];
    this.springBeams = [];
    this.arbs = [];
    this.dragNodes = [];
    this.bodyNodes = []; // indices of structural body nodes (for mounting)
    this.refs = {};
    this.groupId = 1;
    this.parts = {}; // named bookkeeping for the renderer
  }

  // --------------------------------------------------------------- nodes
  /** @param f forward coordinate */
  node(name, x, y, f, mass, o = {}) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, -f);
    this.mass.push(mass);
    this.radius.push(o.r ?? 0);
    this.nmu.push(o.mu ?? 0.6);
    this.nflags.push(o.flags ?? 0);
    this.names.push(name);
    if (name) this.nameMap.set(name, i);
    return i;
  }

  P(i) { return [this.pos[3 * i], this.pos[3 * i + 1], this.pos[3 * i + 2]]; }
  dist(a, b) {
    const p = this.pos;
    return Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]);
  }

  // --------------------------------------------------------------- beams
  /**
   * @param {number} a
   * @param {number} b
   * @param {object} o {k, zeta, c, type, def, brk, lo, hi, kStop, cReb, group, spring}
   */
  beam(a, b, o = {}) {
    if (a === b) return -1;
    const L = this.dist(a, b);
    const k = o.k ?? 5e5;
    const idx = this.beams.length;
    this.beams.push({
      a, b, L0: o.L0 ?? L, Ld: L, k,
      zeta: o.zeta ?? 0.12,
      c: o.c ?? null,
      cReb: o.cReb ?? null,
      type: o.type ?? BT.NORMAL,
      def: o.def ?? 1e9,
      brk: o.brk ?? 1e9,
      lo: o.lo ?? 0, hi: o.hi ?? 1e9, kStop: o.kStop ?? 0,
      group: o.group ?? 0,
    });
    if (o.spring) this.springBeams.push(idx);
    return idx;
  }

  tri(a, b, c, tire = false) { (tire ? this.tireTris : this.skinTris).push(a, b, c); }

  // ---------------------------------------------------------------- body
  /**
   * Builds the monocoque shell from cross-sections.
   * Section fields: f, zb, wb, zr, ws, zs, wg, zg, wr, zt, crown
   */
  addBody(spec) {
    const S = spec.sections;
    const nS = S.length;
    const K = 12;
    const bk = spec.bodyK ?? 6e5;
    const bd = spec.bodyDef ?? 20000;
    const crushAt = (f) => {
      const c = spec.crush || [[-99, 1], [99, 1]];
      if (f <= c[0][0]) return c[0][1];
      for (let i = 1; i < c.length; i++) if (f <= c[i][0]) {
        const t = (f - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
        return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
      }
      return c[c.length - 1][1];
    };
    const ring = []; // ring[s][j] node index
    const centers = [];
    // total weights for mass distribution
    const jw = [1.5, 1.3, 1.0, 0.9, 0.7, 0.55, 0.5, 0.55, 0.7, 0.9, 1.0, 1.3];
    let wsum = 0;
    const secW = S.map((s, i) => {
      const prev = i > 0 ? S[i - 1].f : s.f, next = i < nS - 1 ? S[i + 1].f : s.f;
      return Math.abs(next - prev) * 0.5 + 0.15;
    });
    for (let i = 0; i < nS; i++) { for (let j = 0; j < K; j++) wsum += secW[i] * jw[j]; wsum += secW[i] * 1.5; }
    const M = spec.bodyMass;
    for (let i = 0; i < nS; i++) {
      const s = S[i];
      const pts = [
        [0, s.zb], [s.wb, s.zb], [s.ws, s.zr], [s.ws, s.zs], [s.wg, s.zg], [s.wr, s.zt - 0.03], [0, s.zt + (s.crown || 0)],
      ];
      const R = [];
      const order = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
      for (let j = 0; j < K; j++) {
        const oi = order[j];
        let px, py;
        if (oi >= 0) { px = pts[oi][0]; py = pts[oi][1]; }
        else { px = -pts[-oi][0]; py = pts[-oi][1]; }
        const idx = this.node(`b${i}_${j}`, px, py, s.f, (M * secW[i] * jw[j]) / wsum, {
          r: 0.035, mu: 0.55, flags: NF.COLLIDE | NF.SKIN_TRI,
        });
        R.push(idx);
        this.bodyNodes.push(idx);
        this.dragNodes.push(idx);
      }
      ring.push(R);
      const zc = 0.5 * (s.zb + s.zt);
      const c = this.node(`c${i}`, 0, zc, s.f, (M * secW[i] * 1.5) / wsum, { r: 0, flags: 0 });
      centers.push(c);
      this.bodyNodes.push(c);
    }
    // beams ----------------------------------------------------------
    const rail = new Set([0, 1, 11]);
    const bb = (a, b, f, mult = 1, extra = {}) => {
      const cf = crushAt(f);
      return this.beam(a, b, {
        k: bk * (extra.kmul ?? 1), zeta: 0.1,
        def: bd * cf * mult, brk: bd * cf * mult * 5, ...extra,
      });
    };
    for (let i = 0; i < nS; i++) {
      const R = ring[i], c = centers[i], f = S[i].f;
      for (let j = 0; j < K; j++) {
        const m = rail.has(j) ? 1.5 : 1;
        bb(R[j], R[(j + 1) % K], f, m);
        bb(c, R[j], f, 1.1);
      }
      // cross-ring bracing (stiffer cabin): j <-> opposite
      for (const [a, b] of [[1, 11], [3, 9], [5, 7], [2, 10], [4, 8]]) bb(R[a], R[b], f, 1.2);
    }
    for (let i = 0; i < nS - 1; i++) {
      const A = ring[i], B = ring[i + 1], f = 0.5 * (S[i].f + S[i + 1].f);
      for (let j = 0; j < K; j++) {
        const jn = (j + 1) % K;
        const m = rail.has(j) ? 1.6 : 1;
        bb(A[j], B[j], f, m);
        bb(A[j], B[jn], f, 0.9);
        bb(A[jn], B[j], f, 0.9);
        bb(centers[i], B[j], f, 0.9);
        bb(centers[i + 1], A[j], f, 0.9);
      }
      bb(centers[i], centers[i + 1], f, 1.2);
    }
    // skin triangles (outward winding: viewed from outside CCW)
    // Ring goes bottom -> right side -> top -> left side; forward is -z.
    for (let i = 0; i < nS - 1; i++) {
      const A = ring[i], B = ring[i + 1];
      for (let j = 0; j < K; j++) {
        const jn = (j + 1) % K;
        // A is rearward of B (sections ordered rear -> front)
        this.tri(A[j], A[jn], B[jn]);
        this.tri(A[j], B[jn], B[j]);
      }
    }
    for (let j = 0; j < K; j++) {
      const jn = (j + 1) % K;
      this.tri(centers[0], ring[0][jn], ring[0][j]); // rear cap
      this.tri(centers[nS - 1], ring[nS - 1][j], ring[nS - 1][jn]); // front cap
    }
    this.body = { ring, centers, K, nS, S };
    return this.body;
  }

  /**
   * Nearest body nodes to a point. Half are the closest overall, the rest are the
   * closest ones clearly above/below so the mount is triangulated in 3D (beams that
   * are all nearly horizontal give almost no vertical stiffness).
   */
  nearestBody(x, y, f, n, spread = true) {
    const z = -f;
    const all = [];
    for (const i of this.bodyNodes) {
      const dx = this.pos[3 * i] - x, dy = this.pos[3 * i + 1] - y, dz = this.pos[3 * i + 2] - z;
      all.push([dx * dx + dy * dy + dz * dz, i, dy]);
    }
    all.sort((a, b) => a[0] - b[0]);
    const out = new Set(all.slice(0, Math.max(2, Math.ceil(n / 2))).map((o) => o[1]));
    if (spread) {
      const q = Math.max(1, Math.floor(n / 4));
      let c = 0;
      for (const o of all) if (o[2] < -0.22 && !out.has(o[1])) { out.add(o[1]); if (++c >= q) break; }
      c = 0;
      for (const o of all) if (o[2] > 0.12 && !out.has(o[1])) { out.add(o[1]); if (++c >= q) break; }
      // and a couple lateral to the opposite side of the section for stiffness
      c = 0;
      for (const o of all) {
        if (out.has(o[1])) continue;
        const px = this.pos[3 * o[1]];
        if (Math.abs(px - x) > 0.3 && Math.sign(px - x) === -Math.sign(x || 1)) { out.add(o[1]); if (++c >= 2) break; }
      }
    }
    return [...out];
  }

  /**
   * Add a node rigidly attached to the nearest `n` body nodes.
   */
  mount(name, x, y, f, mass, n = 6, o = {}) {
    const i = this.node(name, x, y, f, mass, { r: 0, flags: 0 });
    const near = this.nearestBody(x, y, f, n);
    for (const b of near) this.beam(i, b, { k: o.k ?? 8e5, zeta: 0.12, def: o.def ?? 90000, brk: o.brk ?? 220000, group: o.group });
    return i;
  }

  /** Mass node (engine, tank...) hung on soft mounts. */
  massNode(name, x, y, f, mass, o = {}) {
    const i = this.node(name, x, y, f, mass, { r: 0, flags: 0 });
    const near = this.nearestBody(x, y, f, o.n ?? 8);
    for (const b of near) {
      this.beam(i, b, {
        k: o.k ?? 1.2e5, zeta: o.zeta ?? 0.25, def: o.def ?? 60000, brk: o.brk ?? 140000,
      });
    }
    return i;
  }

  // -------------------------------------------------------------- wheels
  /**
   * Adds a tyre/wheel assembly. Returns wheel record (also pushed to wheels).
   * s: {name, side:+1/-1, axle:'front'|'rear', x (centre plane), f, R, width, hubHalf,
   *     tireMass, hubMass, nTread, kSpoke, kCross, kRing, grip}
   */
  addWheel(s) {
    const N = s.nTread ?? 20;
    const R = s.R;
    const hw = s.hubHalf ?? 0.075;
    const w2 = s.width * 0.5 * 0.9;
    const side = s.side;
    const xo = s.x + side * hw;
    const xi = s.x - side * hw;
    const hubM = s.hubMass ?? 7;
    const hubOut = this.node(`${s.name}_ho`, xo, R, s.f, hubM * 0.5, { r: 0, flags: 0 });
    const hubIn = this.node(`${s.name}_hi`, xi, R, s.f, hubM * 0.5, { r: 0, flags: 0 });
    const tm = (s.tireMass ?? 17) / (2 * N);
    const tIn = [], tOut = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dy = Math.sin(a) * R, df = Math.cos(a) * R;
      tOut.push(this.node(`${s.name}_to${i}`, s.x + side * w2, R + dy, s.f + df, tm, { r: 0.0, mu: s.grip ?? 1.05, flags: NF.COLLIDE | NF.TIRE }));
      tIn.push(this.node(`${s.name}_ti${i}`, s.x - side * w2, R + dy, s.f + df, tm, { r: 0.0, mu: s.grip ?? 1.05, flags: NF.COLLIDE | NF.TIRE }));
    }
    const kS = s.kSpoke ?? 4.2e4, kX = s.kCross ?? 3.4e4, kR = s.kRing ?? 2.2e5;
    const zs = s.zetaSpoke ?? 0.012;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, j2 = (i + 2) % N;
      // spokes
      this.beam(tOut[i], hubOut, { k: kS, zeta: zs, def: 9e4, brk: 4e5 });
      this.beam(tOut[i], hubIn, { k: kX, zeta: zs, def: 9e4, brk: 4e5 });
      this.beam(tIn[i], hubIn, { k: kS, zeta: zs, def: 9e4, brk: 4e5 });
      this.beam(tIn[i], hubOut, { k: kX, zeta: zs, def: 9e4, brk: 4e5 });
      // ring
      this.beam(tOut[i], tOut[j], { k: kR, zeta: 0.008, def: 9e4, brk: 4e5 });
      this.beam(tIn[i], tIn[j], { k: kR, zeta: 0.008, def: 9e4, brk: 4e5 });
      this.beam(tOut[i], tOut[j2], { k: kR * 0.5, zeta: 0.008, def: 9e4, brk: 4e5 });
      this.beam(tIn[i], tIn[j2], { k: kR * 0.5, zeta: 0.008, def: 9e4, brk: 4e5 });
      // cross-width
      this.beam(tOut[i], tIn[i], { k: kR * 0.6, zeta: 0.008, def: 9e4, brk: 4e5 });
      this.beam(tOut[i], tIn[j], { k: kR * 0.4, zeta: 0.008, def: 9e4, brk: 4e5 });
      this.beam(tIn[i], tOut[j], { k: kR * 0.4, zeta: 0.008, def: 9e4, brk: 4e5 });
      // tread collision quad
      this.tri(tOut[i], tOut[j], tIn[j], true);
      this.tri(tOut[i], tIn[j], tIn[i], true);
    }
    const wheel = {
      name: s.name, side, axle: s.axle, radius: R, width: s.width,
      hubIn, hubOut, treadIn: tIn, treadOut: tOut,
      treadMass: tm * 2 * N,
      rollRes: s.rollRes ?? 0.011,
      brakeTorque: s.brakeTorque ?? 2000,
      handbrake: !!s.handbrake,
      handbrakeTorque: s.handbrakeTorque ?? 1800,
      driven: !!s.driven,
      steered: !!s.steered,
      tie: -1, reactNodes: null,
      spec: s,
    };
    this.wheels.push(wheel);
    return wheel;
  }

  // ---------------------------------------------------------- suspension
  /**
   * Rigid knuckle: hub nodes, steering-arm node and both ball joints are braced
   * pairwise so the assembly behaves as one body. Steering and bump motion come
   * entirely from how the joints are located (arms / tie rod).
   */
  _knuckle(w, kup, klo, tie, o = {}) {
    const k = o.kKnuckle ?? 3.5e6;
    const kn = { k, zeta: 0.1, def: 3e5, brk: 8e5 };
    // an extra node ahead of the axle gives the knuckle yaw stiffness (braced like a brake caliper mount)
    const ph = this.P(w.hubIn), po = this.P(w.hubOut);
    const cz = (ph[2] + po[2]) / 2;
    const kfr = this.node(`${w.name}_kfr`, (ph[0] + po[0]) / 2 + (w.side > 0 ? -0.03 : 0.03), ph[1] + 0.04, -(cz) + (o.kfrOff ?? 0.16), 3, { flags: 0 });
    const ns = [w.hubIn, w.hubOut, tie, kup, klo, kfr];
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) this.beam(ns[i], ns[j], kn);
    w.tie = tie; w.kup = kup; w.klo = klo; w.kfr = kfr;
  }

  /**
   * Independent double-wishbone corner.
   * c: {x (wheel centre lateral, signed), f, R, spring, damper, bump, rebound, tower: {x,y,f},
   *     steer:boolean, rackEnd:{x,y,f}|node, tieSide: +1 front / -1 rear of axle,
   *     arms: {lowerF,lowerR,upperF,upperR}, springOn:'upper'|'lower', travel:{up,down}}
   */
  addIndependentCorner(w, c) {
    const sg = w.side;
    const x0 = Math.abs(c.x);
    const R = w.radius;
    const f = c.f;
    const caster = c.casterOffset ?? 0.035;
    const kup = this.node(`${w.name}_kup`, sg * (x0 - (c.kupIn ?? 0.0)), R + (c.kupUp ?? 0.20), f - caster, 5.0, { flags: 0 });
    const klo = this.node(`${w.name}_klo`, sg * (x0 - (c.kloIn ?? 0.02)), R - (c.kloDown ?? 0.15), f, 6.0, { flags: 0 });
    const tieF = f + (c.tieSide ?? -1) * (c.tieOff ?? 0.20);
    const tie = this.node(`${w.name}_tie`, sg * (x0 - (c.tieIn ?? 0.08)), R + 0.05, tieF, 4.0, { flags: 0 });
    this._knuckle(w, kup, klo, tie, c);
    // chassis pickups
    const a = c.arms || {};
    const lowX = x0 - (a.lowerIn ?? 0.56), upX = x0 - (a.upperIn ?? 0.5);
    const laF = this.mount(`${w.name}_laf`, sg * lowX, a.lowerY ?? 0.24, f + (a.lowerF ?? 0.2), 5);
    const laR = this.mount(`${w.name}_lar`, sg * lowX, a.lowerY ?? 0.24, f - (a.lowerR ?? 0.22), 5);
    const uaF = this.mount(`${w.name}_uaf`, sg * upX, R + (a.upperY ?? 0.26), f + (a.upperF ?? 0.12), 4);
    const uaR = this.mount(`${w.name}_uar`, sg * upX, R + (a.upperY ?? 0.26), f - (a.upperR ?? 0.14), 4);
    const armOpt = { k: c.kArm ?? 1.8e6, zeta: 0.1, def: 120000, brk: 260000, group: 0 };
    this.beam(klo, laF, armOpt); this.beam(klo, laR, armOpt);
    this.beam(kup, uaF, armOpt); this.beam(kup, uaR, armOpt);
    // spring / damper
    const t = c.tower;
    const tower = this.mount(`${w.name}_tower`, sg * (x0 - t.in), t.y, t.f ?? f, 6, 7);
    const sn = c.springOn === 'lower' ? klo : kup;
    const Ld = this.dist(tower, sn);
    const sIdx = this.beam(tower, sn, {
      type: BT.BOUNDED, k: c.spring, c: c.bump, cReb: c.rebound,
      lo: Ld - (c.travel?.up ?? 0.10), hi: Ld + (c.travel?.down ?? 0.11), kStop: c.kStop ?? 4e5,
      brk: 120000, spring: true, def: 1e9,
    });
    // bump stop (progressive)
    // steering / toe link. The inner end of the rod is placed so that the rod is
    // parallel to (and as long as) the lower arm: zero bump steer to first order.
    {
      const pl = this.P(klo), pt = this.P(tie), pa = this.P(laF), pb = this.P(laR);
      // closest point on the lower-arm axis at the knuckle's longitudinal position
      const axisPt = [pa[0], pa[1] + (pb[1] - pa[1]) * ((pl[2] - pa[2]) / (pb[2] - pa[2] || 1)), pl[2]];
      const rx = pt[0] + (axisPt[0] - pl[0]);
      const ry = pt[1] + (axisPt[1] - pl[1]);
      const rackName = c.steer ? `${w.name}_rack` : `${w.name}_toe`;
      const rack = this.mount(rackName, rx, ry, tieF, 5, 6);
      const bi = this.beam(rack, tie, { k: 1.4e6, zeta: c.steer ? 0.4 : 0.15, def: c.steer ? 1e9 : 1.2e5, brk: c.steer ? 6e5 : 4e5 });
      if (c.steer) {
        const table = this._steerTable(rack, tie, kup, klo);
        this.steerTables.push(table);
        this.steerBeams.push({ beam: bi, side: sg, table: this.steerTables.length - 1 });
      }
    }
    w.reactNodes = [laR, laF];
    w.mounts = { laF, laR, uaF, uaR, tower };
    w.spring = sIdx;
    return { kup, klo, tie, tower, laF, laR };
  }

  _steerTable(rack, tie, kup, klo) {
    const P = (i) => this.P(i);
    const r = P(rack), t = P(tie), a = P(klo), b = P(kup);
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const il = 1 / Math.hypot(ux, uy, uz); ux *= il; uy *= il; uz *= il;
    const L = Math.hypot(t[0] - r[0], t[1] - r[1], t[2] - r[2]);
    const n = 41, min = -0.9, max = 0.9, vals = [];
    for (let i = 0; i < n; i++) {
      const ang = -(min + (max - min) * (i / (n - 1))); // right turn = -rotation about up
      // Rodrigues rotation of (t - a) about u
      const vx = t[0] - a[0], vy = t[1] - a[1], vz = t[2] - a[2];
      const c = Math.cos(ang), s = Math.sin(ang);
      const d = ux * vx + uy * vy + uz * vz;
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      const px = a[0] + vx * c + cx * s + ux * d * (1 - c);
      const py = a[1] + vy * c + cy * s + uy * d * (1 - c);
      const pz = a[2] + vz * c + cz * s + uz * d * (1 - c);
      vals.push(Math.hypot(px - r[0], py - r[1], pz - r[2]) - L);
    }
    return new SteerTable(min, max, vals);
  }

  /**
   * Rigid axle with coil springs, radius arms and a Panhard rod. A steered axle
   * carries rigid steering knuckles that pivot on a ball joint (lower) and a
   * pin-line constraint (upper) fixed to the axle body.
   * a: {f, track, spring, bump, rebound, frameY, steer, rackEnd, diffMass, arms}
   */
  addSolidAxle(wL, wR, a) {
    const R = wL.radius;
    const f = a.f;
    const x0 = a.track * 0.5;
    const steer = !!a.steer;
    const axBeam = { k: 2.2e6, zeta: 0.1, def: 5e5, brk: 1.2e6 };
    const caster = a.casterOffset ?? 0.03;
    // axle body nodes (inboard of the knuckles when steered)
    const inset = steer ? 0.30 : 0.12;
    const mk = (w, sg) => {
      const alo = this.node(`${w.name}_alo`, sg * (x0 - inset), R - 0.17, f, steer ? 16 : 14, { flags: 0 });
      const aup = this.node(`${w.name}_aup`, sg * (x0 - inset), R + 0.19, f - caster, steer ? 14 : 12, { flags: 0 });
      return { alo, aup };
    };
    const L = mk(wL, -1), Rr = mk(wR, +1);
    const dif = this.node(`${wL.name}_diff`, 0, R - 0.05, f + 0.05, a.diffMass ?? 45, { flags: 0 });
    const body = [L.alo, L.aup, Rr.alo, Rr.aup, dif];
    for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) this.beam(body[i], body[j], axBeam);
    const hubs = [[wL, L, -1], [wR, Rr, 1]];
    for (const [w, k, sg] of hubs) {
      const tieF = f + (a.tieSide ?? 1) * (a.tieOff ?? 0.25);
      const tie = this.node(`${w.name}_tie`, sg * (x0 - (a.tieIn ?? 0.04)), R + 0.05, tieF, 4, { flags: 0 });
      if (steer) {
        const kup = this.node(`${w.name}_kup`, sg * x0, R + 0.19, f - caster, 5, { flags: 0 });
        const klo = this.node(`${w.name}_klo`, sg * x0, R - 0.17, f, 6, { flags: 0 });
        this._knuckle(w, kup, klo, tie, { kKnuckle: 2e6 });
        const j = { k: 2e6, zeta: 0.1, def: 5e5, brk: 1.2e6 };
        // lower ball joint: three anchors, upper: pin line (two anchors)
        this.beam(klo, k.alo, j); this.beam(klo, k.aup, j); this.beam(klo, dif, j);
        this.beam(kup, k.aup, j); this.beam(kup, k.alo, j);
      } else {
        // the hub cluster is rigidly part of the axle: kup/klo are axle nodes
        this._knuckle(w, k.aup, k.alo, tie, { kKnuckle: 2e6 });
        this.beam(tie, dif, { k: 2e6, zeta: 0.1, def: 5e5, brk: 1.2e6 });
      }
      w.reactNodes = [k.alo, k.aup];
    }
    // springs & dampers frame <-> axle
    const sp = a.spring;
    for (const [w, k, sg] of hubs) {
      const tower = this.mount(`${w.name}_tower`, sg * (x0 - (a.springIn ?? 0.28)), a.frameY ?? (R + 0.52), f, 8, 8);
      const Ld = this.dist(tower, k.alo);
      w.spring = this.beam(tower, k.alo, {
        type: BT.BOUNDED, k: sp, c: a.bump, cReb: a.rebound,
        lo: Ld - (a.travel?.up ?? 0.13), hi: Ld + (a.travel?.down ?? 0.15), kStop: 6e5,
        brk: 200000, spring: true,
      });
      w.mounts = { tower };
    }
    // radius arms (lower & upper trailing links)
    const ar = a.arms || {};
    for (const [w, k, sg] of hubs) {
      const xa = sg * (x0 - (ar.in ?? 0.4));
      const len = ar.length ?? 0.9;
      const lowA = this.mount(`${w.name}_ra_l`, xa, ar.lowerY ?? (R - 0.05), f - len * (a.armDir ?? 1), 8, 8);
      const upA = this.mount(`${w.name}_ra_u`, xa, ar.upperY ?? (R + 0.18), f - len * 0.9 * (a.armDir ?? 1), 8, 8);
      const o = { k: 2.5e6, zeta: 0.1, def: 160000, brk: 360000 };
      this.beam(lowA, k.alo, o); this.beam(upA, k.aup, o);
      this.beam(lowA, k.aup, { ...o, k: 1.5e6 }); this.beam(upA, k.alo, { ...o, k: 1.5e6 });
    }
    // Panhard rod
    const pL = this.mount(`${wL.name}_pan`, -(x0 - 0.2), R + 0.1, f + 0.02, 8, 8);
    this.beam(pL, Rr.alo, { k: 3e6, zeta: 0.15, def: 160000, brk: 360000 });
    this.beam(pL, Rr.aup, { k: 3e6, zeta: 0.15, def: 160000, brk: 360000 });
    // steering
    if (steer) {
      for (const [w, k, sg] of hubs) {
        const rk = a.rackEnd;
        const rack = this.mount(`${w.name}_rack`, sg * rk.x, rk.y ?? R + 0.05, rk.f ?? f - 0.2, 6, 8);
        const bi = this.beam(rack, w.tie, { k: 1.6e6, zeta: 0.4, def: 1e9, brk: 6e5 });
        const table = this._steerTable(rack, w.tie, w.kup, w.klo);
        this.steerTables.push(table);
        this.steerBeams.push({ beam: bi, side: sg, table: this.steerTables.length - 1 });
      }
    }
    return { L, R: Rr, dif };
  }

  addArb(wL, wR, nodeL, nodeR, refL, refR, k) {
    // heights at design pose measured along +y (vehicle up)
    const hL = this.pos[3 * nodeL + 1] - this.pos[3 * refL + 1];
    const hR = this.pos[3 * nodeR + 1] - this.pos[3 * refR + 1];
    this.arbs.push({ left: nodeL, right: nodeR, refL, refR, h0L: hL, h0R: hR, k });
  }

  // -------------------------------------------------------------- finish
  finish(extra = {}) {
    const nN = this.mass.length;
    // damping from damping ratios
    const beams = this.beams;
    const nB = beams.length;
    const arr = (n, T = Float64Array) => new T(n);
    const bp = {
      name: this.name,
      nodeCount: nN, beamCount: nB,
      pos: Float64Array.from(this.pos),
      mass: Float64Array.from(this.mass),
      radius: Float64Array.from(this.radius),
      nmu: Float64Array.from(this.nmu),
      nflags: Uint8Array.from(this.nflags),
      nodeNames: this.names,
      b1: arr(nB, Int32Array), b2: arr(nB, Int32Array),
      L0: arr(nB), K: arr(nB), C: arr(nB), CReb: arr(nB),
      btype: arr(nB, Uint8Array), defF: arr(nB), brkF: arr(nB),
      lo: arr(nB), hi: arr(nB), kStop: arr(nB), bgroup: arr(nB, Int32Array),
      skinTris: this.skinTris, tireTris: this.tireTris,
      wheels: this.wheels,
      steerBeams: this.steerBeams, steerTables: this.steerTables,
      springBeams: this.springBeams, arbs: this.arbs,
      dragNodes: this.dragNodes,
      refs: { ...this.refs },
      parts: this.parts,
      body: this.body,
      names: this.nameMap,
    };
    for (let i = 0; i < nB; i++) {
      const b = beams[i];
      bp.b1[i] = b.a; bp.b2[i] = b.b;
      bp.L0[i] = b.L0; bp.K[i] = b.k;
      const mr = (this.mass[b.a] * this.mass[b.b]) / (this.mass[b.a] + this.mass[b.b]);
      bp.C[i] = b.c ?? 2 * b.zeta * sqrt(b.k * mr);
      bp.CReb[i] = b.cReb ?? bp.C[i];
      bp.btype[i] = b.type;
      bp.defF[i] = b.def; bp.brkF[i] = b.brk;
      bp.lo[i] = b.lo; bp.hi[i] = b.hi; bp.kStop[i] = b.kStop;
      bp.bgroup[i] = b.group;
    }
    Object.assign(bp, extra);
    // wheels: finalize records (strip builder-only fields)
    bp.wheels = this.wheels.map((w) => ({
      name: w.name, side: w.side, axle: w.axle, radius: w.radius, width: w.width,
      hubIn: w.hubIn, hubOut: w.hubOut, treadIn: w.treadIn, treadOut: w.treadOut,
      treadMass: w.treadMass, rollRes: w.rollRes, brakeTorque: w.brakeTorque,
      handbrake: w.handbrake, handbrakeTorque: w.handbrakeTorque,
      driven: w.driven, steered: w.steered, tie: w.tie, reactNodes: w.reactNodes,
      kup: w.kup, klo: w.klo, spring: w.spring,
    }));
    return bp;
  }
}
