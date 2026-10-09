import { setup } from './drive.js';
import { NF } from '../src/physics/vehicle.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'vulcan';
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
const rear = v.wheels.filter((w) => w.axle === 'rear');
const set = new Set(rear.flatMap((w) => [...w.treadAll]));
let Fn = 0, Ft = 0, n = 0;
const orig = v._contact.bind(v);
v._contact = (i, nx, ny, nz, pen, mu, dt, isTire) => {
  const fx = v.frc[3*i], fy = v.frc[3*i+1], fz = v.frc[3*i+2];
  orig(i, nx, ny, nz, pen, mu, dt, isTire);
  if (set.has(i)) { Fn += v.frc[3*i+1] - fy; Ft += -(v.frc[3*i+2] - fz); }
};
v.input.throttle = 1;
for (let i = 0; i < 2000 * 3; i++) {
  sim.step(); n++;
  if (i % 1000 === 999) { v.frameUpdate(0.1); console.log(`t=${(i/2000).toFixed(1)} v=${(v.frame.speed*3.6).toFixed(1)} rearSlip=${rear.map(w=>((w.omega*w.radius-w.vFwd)/Math.max(1,Math.abs(w.vFwd))).toFixed(2))} mean Fn=${(Fn/1000).toFixed(0)} Ft=${(Ft/1000).toFixed(0)} => mu_eff ${(Ft/Fn).toFixed(2)}  (thrust ${(Ft/1000/2).toFixed(0)}N/ratio)`); Fn = Ft = 0; }
}
