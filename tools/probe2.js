import { buildKestrel } from '../src/vehicles/kestrel.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { Simulation } from '../src/physics/sim.js';
import { flatWorld } from '../src/physics/terrain.js';
import { settleBlueprint } from '../src/physics/settle.js';

const bp = buildKestrel();
let t0 = performance.now();
settleBlueprint(bp, { verbose: true });
console.log('settle took', (performance.now() - t0).toFixed(0), 'ms');
const world = flatWorld(200, 4, 0);
const sim = new Simulation(world, { dt: 1 / 2000 });
const v = new Vehicle(bp);
v.place(0, 0, 0, world, 0.0);
sim.add(v); v.keepAwake = true;
for (let i = 0; i < 4000; i++) { sim.step(); if (i % 1000 === 999) { v.frameUpdate(0.25); console.log(`t=${sim.time.toFixed(2)} com y=${v.frame.com[1].toFixed(3)} hubY=${v.wheels.map(w=>w.center[1].toFixed(3))} maxV=${Math.sqrt(v.maxSpeedSq).toFixed(3)} loads=${v.wheels.map(w=>(w.load).toFixed(0))}`); } }
