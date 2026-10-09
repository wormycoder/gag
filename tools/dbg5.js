import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const T = parseFloat(process.argv[2] || '300');
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
for (let i = 0; i < 8000; i++) {
  sim.step();
  if (i % 500 === 0) { v.frameUpdate(0.2); console.log(`t=${(i/2000).toFixed(2)} sp=${(v.frame.speed).toFixed(2)} om*R=${v.wheels.map(w=>(w.omega*w.radius).toFixed(2))} vF=${v.wheels.map(w=>w.vFwd.toFixed(2))}`); }
}
