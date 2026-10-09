import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
v.input.throttle = 1;
for (let i = 0; i < 6000; i++) {
  sim.step();
  if (i % 400 === 0) { v.frameUpdate(0.2); console.log(`t=${(i/2000).toFixed(2)} sp=${(v.frame.speed*3.6).toFixed(1)} rpm=${v.drive.rpm.toFixed(0)} eng=${v.drive.clutchEng.toFixed(2)} Tw=${Array.from(v.drive.torque).map(x=>x.toFixed(0))} om=${v.wheels.map(w=>w.omega.toFixed(1))} vF=${v.wheels.map(w=>w.vFwd.toFixed(2))} fwd=${v.frame.f.map(x=>x.toFixed(2))}`); }
}
