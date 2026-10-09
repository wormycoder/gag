import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'bruiser'; const V0 = parseFloat(process.argv[3]||'60')/3.6;
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -V0;
const toe=(w)=>{ const fr=v.frame; return Math.atan2(w.axis[0]*fr.f[0]+w.axis[1]*fr.f[1]+w.axis[2]*fr.f[2], -(w.axis[0]*fr.r[0]+w.axis[1]*fr.r[1]+w.axis[2]*fr.r[2]))*180/Math.PI; };
for (let i = 0; i < 2000*6; i++) { sim.step(); if (i%500===0){ v.frameUpdate(0.2); v.updateWheels(); const f=v.frame; console.log(`t=${(i/2000).toFixed(2)} hd=${(Math.atan2(f.f[0],-f.f[2])*180/Math.PI).toFixed(2)} toe=${v.wheels.map(w=>toe(w).toFixed(2))} y=${f.com[1].toFixed(3)} roll=${(Math.asin(f.r[1])*57.3).toFixed(2)}`);} }
