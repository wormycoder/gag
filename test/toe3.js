import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'bruiser';
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(300, 4, 0);
const { sim, v } = setup(bp, world);
v.drive.gear = 0; v.drive.dir = 'N';
const toe=(w)=>{ const fr=v.frame; return Math.atan2(w.axis[0]*fr.f[0]+w.axis[1]*fr.f[1]+w.axis[2]*fr.f[2], -(w.axis[0]*fr.r[0]+w.axis[1]*fr.r[1]+w.axis[2]*fr.r[2]))*180/Math.PI; };
const show=(t)=>{ v.frameUpdate(0.2); v.updateWheels(); console.log(`t=${t} toe=${v.wheels.map(w=>toe(w).toFixed(2))} hubY=${v.wheels.map(w=>w.center[1].toFixed(3))}`); };
show('design');
for (let i = 0; i < 2000*3; i++) { sim.step(); if (i%1000===999) show((i/2000).toFixed(1)); }
