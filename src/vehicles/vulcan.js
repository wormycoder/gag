// Vulcan GT — rear-wheel-drive V8 grand tourer. Long hood, low roof, staggered
// 18" tyres, limited-slip rear diff, 6-speed.

import { assemble } from './assemble.js';

const sections = [
  //  f      zb    wb    zr    ws     zs    wg    zg    wr    zt    crown
  { f: -2.34, zb: 0.40, wb: 0.60, zr: 0.52, ws: 0.84, zs: 0.86, wg: 0.72, zg: 0.90, wr: 0.55, zt: 0.95, crown: 0.01 },
  { f: -2.20, zb: 0.30, wb: 0.66, zr: 0.44, ws: 0.90, zs: 0.90, wg: 0.76, zg: 0.93, wr: 0.58, zt: 0.98, crown: 0.015 },
  { f: -1.90, zb: 0.20, wb: 0.72, zr: 0.34, ws: 0.935, zs: 0.95, wg: 0.80, zg: 0.98, wr: 0.62, zt: 1.00, crown: 0.02 },
  { f: -1.55, zb: 0.17, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.96, wg: 0.80, zg: 0.99, wr: 0.62, zt: 1.06, crown: 0.02 },
  { f: -1.15, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.80, zg: 0.99, wr: 0.64, zt: 1.18, crown: 0.02 },
  { f: -0.70, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.82, zg: 0.99, wr: 0.66, zt: 1.24, crown: 0.025 },
  { f: -0.20, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.82, zg: 0.99, wr: 0.66, zt: 1.27, crown: 0.03 },
  { f: 0.20, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.82, zg: 0.99, wr: 0.66, zt: 1.27, crown: 0.03 },
  { f: 0.55, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.83, zg: 0.99, wr: 0.67, zt: 1.19, crown: 0.025 },
  { f: 0.85, zb: 0.16, wb: 0.74, zr: 0.32, ws: 0.94, zs: 0.97, wg: 0.84, zg: 0.99, wr: 0.68, zt: 1.06, crown: 0.02 },
  { f: 1.10, zb: 0.17, wb: 0.74, zr: 0.33, ws: 0.935, zs: 0.95, wg: 0.84, zg: 0.96, wr: 0.70, zt: 0.98, crown: 0.02 },
  { f: 1.45, zb: 0.18, wb: 0.73, zr: 0.34, ws: 0.93, zs: 0.90, wg: 0.83, zg: 0.91, wr: 0.70, zt: 0.92, crown: 0.02 },
  { f: 1.80, zb: 0.20, wb: 0.72, zr: 0.36, ws: 0.93, zs: 0.84, wg: 0.82, zg: 0.85, wr: 0.66, zt: 0.87, crown: 0.02 },
  { f: 2.10, zb: 0.22, wb: 0.70, zr: 0.40, ws: 0.92, zs: 0.76, wg: 0.80, zg: 0.77, wr: 0.62, zt: 0.79, crown: 0.015 },
  { f: 2.30, zb: 0.24, wb: 0.66, zr: 0.41, ws: 0.88, zs: 0.70, wg: 0.74, zg: 0.71, wr: 0.55, zt: 0.73, crown: 0.01 },
  { f: 2.43, zb: 0.28, wb: 0.56, zr: 0.42, ws: 0.82, zs: 0.64, wg: 0.70, zg: 0.65, wr: 0.46, zt: 0.67, crown: 0.01 },
];

export const vulcanSpec = {
  id: 'vulcan',
  mass: 1560,
  body: {
    sections,
    bodyK: 6.5e5,
    bodyDef: 15000,
    crush: [[-2.5, 0.2], [-2.0, 0.3], [-1.4, 0.9], [-0.9, 1.9], [0.9, 1.9], [1.5, 0.9], [2.0, 0.3], [2.5, 0.2]],
  },
  axle: {
    front: {
      f: 1.36, track: 1.58, type: 'independent', steered: true, brake: 2600,
      tire: { R: 0.327, width: 0.245, mass: 17, hubMass: 9, grip: 1.12 },
      susp: {
        spring: 42000, bump: 2400, rebound: 4200, arb: 20000,
        tower: { in: 0.30, y: 0.90 }, travel: { up: 0.09, down: 0.11 },
        tieSide: -1, tieOff: 0.15,
        arms: { lowerIn: 0.60, lowerY: 0.24, upperIn: 0.52, upperY: 0.27, lowerF: 0.22, lowerR: 0.24, upperF: 0.13, upperR: 0.15 },
      },
    },
    rear: {
      f: -1.36, track: 1.60, type: 'independent', driven: true, brake: 1700, handbrake: true, handbrakeTorque: 1800,
      tire: { R: 0.337, width: 0.275, mass: 19, hubMass: 10, grip: 1.15 },
      susp: {
        spring: 38000, bump: 2100, rebound: 3800, arb: 11000,
        tower: { in: 0.30, y: 0.82 }, travel: { up: 0.09, down: 0.11 },
        tieSide: -1, tieOff: 0.15,
        arms: { lowerIn: 0.55, lowerY: 0.25, upperIn: 0.48, upperY: 0.27, lowerF: 0.22, lowerR: 0.27, upperF: 0.13, upperR: 0.15 },
      },
    },
  },
  engine: { x: 0, y: 0.50, f: 1.00, mass: 230, span: 0.5, transverse: false },
  masses: [
    { name: 'trans', x: 0, y: 0.36, f: 0.15, mass: 90 },
    { name: 'tank', x: 0, y: 0.34, f: -1.55, mass: 45 },
    { name: 'driver', x: -0.38, y: 0.62, f: -0.05, mass: 80 },
  ],
  refs: { front: 0.9, back: -0.9, mid: 0.0 },
  steer: { maxAngle: 0.56, ackermann: 0.9 },
  aero: { cdA: 0.68, clA: 0.35, frontBias: 0.35 },
  drive: {
    layout: 'RWD',
    abs: true,
    engine: {
      inertia: 0.27, idle: 780, redline: 7000, brakeBase: 24, brakePerKrpm: 7,
      curve: [[0, 0], [500, 60], [800, 220], [1200, 330], [2000, 430], [3000, 490], [4000, 535], [4800, 545], [5600, 525], [6200, 495], [6800, 450], [7300, 380]],
    },
    gearbox: { auto: true, ratios: [3.62, 2.19, 1.55, 1.20, 1.0, 0.80], reverse: 3.4, final: 3.55, shiftTime: 0.18, upshift: 0.6 },
    clutch: { capacity: 760, start: 1200, lock: 2400, creep: 0.1 },
    diffs: { front: null, rear: { type: 'lsd', preload: 90, power: 0.4, coast: 0.2 }, center: { split: 0 } },
  },
  info: { title: 'Vulcan GT', cls: 'Grand tourer', power: '460 hp', drive: 'RWD', engine: '5.0L V8', weight: 1560 },
  visual: {
    paint: 0xc2231c, kind: 'coupe',
    glass: { wind: [0.4, 1.05], rear: [-1.62, -0.78], side: [[-0.62, 0.95]] },
    doors: [[-0.7, 1.0]],
    panels: [[1.15, 2.3], [-2.2, -1.65]],
    archExtra: 0.01,
    wheel: { style: 'sport', rimRadius: 0.2286, color: 0x2e3136, caliper: 0xf2c200 },
    camera: { dist: 6.3, height: 1.9, eye: [-0.4, 1.1, -0.05], hood: [0, 1.12, 1.4] },
  },
};

export function buildVulcan() { return assemble(vulcanSpec); }
