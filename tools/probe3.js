import { buildKestrel } from '../src/vehicles/kestrel.js';
import { Vehicle, NF } from '../src/physics/vehicle.js';
import { Simulation } from '../src/physics/sim.js';
import { flatWorld } from '../src/physics/terrain.js';
import { settleBlueprint } from '../src/physics/settle.js';
const bp = buildKestrel();
settleBlueprint(bp, { iterations: 8, seconds: 1.5, verbose: true });
const world = flatWorld(200, 4, 0);
const sim = new Simulation(world, { dt: 1 / 2000 });
const v = new Vehicle(bp);
v.place(0, 0, 0, world, 0.0);
sim.add(v); v.keepAwake = true;
for (let i = 0; i < 6000; i++) sim.step();
let tire=0, body=0, bodyN=0;
for (let i=0;i<v.nc;i++){ if (v.nflags[i]&NF.TIRE) tire+=v.nfn[i]; else if (v.nfn[i]>0){ body+=v.nfn[i]; bodyN++; } }
console.log('tire N', tire.toFixed(0), 'body N', body.toFixed(0), bodyN, 'weight', (v.totalMass*9.81).toFixed(0));
for (const i of v.springBeams) { const a=v.b1[i], b=v.b2[i]; const len=Math.hypot(v.pos[3*a]-v.pos[3*b], v.pos[3*a+1]-v.pos[3*b+1], v.pos[3*a+2]-v.pos[3*b+2]); console.log('spring', i, 'len', len.toFixed(3), 'lo', v.lo[i].toFixed(3), 'hi', v.hi[i].toFixed(3), 'L0', v.L0[i].toFixed(3), 'F', v.bforce[i].toFixed(0)); }
console.log('hubY', v.wheels.map(w=>w.center[1].toFixed(3)).join(' '));
for (let i=0;i<v.nc;i++){ if (!(v.nflags[i]&NF.TIRE) && v.nfn[i]>0) console.log('body contact', v.nodeNames[i], v.pos[3*i+1].toFixed(3), v.nfn[i].toFixed(0), 'mass', v.mass[i].toFixed(2)); }
console.log('floor-center y per section (rest vs design):');
for (let s=0;s<15;s++){ const i=bp.names.get(`b${s}_0`); const j=bp.names.get(`b${s}_6`); console.log(s, 'f=', (-v.pos[3*i+2]).toFixed(2), 'floor', v.pos[3*i+1].toFixed(3), '(', v.pos0[3*i+1].toFixed(3), ') roof', v.pos[3*j+1].toFixed(3), '(', v.pos0[3*j+1].toFixed(3), ')'); }
const tn = bp.names.get('fl_tower');
console.log('tower design y', v.pos0[3*tn+1].toFixed(3), 'now', v.pos[3*tn+1].toFixed(3));
for (let b=0;b<v.bc;b++){ if (v.b1[b]===tn||v.b2[b]===tn){ const a=v.b1[b], c=v.b2[b]; const len=Math.hypot(v.pos[3*a]-v.pos[3*c], v.pos[3*a+1]-v.pos[3*c+1], v.pos[3*a+2]-v.pos[3*c+2]); console.log(' beam', b, v.nodeNames[a], v.nodeNames[c], 'len', len.toFixed(3), 'L0', v.L0[b].toFixed(3), 'Lorig', v.Lorig[b].toFixed(3), 'type', v.btype[b], 'force', v.bforce[b].toFixed(0)); } }
const arr=[]; for (let b=0;b<v.bc;b++){ const a=v.b1[b], c=v.b2[b]; const len=Math.hypot(v.pos[3*a]-v.pos[3*c], v.pos[3*a+1]-v.pos[3*c+1], v.pos[3*a+2]-v.pos[3*c+2]); arr.push([(len-v.L0[b])/v.L0[b], b, len-v.L0[b]]); }
arr.sort((x,y)=>Math.abs(y[0])-Math.abs(x[0]));
for (const [s,b,d] of arr.slice(0,12)) console.log('beam',b,v.nodeNames[v.b1[b]],v.nodeNames[v.b2[b]],'strain',s.toFixed(3),'d(mm)',(d*1000).toFixed(1),'k',v.K[b],'F',(v.K[b]*d).toFixed(0), 'type', v.btype[b]);
console.log('deformed', v.damage.deformed, 'broken', v.damage.broken);
for (const s of [6,10]) { console.log('section',s); for (let j=0;j<12;j++){ const i=bp.names.get(`b${s}_${j}`); console.log(' j',j,'y',v.pos[3*i+1].toFixed(3),'design',v.pos0[3*i+1].toFixed(3),'x',v.pos[3*i].toFixed(3),v.pos0[3*i].toFixed(3),'mass',v.mass[i].toFixed(1)); } const c=bp.names.get(`c${s}`); console.log(' c y',v.pos[3*c+1].toFixed(3),v.pos0[3*c+1].toFixed(3),'mass',v.mass[c].toFixed(1)); }
