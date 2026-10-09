// Fixed-step simulation of all vehicles in a world, including vehicle<->vehicle
// collisions (nodes against the other vehicle's skin and tyre triangles).

import { Vehicle, NF } from './vehicle.js';

class TriHash {
  constructor(cell, size = 8192, maxEntries = 16384) {
    this.cell = cell;
    this.inv = 1 / cell;
    this.size = size;
    this.head = new Int32Array(size).fill(-1);
    this.next = new Int32Array(maxEntries);
    this.tri = new Int32Array(maxEntries);
    this.count = 0;
    this.max = maxEntries;
  }
  clear() { this.head.fill(-1); this.count = 0; }
  _h(x, y, z) {
    return (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % this.size;
  }
  insert(t, x0, y0, z0, x1, y1, z1) {
    const inv = this.inv;
    const ix0 = Math.floor(x0 * inv), ix1 = Math.floor(x1 * inv);
    const iy0 = Math.floor(y0 * inv), iy1 = Math.floor(y1 * inv);
    const iz0 = Math.floor(z0 * inv), iz1 = Math.floor(z1 * inv);
    for (let z = iz0; z <= iz1; z++) for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
      if (this.count >= this.max) return;
      const h = this._h(x, y, z);
      const e = this.count++;
      this.tri[e] = t;
      this.next[e] = this.head[h];
      this.head[h] = e;
    }
  }
}

const _hash = new TriHash(0.45);

/** Push nodes of `A` out of triangles of `B` (one direction). */
function collideNodesVsTris(A, B, dt, region) {
  const tris = B.collisionTris;
  const nt = tris.length / 3;
  const bp = B.pos, bv = B.vel, bf = B.frc, bm = B.mass;
  const [rx0, ry0, rz0, rx1, ry1, rz1] = region;
  const hash = _hash;
  hash.clear();
  const th = 0.06;
  for (let t = 0; t < nt; t++) {
    const a = 3 * tris[3 * t], b = 3 * tris[3 * t + 1], c = 3 * tris[3 * t + 2];
    const x0 = Math.min(bp[a], bp[b], bp[c]) - th, x1 = Math.max(bp[a], bp[b], bp[c]) + th;
    if (x1 < rx0 || x0 > rx1) continue;
    const y0 = Math.min(bp[a + 1], bp[b + 1], bp[c + 1]) - th, y1 = Math.max(bp[a + 1], bp[b + 1], bp[c + 1]) + th;
    if (y1 < ry0 || y0 > ry1) continue;
    const z0 = Math.min(bp[a + 2], bp[b + 2], bp[c + 2]) - th, z1 = Math.max(bp[a + 2], bp[b + 2], bp[c + 2]) + th;
    if (z1 < rz0 || z0 > rz1) continue;
    hash.insert(t, x0, y0, z0, x1, y1, z1);
  }
  if (hash.count === 0) return false;
  const ap = A.pos, av = A.vel, af = A.frc, am = A.mass;
  const wc = 0.4 / dt;
  const list = A.collideNodes;
  const inv = hash.inv;
  let any = false;
  for (let k = 0; k < list.length; k++) {
    const n = list[k];
    const o = 3 * n;
    const px = ap[o], py = ap[o + 1], pz = ap[o + 2];
    if (px < rx0 || px > rx1 || py < ry0 || py > ry1 || pz < rz0 || pz > rz1) continue;
    const h = hash._h(Math.floor(px * inv), Math.floor(py * inv), Math.floor(pz * inv));
    const nodeTire = A.nflags[n] & NF.TIRE;
    for (let e = hash.head[h]; e >= 0; e = hash.next[e]) {
      const t = hash.tri[e];
      const ia = tris[3 * t], ib = tris[3 * t + 1], ic = tris[3 * t + 2];
      const a = 3 * ia, b = 3 * ib, c = 3 * ic;
      const e1x = bp[b] - bp[a], e1y = bp[b + 1] - bp[a + 1], e1z = bp[b + 2] - bp[a + 2];
      const e2x = bp[c] - bp[a], e2y = bp[c + 1] - bp[a + 1], e2z = bp[c + 2] - bp[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      const dx = px - bp[a], dy = py - bp[a + 1], dz = pz - bp[a + 2];
      const d = dx * nx + dy * ny + dz * nz;
      const thick = th + A.radius[n];
      if (d > thick || d < -thick) continue;
      // barycentric of projection
      const qx = dx - d * nx, qy = dy - d * ny, qz = dz - d * nz;
      const d11 = e1x * e1x + e1y * e1y + e1z * e1z;
      const d12 = e1x * e2x + e1y * e2y + e1z * e2z;
      const d22 = e2x * e2x + e2y * e2y + e2z * e2z;
      const q1 = qx * e1x + qy * e1y + qz * e1z;
      const q2 = qx * e2x + qy * e2y + qz * e2z;
      const den = d11 * d22 - d12 * d12;
      if (Math.abs(den) < 1e-12) continue;
      let v = (d22 * q1 - d12 * q2) / den;
      let w = (d11 * q2 - d12 * q1) / den;
      let u = 1 - v - w;
      const eps = -0.03;
      if (u < eps || v < eps || w < eps) continue;
      if (u < 0) u = 0; if (v < 0) v = 0; if (w < 0) w = 0;
      const s = u + v + w; u /= s; v /= s; w /= s;
      const sg = d >= 0 ? 1 : -1;
      const sx = nx * sg, sy = ny * sg, sz = nz * sg;
      const pen = thick - Math.abs(d);
      // velocities
      const tvx = u * bv[a] + v * bv[b] + w * bv[c];
      const tvy = u * bv[a + 1] + v * bv[b + 1] + w * bv[c + 1];
      const tvz = u * bv[a + 2] + v * bv[b + 2] + w * bv[c + 2];
      const rvx = av[o] - tvx, rvy = av[o + 1] - tvy, rvz = av[o + 2] - tvz;
      const vn = rvx * sx + rvy * sy + rvz * sz;
      const mn = am[n];
      const mt = 1 / (u * u / bm[ia] + v * v / bm[ib] + w * w / bm[ic] + 1e-9);
      const me = (mn * mt) / (mn + mt);
      let fn = me * wc * wc * pen - 1.2 * me * wc * vn;
      if (fn <= 0) continue;
      any = true;
      af[o] += fn * sx; af[o + 1] += fn * sy; af[o + 2] += fn * sz;
      bf[a] -= fn * sx * u; bf[a + 1] -= fn * sy * u; bf[a + 2] -= fn * sz * u;
      bf[b] -= fn * sx * v; bf[b + 1] -= fn * sy * v; bf[b + 2] -= fn * sz * v;
      bf[c] -= fn * sx * w; bf[c + 1] -= fn * sy * w; bf[c + 2] -= fn * sz * w;
      // friction
      const vtx = rvx - vn * sx, vty = rvy - vn * sy, vtz = rvz - vn * sz;
      const vt = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz);
      if (vt > 1e-6) {
        const mu = nodeTire ? 0.9 : 0.45;
        let ft = (0.5 * me * vt) / dt;
        const lim = mu * fn;
        if (ft > lim) ft = lim;
        const fx = (-vtx / vt) * ft, fy = (-vty / vt) * ft, fz = (-vtz / vt) * ft;
        af[o] += fx; af[o + 1] += fy; af[o + 2] += fz;
        bf[a] -= fx * u; bf[a + 1] -= fy * u; bf[a + 2] -= fz * u;
        bf[b] -= fx * v; bf[b + 1] -= fy * v; bf[b + 2] -= fz * v;
        bf[c] -= fx * w; bf[c + 1] -= fy * w; bf[c + 2] -= fz * w;
      }
      A.impactAccum += fn * 0.02;
      B.impactAccum += fn * 0.02;
    }
  }
  return any;
}

