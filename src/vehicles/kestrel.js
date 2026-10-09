// Kestrel S — compact front-wheel-drive sedan. 2.0 L naturally aspirated four,
// transverse, 6-speed (auto or manual), MacPherson-style front / multilink rear.

import { assemble } from './assemble.js';

const sections = [
  //  f      zb    wb    zr    ws    zs    wg    zg    wr    zt    crown
  { f: -2.26, zb: 0.42, wb: 0.55, zr: 0.55, ws: 0.80, zs: 0.80, wg: 0.70, zg: 0.84, wr: 0.58, zt: 0.90, crown: 0.02 },
  { f: -2.10, zb: 0.31, wb: 0.60, zr: 0.45, ws: 0.84, zs: 0.80, wg: 0.78, zg: 0.86, wr: 0.60, zt: 0.93, crown: 0.02 },
  { f: -1.80, zb: 0.22, wb: 0.68, zr: 0.34, ws: 0.88, zs: 0.90, wg: 0.80, zg: 0.92, wr: 0.62, zt: 0.96, crown: 0.02 },
  { f: -1.45, zb: 0.17, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.94, wg: 0.80, zg: 0.97, wr: 0.60, zt: 1.14, crown: 0.02 },
  { f: -1.10, zb: 0.16, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.96, wg: 0.80, zg: 0.98, wr: 0.64, zt: 1.31, crown: 0.025 },
  { f: -0.70, zb: 0.16, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.97, wg: 0.80, zg: 0.98, wr: 0.66, zt: 1.41, crown: 0.03 },
  { f: -0.20, zb: 0.16, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.98, wg: 0.80, zg: 0.99, wr: 0.66, zt: 1.435, crown: 0.03 },
  { f: 0.30, zb: 0.16, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.98, wg: 0.80, zg: 0.99, wr: 0.66, zt: 1.435, crown: 0.03 },
  { f: 0.62, zb: 0.16, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.98, wg: 0.80, zg: 0.99, wr: 0.65, zt: 1.36, crown: 0.025 },
  { f: 0.95, zb: 0.17, wb: 0.70, zr: 0.32, ws: 0.89, zs: 0.97, wg: 0.82, zg: 0.99, wr: 0.68, zt: 1.14, crown: 0.02 },
  { f: 1.20, zb: 0.18, wb: 0.70, zr: 0.33, ws: 0.89, zs: 0.93, wg: 0.84, zg: 0.94, wr: 0.68, zt: 0.95, crown: 0.02 },
  { f: 1.55, zb: 0.19, wb: 0.69, zr: 0.34, ws: 0.88, zs: 0.90, wg: 0.84, zg: 0.91, wr: 0.66, zt: 0.92, crown: 0.02 },
  { f: 1.90, zb: 0.21, wb: 0.66, zr: 0.38, ws: 0.87, zs: 0.84, wg: 0.82, zg: 0.85, wr: 0.62, zt: 0.86, crown: 0.02 },
  { f: 2.12, zb: 0.27, wb: 0.62, zr: 0.42, ws: 0.85, zs: 0.77, wg: 0.80, zg: 0.78, wr: 0.58, zt: 0.80, crown: 0.015 },
  { f: 2.27, zb: 0.30, wb: 0.56, zr: 0.45, ws: 0.80, zs: 0.72, wg: 0.74, zg: 0.73, wr: 0.50, zt: 0.75, crown: 0.01 },
];

export const kestrelSpec = {
  id: 'kestrel',
  mass: 1260,
  body: {
    sections,
    bodyK: 6e5,
    bodyDef: 14000,
    crush: [[-2.4, 0.18], [-1.9, 0.28], [-1.3, 0.9], [-0.8, 1.8], [0.9, 1.8], [1.3, 0.9], [1.8, 0.28], [2.4, 0.18]],
  },
  axle: {
    front: {
      f: 1.32, track: 1.53, type: 'independent', driven: true, steered: true, brake: 1900,
      tire: { R: 0.316, width: 0.205, mass: 15, hubMass: 8 },
      susp: {
        spring: 30000, bump: 1700, rebound: 3000, arb: 12000,
        tower: { in: 0.30, y: 0.87 }, travel: { up: 0.10, down: 0.12 },
        rackEnd: { x: 0.22 }, tieSide: -1, tieOff: 0.12,
        arms: { lowerIn: 0.56, lowerY: 0.24, upperIn: 0.50, upperY: 0.26, lowerF: 0.20, lowerR: 0.22, upperF: 0.12, upperR: 0.14 },
      },
    },
    rear: {
      f: -1.32, track: 1.52, type: 'independent', brake: 1000, handbrake: true, handbrakeTorque: 1600,
      tire: { R: 0.316, width: 0.205, mass: 15, hubMass: 8 },
      susp: {
        spring: 24000, bump: 1300, rebound: 2400, arb: 6000,
        tower: { in: 0.30, y: 0.80 }, travel: { up: 0.10, down: 0.12 },
        toeIn: 0.34, tieSide: -1, tieOff: 0.12,
        arms: { lowerIn: 0.50, lowerY: 0.24, upperIn: 0.46, upperY: 0.26, lowerF: 0.20, lowerR: 0.25, upperF: 0.12, upperR: 0.14 },
      },
    },
  },
  engine: { x: 0, y: 0.52, f: 1.30, mass: 175, span: 0.50, transverse: true },
  masses: [
    { name: 'trans', x: 0.0, y: 0.34, f: 1.05, mass: 0 + 1e-9 },
  ].filter((m) => m.mass > 1),
  refs: { front: 0.9, back: -0.9, mid: 0.0 },
  steer: { maxAngle: 0.62, ackermann: 0.9 },
  aero: { cdA: 0.64, clA: 0.0 },
  drive: {
    layout: 'FWD',
    transverse: true,
    abs: true,
    engine: {
      inertia: 0.17, idle: 850, redline: 6900, brakeBase: 16, brakePerKrpm: 5.5,
      curve: [[0, 0], [500, 40], [800, 110], [1000, 125], [1500, 150], [2000, 165], [3000, 180], [4000, 190], [4800, 193], [5500, 190], [6200, 176], [6800, 158], [7300, 130]],
    },
    gearbox: { auto: true, ratios: [3.62, 2.19, 1.41, 1.03, 0.82, 0.67], reverse: 3.5, final: 4.1, shiftTime: 0.22 },
    clutch: { capacity: 330, start: 1100, lock: 2300, creep: 0.12 },
    diffs: { front: { type: 'lsd', preload: 25, power: 0.12, coast: 0.05 }, rear: null, center: { split: 1 } },
  },
  info: { title: 'Kestrel S', cls: 'Compact sedan', power: '152 hp', drive: 'FWD', engine: '2.0L I4', weight: 1260 },
  visual: {
    paint: 0x2c5fa8, kind: 'sedan',
    glass: { wind: [0.45, 1.07], rear: [-1.5, -0.8], side: [[-0.15, 0.9], [-1.0, -0.3]] },
    doors: [[-0.22, 0.98], [-1.12, -0.28]],
    panels: [[1.12, 2.12], [-2.05, -1.55]],
    wheel: { style: 'sedan', rimRadius: 0.203, color: 0xc4c8cf, caliper: 0xb02a2a },
    camera: { dist: 6.6, height: 2.2, eye: [-0.38, 1.22, 0.05], hood: [0, 1.3, 1.25] },
  },
};

export function buildKestrel() { return assemble(kestrelSpec); }
