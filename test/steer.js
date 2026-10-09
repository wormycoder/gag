import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'kestrel';
const speed = parseFloat(process.argv[3] || '50') / 3.6;
const steer = parseFloat(process.argv[4] || '0.3');
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -speed;
for (let i = 0; i < 2000; i++) sim.step();
v.input.steer = steer;
let prevHd = null;
for (let i = 0; i < 2000 * 6; i++) {
  sim.step();
  if (i % 1000 === 0) {
    v.frameUpdate(0.2); const f = v.frame;
    const hd = Math.atan2(f.f[0], -f.f[2]);
    const yawRate = prevHd === null ? 0 : (hd - prevHd) * 2;
    prevHd = hd;
    const lat = speed * 0; 
    const roll = Math.asin(f.r[1]) * 180 / Math.PI;
    console.log(`t=${(i/2000).toFixed(1)} v=${(f.speed*3.6).toFixed(1)} yawRate=${(yawRate*180/Math.PI).toFixed(1)}deg/s a_lat=${(f.speed*yawRate).toFixed(2)} (${(f.speed*yawRate/9.81).toFixed(2)}g) roll=${roll.toFixed(1)} wheelLoads=${v.wheels.map(w=>w.load.toFixed(0))}`);
  }
}
