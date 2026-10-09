import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'kestrel';
const abs = process.argv[3] !== 'noabs';
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.abs = abs;
v.drive.gear = 0; v.drive.dir = 'N';
const V0 = 80 / 3.6;
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -V0;
for (let i = 0; i < 4000; i++) sim.step(); // let wheels spin up, coast
v.updateFrame(); const s0 = v.frame.speed; const z0 = v.frame.com[2];
v.input.brake = 1;
let t = 0;
for (let i = 0; i < 2000 * 8; i++) {
  sim.step();
  if (i % 400 === 0) { v.frameUpdate(0.2); console.log(`t=${(i/2000).toFixed(2)} v=${(v.frame.speed*3.6).toFixed(1)} slip=${v.wheels.map(w=>((w.omega*w.radius-w.vFwd)/Math.max(0.5,Math.abs(w.vFwd))).toFixed(2))} lateralX=${v.frame.com[0].toFixed(2)}`); }
  v.frameUpdate(0);
  if (v.frame.speed < 0.3) { t = i / 2000; break; }
}
const dist = Math.abs(v.frame.com[2] - z0);
console.log(`stop time ${t.toFixed(2)} s, distance ${dist.toFixed(1)} m  from ${(s0*3.6).toFixed(0)} km/h  avg decel ${(s0*s0/2/dist/9.81).toFixed(2)} g`);
