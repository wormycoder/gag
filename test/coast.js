import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'kestrel';
const V0 = (parseFloat(process.argv[3] || '100')) / 3.6;
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -V0;
let prev = null;
for (let i = 0; i < 2000 * 12; i++) {
  sim.step();
  if (i % 2000 === 0) { v.frameUpdate(0.2); const f=v.frame; const heading = Math.atan2(f.f[0], -f.f[2])*180/Math.PI; console.log(`t=${(i/2000).toFixed(1)} v=${(f.speed*3.6).toFixed(1)} x=${f.com[0].toFixed(2)} z=${f.com[2].toFixed(1)} heading=${heading.toFixed(2)}deg y=${f.com[1].toFixed(3)} decel=${prev===null?'-':((prev-f.speed)/1).toFixed(2)}`); prev=f.speed; }
}
