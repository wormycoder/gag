// "Skin space": visual geometry authored in the vehicle's rest pose is bound to
// the quads of the physical body shell and follows them as they deform. Each
// vertex stores which quad it belongs to, bilinear coordinates inside that quad
// and a local offset (and normal) in the quad's current frame.

import * as THREE from '../../vendor/three.module.min.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class SkinSpace {
  /**
   * @param {object} body  blueprint body {ring[nS][K], K, nS}
   * @param {Float64Array} restPos rest node positions
   */
  constructor(body, restPos) {
    this.ring = body.ring;
    this.K = body.K;
    this.nS = body.nS;
    this.rest = restPos;
    this.nQuads = (this.nS - 1) * this.K;
    this.frames = new Float64Array(this.nQuads * 12); // origin-free basis b1,b2,n + dummy
    this.centers = [];
    for (let i = 0; i < this.nS - 1; i++) for (let j = 0; j < this.K; j++) {
      const c = [0, 0, 0];
      for (const n of this.quadNodes(i, j)) for (let k = 0; k < 3; k++) c[k] += restPos[3 * n + k] / 4;
      this.centers.push(c);
    }
  }

  quadNodes(i, j) {
    const K = this.K;
    return [this.ring[i][j], this.ring[i][(j + 1) % K], this.ring[i + 1][j], this.ring[i + 1][(j + 1) % K]];
  }

  /** corner positions + frame from a position array into out (b1,b2,n each 3) */
  frame(pos, i, j, out, o) {
    const [a, b, c, d] = this.quadNodes(i, j);
    const A = 3 * a, B = 3 * b, C = 3 * c, D = 3 * d;
    const e1x = (pos[C] + pos[D] - pos[A] - pos[B]) * 0.5, e1y = (pos[C + 1] + pos[D + 1] - pos[A + 1] - pos[B + 1]) * 0.5, e1z = (pos[C + 2] + pos[D + 2] - pos[A + 2] - pos[B + 2]) * 0.5;
    const e2x = (pos[B] + pos[D] - pos[A] - pos[C]) * 0.5, e2y = (pos[B + 1] + pos[D + 1] - pos[A + 1] - pos[C + 1]) * 0.5, e2z = (pos[B + 2] + pos[D + 2] - pos[A + 2] - pos[C + 2]) * 0.5;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    let l = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= l; ny *= l; nz *= l;
    l = 1 / (Math.hypot(e1x, e1y, e1z) || 1);
    const b1x = e1x * l, b1y = e1y * l, b1z = e1z * l;
    // b2 = n x b1
    const b2x = ny * b1z - nz * b1y, b2y = nz * b1x - nx * b1z, b2z = nx * b1y - ny * b1x;
    out[o] = b1x; out[o + 1] = b1y; out[o + 2] = b1z;
    out[o + 3] = b2x; out[o + 4] = b2y; out[o + 5] = b2z;
    out[o + 6] = nx; out[o + 7] = ny; out[o + 8] = nz;
  }

  /** bilinear point inside quad */
  point(pos, i, j, u, v, out) {
    const [a, b, c, d] = this.quadNodes(i, j);
    const w00 = (1 - u) * (1 - v), w01 = (1 - u) * v, w10 = u * (1 - v), w11 = u * v;
    for (let k = 0; k < 3; k++) {
      out[k] = w00 * pos[3 * a + k] + w01 * pos[3 * b + k] + w10 * pos[3 * c + k] + w11 * pos[3 * d + k];
    }
    return out;
  }

  /** Find nearest quad & bilinear coordinates for a rest-pose point. */
  locate(p) {
    let best = 1e9, bi = 0, bj = 0;
    let q = 0;
    for (let i = 0; i < this.nS - 1; i++) for (let j = 0; j < this.K; j++, q++) {
      const c = this.centers[q];
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
      if (d < best) { best = d; bi = i; bj = j; }
    }
    // Newton on the bilinear patch
    let u = 0.5, v = 0.5;
    const pt = [0, 0, 0], pu = [0, 0, 0], pv = [0, 0, 0];
    for (let it = 0; it < 6; it++) {
      this.point(this.rest, bi, bj, u, v, pt);
      this.point(this.rest, bi, bj, Math.min(1, u + 0.01), v, pu);
      this.point(this.rest, bi, bj, u, Math.min(1, v + 0.01), pv);
      const du = sub(pu, pt).map((x) => x / 0.01), dv = sub(pv, pt).map((x) => x / 0.01);
      const r = sub(p, pt);
      // least squares for (du, dv)
      const a11 = dot(du, du), a12 = dot(du, dv), a22 = dot(dv, dv);
      const b1 = dot(du, r), b2 = dot(dv, r);
      const det = a11 * a22 - a12 * a12 || 1;
      u += (a22 * b1 - a12 * b2) / det * 0.8;
      v += (a11 * b2 - a12 * b1) / det * 0.8;
      u = Math.max(0, Math.min(1, u)); v = Math.max(0, Math.min(1, v));
    }
    return { i: bi, j: bj, u, v };
  }

  /**
   * Bind a geometry given in rest-pose vehicle space. Returns a Binding.
   * @param {THREE.BufferGeometry} geo with position & normal
   * @param {Array} [params] optional per-vertex {i,j,u,v} (skips the search)
   */
  bind(geo, params) {
    const P = geo.attributes.position, N = geo.attributes.normal;
    const nv = P.count;
    const quad = new Int32Array(nv);
    const uv = new Float32Array(nv * 2);
    const off = new Float32Array(nv * 3);
    const nrm = new Float32Array(nv * 3);
    const fr = new Float64Array(9);
    const cache = new Map();
    for (let k = 0; k < nv; k++) {
      const p = [P.getX(k), P.getY(k), P.getZ(k)];
      const loc = params ? params[k] : this.locate(p);
      const key = loc.i * this.K + loc.j;
      quad[k] = key;
      uv[2 * k] = loc.u; uv[2 * k + 1] = loc.v;
      let f = cache.get(key);
      if (!f) { f = new Float64Array(9); this.frame(this.rest, loc.i, loc.j, f, 0); cache.set(key, f); }
      const base = this.point(this.rest, loc.i, loc.j, loc.u, loc.v, [0, 0, 0]);
      const d = sub(p, base);
      off[3 * k] = dot(d, [f[0], f[1], f[2]]);
      off[3 * k + 1] = dot(d, [f[3], f[4], f[5]]);
      off[3 * k + 2] = dot(d, [f[6], f[7], f[8]]);
      const n = [N.getX(k), N.getY(k), N.getZ(k)];
      nrm[3 * k] = dot(n, [f[0], f[1], f[2]]);
      nrm[3 * k + 1] = dot(n, [f[3], f[4], f[5]]);
      nrm[3 * k + 2] = dot(n, [f[6], f[7], f[8]]);
    }
    return new Binding(this, geo, quad, uv, off, nrm);
  }
}

