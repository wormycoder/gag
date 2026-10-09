import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N'; v.drive.auto = true;
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -10;   // 10 m/s forward
for (let i = 0; i < 12000; i++) {
  sim.step();
  if (i % 1000 === 0) { v.frameUpdate(0.2); console.log(`t=${(i/2000).toFixed(2)} sp=${(v.frame.speed).toFixed(2)} om*R=${v.wheels.map(w=>(w.omega*w.radius).toFixed(2))} loads=${v.wheels.map(w=>w.load.toFixed(0))}`); }
}
