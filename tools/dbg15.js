import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const bp = buildKestrel();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.input.throttle = 1;
const names=['laf','lar','uaf','uar','rack','kup','klo','tie','kfr','hi','ho'];
const loc=(n)=>{ v.updateFrame(); const i=bp.names.get('fl_'+n); const fr=v.frame; const d=[0,1,2].map(k=>v.pos[3*i+k]-fr.com[k]); return [d[0]*fr.r[0]+d[1]*fr.r[1]+d[2]*fr.r[2], d[0]*fr.u[0]+d[1]*fr.u[1]+d[2]*fr.u[2], d[0]*fr.f[0]+d[1]*fr.f[1]+d[2]*fr.f[2]]; };
let base=null;
for (let i = 0; i < 2000*4.2; i++) { sim.step();
  if (i===3999) base=names.map(loc);
  if (i===7999 || i===8399) { const cur=names.map(loc); console.log('t',i/2000, names.map((n,k)=>n+':'+cur[k].map((x,j)=>((x-base[k][j])*1000).toFixed(0)).join(',')).join('  ')); } }
const arr=[]; for (let b=0;b<v.bc;b++){ const an=v.nodeNames[v.b1[b]], bn=v.nodeNames[v.b2[b]]; if(!an.startsWith('fl_')||!bn.startsWith('fl_')) continue; if(/_t[io]\d/.test(an+bn)) continue; arr.push([v.bforce[b], an+'-'+bn, v.K[b], v.btype[b], v.L0[b]]); }
arr.sort((x,y)=>Math.abs(y[0])-Math.abs(x[0]));
console.log(arr.slice(0,14).map(x=>`${x[1]} F=${x[0].toFixed(0)} k=${x[2].toExponential(1)} L0=${x[4].toFixed(3)}`).join('\n'));
