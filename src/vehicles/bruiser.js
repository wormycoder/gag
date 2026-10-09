// Bruiser 4x4 — crew-cab pickup with live axles, coil springs, a locking centre
// diff and a low-range transfer case.

import { assemble } from './assemble.js';

// The bed is modelled with a U-shaped cross-section (walls + floor) so it stays open.
const bed = (f, zt = 0.9) => ({ f, zb: 0.42, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.18, wg: 0.94, zg: 1.18, wr: 0.94, zt, crown: 0 });
const solidTop = (f) => ({ f, zb: 0.42, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.18, wg: 0.94, zg: 1.18, wr: 0.5, zt: 1.18, crown: 0 });

const sections = [
  solidTop(-2.95),
  bed(-2.89),
  { ...bed(-2.55), zb: 0.40 },
  { ...bed(-2.0), zb: 0.38 },
  { ...bed(-1.4), zb: 0.36 },
  { ...bed(-0.95), zb: 0.36 },
  solidTop(-0.78),
  { f: -0.70, zb: 0.36, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.20, wg: 0.93, zg: 1.24, wr: 0.82, zt: 1.78, crown: 0.02 },
  { f: -0.45, zb: 0.36, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.20, wg: 0.93, zg: 1.24, wr: 0.84, zt: 1.93, crown: 0.03 },
  { f: 0.0, zb: 0.36, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.20, wg: 0.93, zg: 1.24, wr: 0.84, zt: 1.95, crown: 0.03 },
  { f: 0.40, zb: 0.36, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.20, wg: 0.93, zg: 1.24, wr: 0.84, zt: 1.93, crown: 0.03 },
  { f: 0.80, zb: 0.36, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.20, wg: 0.94, zg: 1.24, wr: 0.85, zt: 1.62, crown: 0.02 },
  { f: 1.20, zb: 0.38, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.16, wg: 0.94, zg: 1.17, wr: 0.85, zt: 1.22, crown: 0.02 },
  { f: 1.70, zb: 0.40, wb: 0.78, zr: 0.62, ws: 1.0, zs: 1.14, wg: 0.94, zg: 1.15, wr: 0.82, zt: 1.18, crown: 0.02 },
  { f: 2.30, zb: 0.44, wb: 0.76, zr: 0.62, ws: 0.99, zs: 1.12, wg: 0.93, zg: 1.13, wr: 0.80, zt: 1.15, crown: 0.02 },
  { f: 2.75, zb: 0.50, wb: 0.72, zr: 0.66, ws: 0.97, zs: 1.10, wg: 0.91, zg: 1.11, wr: 0.76, zt: 1.12, crown: 0.01 },
  { f: 2.95, zb: 0.52, wb: 0.68, zr: 0.68, ws: 0.93, zs: 1.06, wg: 0.88, zg: 1.07, wr: 0.70, zt: 1.08, crown: 0.01 },
];

export const bruiserSpec = {
  id: 'bruiser',
  mass: 2380,
  body: {
    sections,
    bodyK: 7e5,
    bodyDef: 22000,
    crush: [[-3.1, 0.3], [-2.6, 0.5], [-1.2, 1.4], [-0.4, 2.2], [0.8, 2.2], [1.4, 1.2], [2.4, 0.5], [3.1, 0.3]],
  },
  axle: {
    front: {
      f: 1.80, track: 1.74, type: 'solid', driven: true, steered: true, brake: 3300,
      tire: { R: 0.395, width: 0.265, mass: 24, hubMass: 14, grip: 1.0, n: 22 },
      susp: {
        spring: 92000, bump: 6500, rebound: 10000,
        frameY: 0.93, springIn: 0.30, travel: { up: 0.14, down: 0.17 },
        arms: { in: 0.42, lowerY: 0.33, upperY: 0.58, length: 0.95 },
        rackEnd: { x: 0.02, y: 0.45, f: 1.55 }, tieSide: -1, tieOff: 0.25, axleMass: 120, casterOffset: 0.0,
      },
    },
    rear: {
      f: -1.75, track: 1.76, type: 'solid', driven: true, brake: 2400, handbrake: true, handbrakeTorque: 2400,
      tire: { R: 0.395, width: 0.265, mass: 24, hubMass: 14, grip: 1.0, n: 22 },
      susp: {
        spring: 92000, bump: 6000, rebound: 9500,
        frameY: 0.93, springIn: 0.30, travel: { up: 0.14, down: 0.17 },
        arms: { in: 0.42, lowerY: 0.33, upperY: 0.58, length: 0.95 },
        axleMass: 140, armDir: -1,
      },
    },
  },
  engine: { x: 0, y: 0.70, f: 1.75, mass: 290, span: 0.55, transverse: false },
  masses: [
    { name: 'trans', x: 0, y: 0.55, f: 0.85, mass: 130 },
    { name: 'tank', x: 0.0, y: 0.50, f: -0.9, mass: 90 },
    { name: 'driver', x: -0.40, y: 1.0, f: 0.0, mass: 80 },
    { name: 'cargo', x: 0, y: 0.95, f: -2.0, mass: 60 },
  ],
  refs: { front: 1.0, back: -1.0, mid: 0.0 },
  steer: { maxAngle: 0.55, ackermann: 0.8 },
  aero: { cdA: 1.45, clA: 0.0 },
  drive: {
    layout: 'AWD',
    abs: true,
    engine: {
      inertia: 0.5, idle: 650, redline: 5900, brakeBase: 38, brakePerKrpm: 10,
      curve: [[0, 0], [400, 100], [700, 280], [1200, 420], [2000, 530], [3000, 590], [3600, 605], [4400, 590], [5200, 540], [5800, 470], [6200, 390]],
    },
    gearbox: { auto: true, ratios: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69], reverse: 3.8, final: 3.73, shiftTime: 0.3, upshift: 0.5 },
    transferLow: 2.64,
    clutch: { capacity: 1100, start: 900, lock: 1900, creep: 0.14 },
    diffs: {
      front: { type: 'lsd', preload: 40, power: 0.15, coast: 0.1 },
      rear: { type: 'lsd', preload: 60, power: 0.25, coast: 0.15 },
      center: { split: 0.4, preload: 300, lock: 0.7 },
    },
  },
  info: { title: 'Bruiser 4x4', cls: 'Crew-cab pickup', power: '420 hp', drive: '4WD', engine: '5.7L V8', weight: 2380 },
  visual: { paint: 0x3f5b3a, kind: 'pickup' },
};

export function buildBruiser() { return assemble(bruiserSpec); }
