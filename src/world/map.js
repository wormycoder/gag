// "Proving Grounds": a 1 km square map with a huge flat test plaza (ramps, walls,
// barriers, jumps), rolling hills, an off-road area and a mountain road loop.
// Pure data generation (no DOM) so physics tests can run on the exact same map.

import { Terrain, SURFACE } from '../physics/terrain.js';

export const MAP_SIZE = 1024;
export const CELL = 2;

// deterministic value noise -------------------------------------------------
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}
function fbm(x, z, seed, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f, seed + i * 17); a *= 0.5; f *= 2; }
  return s;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// closed Catmull-Rom road ----------------------------------------------------
const ROAD_CTRL = [
  [215, 0, 0], [300, 70, 6], [380, 170, 20], [425, 300, 34], [340, 420, 46], [190, 470, 40], [40, 425, 26],
  [-120, 445, 30], [-280, 405, 44], [-400, 285, 52], [-445, 110, 42], [-385, -60, 30], [-425, -225, 21],
  [-335, -385, 13], [-165, -445, 9], [40, -405, 6], [185, -300, 2], [218, -130, 0],
];
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function buildRoad() {
  const pts = [];
  const n = ROAD_CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = ROAD_CTRL[(i + n - 1) % n], p1 = ROAD_CTRL[i], p2 = ROAD_CTRL[(i + 1) % n], p3 = ROAD_CTRL[(i + 2) % n];
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t), catmull(p0[2], p1[2], p2[2], p3[2], t)]);
    }
  }
  // returns [x, z, elevation]
  return pts;
}

/**
 * @returns {{terrain: Terrain, props: object[], road: number[][], spawn: object[], signs: object[]}}
 */
