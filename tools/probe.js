import { buildKestrel } from '../src/vehicles/kestrel.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { Simulation } from '../src/physics/sim.js';
import { flatWorld } from '../src/physics/terrain.js';

const t0 = performance.now();
const bp = buildKestrel();
console.log('built in', (performance.now() - t0).toFixed(0), 'ms; nodes', bp.nodeCount, 'beams', bp.beamCount, 'mass', bp.mass.reduce((a,b)=>a+b,0).toFixed(1));
const world = flatWorld(200, 4, 0);
const sim = new Simulation(world, { dt: 1 / 2000 });
const v = new Vehicle(bp);
v.place(0, 0, 0, world, 0.02);
sim.add(v);
v.keepAwake = true;
const log = (t) => {
  const f = v.frame;
  let lo = 1e9; for (const w of v.wheels) lo = Math.min(lo, w.center[1]);
  console.log(`t=${t.toFixed(2)} com=(${f.com.map(x=>x.toFixed(2))}) hubY=${v.wheels.map(w=>w.center[1].toFixed(3))} maxV=${Math.sqrt(v.maxSpeedSq).toFixed(2)} alive=${v.alive}`);
};
const t1 = performance.now();
for (let i = 0; i < 4000; i++) { sim.step(); if (i % 500 === 499) { v.frameUpdate(0.25); log(sim.time); } }
console.log('4000 steps in', (performance.now() - t1).toFixed(0), 'ms');
