import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(1000, 4, 0);
const bp = buildKestrel();
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
const fOf = (i) => -v.pos[3*i+2];
const hubRel = () => v.wheels.map(w => (-(w.center[2]) - 0).toFixed(2));
v.input.throttle = 1;
for (let i = 0; i < 2500; i++) {
  sim.step();
  if (i % 250 === 0) { v.frameUpdate(0.2);
    const bf = v.refs.front, bb = v.refs.back;
    console.log(`t=${(i/2000).toFixed(2)} def=${v.damage.deformed} brk=${v.damage.broken} frontNodeF=${fOf(bf).toFixed(2)} backNodeF=${fOf(bb).toFixed(2)} hubF=${v.wheels.map(w=>(-w.center[2]).toFixed(2))} hubY=${v.wheels.map(w=>w.center[1].toFixed(2))} cg y=${v.frame.com[1].toFixed(2)} bodyPitch=${(v.frame.f[1]).toFixed(3)}`); }
}
// find worst strained beams
const arr=[]; for (let b=0;b<v.bc;b++){ if (v.btype[b]===3) continue; const a=v.b1[b], c=v.b2[b]; const len=Math.hypot(v.pos[3*a]-v.pos[3*c], v.pos[3*a+1]-v.pos[3*c+1], v.pos[3*a+2]-v.pos[3*c+2]); arr.push([(len-v.L0[b])*v.K[b], b]); }
arr.sort((x,y)=>Math.abs(y[0])-Math.abs(x[0]));
for (const [F,b] of arr.slice(0,10)) console.log('beam',b,v.nodeNames[v.b1[b]],v.nodeNames[v.b2[b]],'F',F.toFixed(0),'type',v.btype[b],'defF',v.defF[b]);