export class Simulation {
  constructor(world, opts = {}) {
    this.world = world;
    this.dt = opts.dt ?? 1 / 2000;
    this.vehicles = [];
    this.time = 0;
    this.acc = 0;
    this.timeScale = 1;
    this.stepCounter = 0;
    this.maxStepsPerFrame = opts.maxSteps ?? 90;
    this.lastStepMs = 0;
    this.behind = false; // true when the sim couldn't keep up in real time
  }

  add(vehicle) {
    this.vehicles.push(vehicle);
    vehicle.computeAabb();
    return vehicle;
  }

  remove(vehicle) {
    const i = this.vehicles.indexOf(vehicle);
    if (i >= 0) this.vehicles.splice(i, 1);
  }

  step() {
    const dt = this.dt, world = this.world, vs = this.vehicles;
    const n = vs.length;
    this.stepCounter++;
    const refreshAabb = (this.stepCounter & 3) === 0;
    for (let i = 0; i < n; i++) {
      const v = vs[i];
      if (v.asleep) continue;
      v.computeForces(dt, world, this.time);
      if (refreshAabb) v.computeAabb();
    }
    for (let i = 0; i < n; i++) {
      const A = vs[i];
      for (let j = i + 1; j < n; j++) {
        const B = vs[j];
        if (A.asleep && B.asleep) continue;
        const a = A.aabb, b = B.aabb;
        const m = 0.25;
        if (a[0] > b[3] + m || b[0] > a[3] + m || a[1] > b[4] + m || b[1] > a[4] + m || a[2] > b[5] + m || b[2] > a[5] + m) continue;
        if (A.asleep) { A.wake(); A.computeForces(dt, world, this.time); }
        if (B.asleep) { B.wake(); B.computeForces(dt, world, this.time); }
        const region = [
          Math.max(a[0], b[0]) - m, Math.max(a[1], b[1]) - m, Math.max(a[2], b[2]) - m,
          Math.min(a[3], b[3]) + m, Math.min(a[4], b[4]) + m, Math.min(a[5], b[5]) + m,
        ];
        collideNodesVsTris(A, B, dt, region);
        collideNodesVsTris(B, A, dt, region);
      }
    }
    for (let i = 0; i < n; i++) if (!vs[i].asleep) vs[i].integrate(dt);
    this.time += dt;
  }

  /** Advance by real elapsed time (seconds), bounded by a CPU budget. */
  advance(realDt, budgetMs = 10) {
    this.acc += Math.min(realDt, 0.1) * this.timeScale;
    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= this.dt) {
      this.step();
      this.acc -= this.dt;
      steps++;
      if (steps >= this.maxStepsPerFrame || (steps & 7) === 0 && performance.now() - t0 > budgetMs) {
        this.behind = this.acc >= this.dt;
        this.acc = 0; // drop remaining time: run slower rather than spiral
        break;
      }
    }
    this.lastStepMs = performance.now() - t0;
    this.frameUpdate(realDt);
    return steps;
  }

  frameUpdate(frameDt) {
    for (const v of this.vehicles) {
      v.frameUpdate(frameDt);
      if (v.asleep) continue;
      const i = v.input;
      const active = i.throttle > 0.02 || i.brake > 0.02 || Math.abs(i.steer) > 0.02 || i.handbrake > 0;
      if (!v.keepAwake && !active && v.maxSpeedSq < 0.0009) {
        v.sleepTimer += frameDt;
        if (v.sleepTimer > 1.5) { v.asleep = true; v.vel.fill(0); }
      } else v.sleepTimer = 0;
    }
  }
}