export class Binding {
  constructor(space, geo, quad, uv, off, nrm) {
    this.space = space; this.geo = geo; this.quad = quad; this.uv = uv; this.off = off; this.nrm = nrm;
    this.nv = quad.length;
  }

  /** Update geometry from current node positions (frames shared via cache). */
  update(pos, frameCache) {
    const sp = this.space, K = sp.K;
    const P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array;
    const { quad, uv, off, nrm } = this;
    for (let k = 0; k < this.nv; k++) {
      const key = quad[k];
      const i = (key / K) | 0, j = key - i * K;
      let fo = key * 12;
      if (frameCache.stamp[key] !== frameCache.cur) {
        sp.frame(pos, i, j, frameCache.data, fo);
        frameCache.stamp[key] = frameCache.cur;
      }
      const f = frameCache.data;
      const u = uv[2 * k], v = uv[2 * k + 1];
      const [a, b, c, d] = sp.quadNodes(i, j);
      const w00 = (1 - u) * (1 - v), w01 = (1 - u) * v, w10 = u * (1 - v), w11 = u * v;
      const ox = off[3 * k], oy = off[3 * k + 1], oz = off[3 * k + 2];
      P[3 * k] = w00 * pos[3 * a] + w01 * pos[3 * b] + w10 * pos[3 * c] + w11 * pos[3 * d] + ox * f[fo] + oy * f[fo + 3] + oz * f[fo + 6];
      P[3 * k + 1] = w00 * pos[3 * a + 1] + w01 * pos[3 * b + 1] + w10 * pos[3 * c + 1] + w11 * pos[3 * d + 1] + ox * f[fo + 1] + oy * f[fo + 4] + oz * f[fo + 7];
      P[3 * k + 2] = w00 * pos[3 * a + 2] + w01 * pos[3 * b + 2] + w10 * pos[3 * c + 2] + w11 * pos[3 * d + 2] + ox * f[fo + 2] + oy * f[fo + 5] + oz * f[fo + 8];
      const nx = nrm[3 * k], ny = nrm[3 * k + 1], nz = nrm[3 * k + 2];
      N[3 * k] = nx * f[fo] + ny * f[fo + 3] + nz * f[fo + 6];
      N[3 * k + 1] = nx * f[fo + 1] + ny * f[fo + 4] + nz * f[fo + 7];
      N[3 * k + 2] = nx * f[fo + 2] + ny * f[fo + 5] + nz * f[fo + 8];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

export function makeFrameCache(space) {
  return { data: new Float64Array(space.nQuads * 12), stamp: new Int32Array(space.nQuads).fill(-1), cur: 0 };
}

/** merge geometries (position, normal, uv optional, color optional) into one */
export function mergeGeometries(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, vo * 3); else col.fill(1, vo * 3, (vo + c) * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo;
    else for (let i = 0; i < c; i++) idx[io++] = vo + i;
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
