import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const mode = process.argv[2];
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
if (mode === 'noreact') for (const w of v.wheels) w.reactNodes = null;
if (mode === 'noeng') v.refs.engineA = -1;
for (let i = 0; i < 1000; i++) sim.step();
v.input.throttle = 1;
for (let i = 0; i < 5000; i++) {
  sim.step();
  if (i % 500 === 0) { v.frameUpdate(0.2); console.log(`t=${(i/2000).toFixed(2)} sp=${(v.frame.speed*3.6).toFixed(1)} rpm=${v.drive.rpm.toFixed(0)} vF=${v.wheels.map(w=>w.vFwd.toFixed(2))} om=${v.wheels.map(w=>(w.omega*w.radius).toFixed(1))}`); }
}
