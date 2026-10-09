import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const T = parseFloat(process.argv[2]||'900');
const bp = buildKestrel();
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
const names=['fl_laf','fl_lar','fl_uaf','fl_uar','fl_rack','fl_tower','fl_kup','fl_klo','fl_tie','fl_hi','fl_ho'];
const loc=(n)=>{ v.updateFrame(); const i=bp.names.get(n); const fr=v.frame; const d=[0,1,2].map(k=>v.pos[3*i+k]-fr.com[k]); return [d[0]*fr.r[0]+d[1]*fr.r[1]+d[2]*fr.r[2], d[0]*fr.u[0]+d[1]*fr.u[1]+d[2]*fr.u[2], d[0]*fr.f[0]+d[1]*fr.f[1]+d[2]*fr.f[2]]; };
const show=(t)=>console.log('t='+t.toFixed(2)+' '+names.map(n=>n.slice(3)+':'+loc(n).map(x=>x.toFixed(2)).join(',')).join(' | '));
show(0);
for (let i = 0; i < 1100; i++) { sim.step(); if (i%250===249) show(i/2000); }
