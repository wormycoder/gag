// Smooth rest-pose surface through the body shell nodes, sampled into a
// high-resolution grid (rows along the car, columns around the cross-section).

import * as THREE from '../../vendor/three.module.min.js';

const hermite = (p0, p1, m0, m1, h, t) => {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
};

export class Loft {
  /**
   * @param {object} body blueprint body (ring, K, nS, S)
   * @param {Float64Array} pos0 rest positions
   */
  constructor(body, pos0) {
    this.body = body;
    this.K = body.K;
    this.nS = body.nS;
    this.pos0 = pos0;
    this.f = body.S.map((s) => s.f);
    // ring[i][j] -> [x,y,z]
    this.R = body.ring.map((row) => row.map((n) => [pos0[3 * n], pos0[3 * n + 1], pos0[3 * n + 2]]));
  }

  /** ring of K points at section-parameter s (index space, continuous) */
  row(s) {
    const nS = this.nS, K = this.K;
    s = Math.max(0, Math.min(nS - 1 - 1e-9, s));
    const i = Math.floor(s), t = s - i;
    const out = [];
    const f = this.f;
    // interval in z (world) is monotonic decreasing with f; use f as the parameter
    const h = f[i + 1] - f[i];
    const ia = Math.max(0, i - 1), ib = Math.min(nS - 1, i + 2);
    for (let j = 0; j < K; j++) {
      const p = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const P0 = this.R[i][j][c], P1 = this.R[i + 1][j][c];
        const m0 = i === 0 ? (P1 - P0) / h : (P1 - this.R[ia][j][c]) / (f[i + 1] - f[ia]);
        const m1 = i + 1 === nS - 1 ? (P1 - P0) / h : (this.R[ib][j][c] - P0) / (f[ib] - f[i]);
        p[c] = hermite(P0, P1, m0, m1, h, t);
      }
      out.push(p);
    }
    return out;
  }

  /** point around a ring at continuous column j (periodic) */
  ringPoint(ring, jf) {
    const K = this.K;
    jf = ((jf % K) + K) % K;
    const k = Math.floor(jf), t = jf - k;
    const g = (n) => ring[((n % K) + K) % K];
    const p0 = g(k - 1), p1 = g(k), p2 = g(k + 1), p3 = g(k + 2);
    const d1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) || 1e-6;
    const dm = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) || 1e-6;
    const dp = Math.hypot(p3[0] - p2[0], p3[1] - p2[1], p3[2] - p2[2]) || 1e-6;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const m0 = 0.5 * (p2[c] - p0[c]) / (d1 + dm);
      const m1 = 0.5 * (p3[c] - p1[c]) / (d1 + dp);
      out[c] = hermite(p1[c], p2[c], m0, m1, d1, t);
    }
    return out;
  }

  /** s (section index space) for a forward coordinate f */
  sOfF(f) {
    const F = this.f;
    if (f <= F[0]) return 0;
    for (let i = 1; i < F.length; i++) if (f <= F[i]) return i - 1 + (f - F[i - 1]) / (F[i] - F[i - 1]);
    return F.length - 1;
  }

  /**
   * Build a grid surface. Returns {geo, params, cellOf}.
   * @param {object} o {s0,s1,j0,j1,nS,nJ, offset, skip:(s,j)=>bool, wrapJ}
   */
  build(o) {
    const rowsN = o.nS, colsN = o.nJ;
    const verts = [], params = [];
    const rowsData = [];
    for (let r = 0; r <= rowsN; r++) {
      const s = o.s0 + (o.s1 - o.s0) * (r / rowsN);
      rowsData.push({ s, ring: this.row(s) });
    }
    const pts = [];
    for (let r = 0; r <= rowsN; r++) {
      pts.push([]);
      for (let c = 0; c <= colsN; c++) {
        const jf = o.j0 + (o.j1 - o.j0) * (c / colsN);
        pts[r].push(this.ringPoint(rowsData[r].ring, jf));
      }
    }
    // normals from the grid (central differences); orientation fixed outward later
    const nrm = [];
    for (let r = 0; r <= rowsN; r++) {
      nrm.push([]);
      for (let c = 0; c <= colsN; c++) {
        const rp = pts[Math.min(rowsN, r + 1)][c], rm = pts[Math.max(0, r - 1)][c];
        const cp = pts[r][Math.min(colsN, c + 1)], cm = pts[r][Math.max(0, c - 1)];
        const a = [rp[0] - rm[0], rp[1] - rm[1], rp[2] - rm[2]];
        const b = [cp[0] - cm[0], cp[1] - cm[1], cp[2] - cm[2]];
        let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
        nrm[r].push(n);
      }
    }
    // outward: compare with direction from the section centre
    for (let r = 0; r <= rowsN; r++) for (let c = 0; c <= colsN; c++) {
      const ring = rowsData[r].ring;
      const ctr = ring.reduce((acc, p) => [acc[0] + p[0] / ring.length, acc[1] + p[1] / ring.length, acc[2] + p[2] / ring.length], [0, 0, 0]);
      const p = pts[r][c], n = nrm[r][c];
      const out = [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]];
      if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) nrm[r][c] = n.map((x) => -x);
    }
    const off = o.offset || 0;
    const posA = new Float32Array((rowsN + 1) * (colsN + 1) * 3);
    const norA = new Float32Array(posA.length);
    const uvA = new Float32Array((rowsN + 1) * (colsN + 1) * 2);
    const colA = new Float32Array(posA.length).fill(1);
    let k = 0;
    const fMin = this.f[0], fMax = this.f[this.nS - 1];
    for (let r = 0; r <= rowsN; r++) {
      const s = rowsData[r].s;
      let i = Math.min(this.nS - 2, Math.floor(s));
      const fAt = this.f[i] + (this.f[i + 1] - this.f[i]) * (s - i);
      for (let c = 0; c <= colsN; c++) {
        const jf = o.j0 + (o.j1 - o.j0) * (c / colsN);
        const p = pts[r][c], n = nrm[r][c];
        posA[3 * k] = p[0] + n[0] * off; posA[3 * k + 1] = p[1] + n[1] * off; posA[3 * k + 2] = p[2] + n[2] * off;
        norA[3 * k] = n[0]; norA[3 * k + 1] = n[1]; norA[3 * k + 2] = n[2];
        uvA[2 * k] = (fAt - fMin) / (fMax - fMin);
        uvA[2 * k + 1] = jf / this.K;
        // bilinear quad coordinates
        const jj = ((jf % this.K) + this.K) % this.K;
        let jc = Math.floor(jj), v = jj - jc;
        const sc = Math.min(this.nS - 2, i);
        params.push({ i: sc, j: jc, u: Math.max(0, Math.min(1, s - sc)), v });
        if (o.shade) { const sh = o.shade(s, jj, n, p); colA[3 * k] = sh[0]; colA[3 * k + 1] = sh[1]; colA[3 * k + 2] = sh[2]; }
        k++;
      }
    }
    const idx = [];
    const cellQuad = [];
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < colsN; c++) {
      const sM = o.s0 + (o.s1 - o.s0) * ((r + 0.5) / rowsN);
      const jM = o.j0 + (o.j1 - o.j0) * ((c + 0.5) / colsN);
      if (o.skip && o.skip(sM, ((jM % this.K) + this.K) % this.K)) continue;
      const a = r * (colsN + 1) + c, b = a + 1, d = a + colsN + 1, e = d + 1;
      // pick winding so that the face normal agrees with vertex normals
      const tri = (x, y, z) => {
        const px = posA, ax = px[3 * x], ay = px[3 * x + 1], az = px[3 * x + 2];
        const ux = px[3 * y] - ax, uy = px[3 * y + 1] - ay, uz = px[3 * y + 2] - az;
        const vx = px[3 * z] - ax, vy = px[3 * z + 1] - ay, vz = px[3 * z + 2] - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const dotn = nx * norA[3 * x] + ny * norA[3 * x + 1] + nz * norA[3 * x + 2];
        if (dotn >= 0) idx.push(x, y, z); else idx.push(x, z, y);
      };
      tri(a, b, e); tri(a, e, d);
      const sc = Math.min(this.nS - 2, Math.floor(sM)), jc = Math.floor(((jM % this.K) + this.K) % this.K);
      cellQuad.push(sc * this.K + jc, sc * this.K + jc);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norA, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    geo.setIndex(idx);
    return { geo, params, cellQuad, fullIndex: Uint32Array.from(idx) };
  }
}