export function buildMap() {
  const terrain = new Terrain(MAP_SIZE / CELL, CELL, -MAP_SIZE / 2, -MAP_SIZE / 2);
  const road = buildRoad();
  const ROAD_W = 4.6; // half-width
  const SHOULDER = 11;

  // spatial index of road segments: only segments near a query point matter
  const segs = [];
  for (let i = 0; i < road.length; i++) segs.push([road[i], road[(i + 1) % road.length]]);
  const BIN = 32, FAR = ROAD_W + SHOULDER + 2;
  const bins = new Map();
  segs.forEach((sg, idx) => {
    const x0 = Math.min(sg[0][0], sg[1][0]) - FAR, x1 = Math.max(sg[0][0], sg[1][0]) + FAR;
    const z0 = Math.min(sg[0][1], sg[1][1]) - FAR, z1 = Math.max(sg[0][1], sg[1][1]) + FAR;
    for (let bz = Math.floor(z0 / BIN); bz <= Math.floor(z1 / BIN); bz++) for (let bx = Math.floor(x0 / BIN); bx <= Math.floor(x1 / BIN); bx++) {
      const k = bx * 4096 + bz;
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(idx);
    }
  });
  const nearestRoad = (x, z) => {
    const list = bins.get(Math.floor(x / BIN) * 4096 + Math.floor(z / BIN));
    if (!list) return [1e4, 0];
    let best = 1e18, bh = 0;
    for (let q = 0; q < list.length; q++) {
      const [a, b] = segs[list[q]];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      const px = a[0] + dx * t, pz = a[1] + dz * t;
      const d = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d < best) { best = d; bh = a[2] + (b[2] - a[2]) * t; }
    }
    return [Math.sqrt(best), bh];
  };

  const baseHeight = (x, z) => {
    const r = Math.hypot(x, z);
    const edge = Math.max(Math.abs(x), Math.abs(z));
    // hills grow outside the plaza; a mountain wall closes the map
    const hillMask = smooth(235, 330, r);
    let h = (fbm(x * 0.0045, z * 0.0045, 11, 5) - 0.35) * 150 * hillMask;
    h += (fbm(x * 0.02, z * 0.02, 5, 3) - 0.5) * 10 * hillMask;
    h += smooth(455, 505, edge) * 120;
    // off-road dune field in the south-east of the plaza ring
    const dx = x - 150, dz = z - 330;
    const dune = Math.exp(-(dx * dx + dz * dz) / (2 * 70 * 70));
    h += dune * (4 + Math.sin(x * 0.12 + Math.cos(z * 0.09) * 2) * 3 + Math.sin(z * 0.17) * 2) * hillMask;
    return Math.max(h, -2);
  };

  const roadInfo = new Float32Array((terrain.cells + 1) ** 2 * 2); // dist, elev
  {
    const { stride, cs, ox, oz, heights } = terrain;
    for (let j = 0; j < stride; j++) for (let i = 0; i < stride; i++) {
      const x = ox + i * cs, z = oz + j * cs;
      const [d, re] = nearestRoad(x, z);
      const bh = baseHeight(x, z);
      const w = 1 - smooth(ROAD_W, ROAD_W + SHOULDER, d);
      heights[j * stride + i] = bh + (re - bh) * w;
      roadInfo[2 * (j * stride + i)] = d; roadInfo[2 * (j * stride + i) + 1] = re;
    }
  }
  const roadDist = (x, z) => nearestRoad(x, z)[0];

  // surface classification ---------------------------------------------------
  const surfaceAt = (x, z, h) => {
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax < 205 && az < 205) return SURFACE.CONCRETE;
    const d = roadDist(x, z);
    if (d < ROAD_W + 0.5) return SURFACE.ASPHALT;
    if (d < ROAD_W + 2.5) return SURFACE.GRAVEL;
    const dx = x - 150, dz = z - 330;
    if (dx * dx + dz * dz < 55 * 55) return SURFACE.SAND;
    const n = fbm(x * 0.03, z * 0.03, 77, 3);
    if (n > 0.62) return SURFACE.DIRT;
    if (n < 0.28 && h < 12) return SURFACE.GRAVEL;
    return SURFACE.GRASS;
  };
  terrain.fillSurface((x, z) => surfaceAt(x, z, terrain.heightAt(x, z)));

  // props -------------------------------------------------------------------
  const props = [];
  const box = (o) => { const b = terrain.addBox(o); props.push(b); return b; };
  /** ramp rising along heading `yaw` (0 = rising towards -Z), base at (x,z) */
  const ramp = (x, z, yaw, len, width, height, color = 0xd8a22a) => {
    const th = Math.atan(height / len);
    const hy = 0.6, hz = len / (2 * Math.cos(th));
    // centre of the top surface is at half height; the slab sits below it
    const cx = x - Math.sin(yaw) * (len / 2), cz = z - Math.cos(yaw) * (len / 2);
    const cy = height / 2 - hy * Math.cos(th);
    return box({ x: cx, y: cy, z: cz, hx: width / 2, hy, hz, yaw, pitch: th, color, kind: 'ramp' });
  };
  const gh = (x, z) => terrain.heightAt(x, z);

  // jump ramps (take-off + landing pads)
  ramp(0, 90, 0, 14, 8, 2.2);            // small kicker, rising to -Z
  ramp(-40, 95, 0, 22, 9, 5.5);          // medium jump
  ramp(60, 110, 0, 30, 10, 9, 0xd04a2a); // big jump
  box({ x: 60, y: 0.0, z: 40, hx: 5, hy: 0.35, hz: 12, yaw: 0, pitch: -0.2, color: 0x8a8a8a, kind: 'landing' }); // landing ramp
  // roll-over bumps
  for (let i = 0; i < 8; i++) box({ x: -110, y: 0.0, z: 20 - i * 9, hx: 9, hy: 0.45, hz: 0.5, yaw: 0, pitch: 0, color: 0x777777, kind: 'bump' });
  // washboard
  for (let i = 0; i < 14; i++) box({ x: -150, y: 0.0, z: -40 - i * 2.4, hx: 6, hy: 0.28, hz: 0.55, color: 0x777777, kind: 'bump' });
  // seesaw-ish wedges
  ramp(120, -40, Math.PI / 2, 14, 7, 1.8, 0x2a8fd0);
  ramp(150, -40, -Math.PI / 2, 14, 7, 1.8, 0x2a8fd0);
  // 45-degree wall ride
  ramp(-80, -130, 0, 10, 7, 9, 0x3d8f3d);

  // crash zone: big concrete wall, jersey barriers, cube stack, pillars
  box({ x: 0, y: 1.5, z: -170, hx: 30, hy: 1.5, hz: 1.2, color: 0xaaaaaa, kind: 'wall' });
  for (let i = 0; i < 10; i++) box({ x: -60 + i * 3.2, y: 0.4, z: -140, hx: 1.5, hy: 0.4, hz: 0.25, color: 0xb9b9b9, kind: 'barrier' });
  for (let i = 0; i < 6; i++) box({ x: -35 + i * 14, y: 0.8, z: -105 + (i % 2) * 6, hx: 0.5, hy: 0.8, hz: 0.5, color: 0x9a9a9a, kind: 'pillar' });
  for (let k = 0; k < 4; k++) for (let i = 0; i < 4 - k; i++) box({ x: 90 + i * 1.1 + k * 0.55, y: 0.5 + k * 1.0, z: -130, hx: 0.5, hy: 0.5, hz: 0.5, color: 0xc2b280, kind: 'crate' });
  // concrete ring/arena walls around the skidpad
  const R = 38;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    box({ x: -80 + Math.cos(a) * R, y: 0.45, z: 140 + Math.sin(a) * R, hx: 3.2, hy: 0.45, hz: 0.3, yaw: -a + Math.PI / 2, color: 0xb0b0b0, kind: 'barrier' });
  }
  // plaza perimeter kerb
  for (let s = -200; s <= 200; s += 20) {
    box({ x: s, y: 0.3, z: -208, hx: 10, hy: 0.3, hz: 0.5, color: 0x9c9c9c, kind: 'kerb' });
  }
  // loose crates on the east side for destruction (static colliders)
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) box({ x: 100 + i * 1.3, y: 0.6 + j * 1.2, z: 20 + (i % 2) * 0.2, hx: 0.6, hy: 0.6, hz: 0.6, color: 0xa0743a, kind: 'crate' });
  // guard rail on the hairpin of the mountain road (decorative-solid posts)
  for (let i = 0; i < road.length; i += 3) {
    const a = road[i], b = road[(i + 1) % road.length];
    if (a[2] < 8) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    const side = i % 6 === 0 ? 1 : -1;
    const px = a[0] + nx * (ROAD_W + 1.3) * side, pz = a[1] + nz * (ROAD_W + 1.3) * side;
    box({ x: px, y: terrain.heightAt(px, pz) + 0.35, z: pz, hx: 0.12, hy: 0.35, hz: 1.7, yaw: Math.atan2(dx, dz) + Math.PI, color: 0xc8c8c8, kind: 'rail' });
  }
  terrain.finalize();

  const spawn = [
    { x: -12, z: 20, yaw: 0 },
    { x: 0, z: 20, yaw: 0 },
    { x: 12, z: 20, yaw: 0 },
  ];
  return { terrain, props, road, spawn, ROAD_W, roadInfo, roadDist };
}
