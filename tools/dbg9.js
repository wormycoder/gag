import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const bp = buildKestrel();
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
const T = parseFloat(process.argv[2]||'900');
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
const w = v.wheels[0];
const P=(i)=>[v.pos[3*i],v.pos[3*i+1],v.pos[3*i+2]];
const nm=(n)=>bp.names.get(n);
for (let i = 0; i < 400; i++) {
  sim.step();
  if (i % 50 === 0) { const hi=P(w.hubIn), ho=P(w.hubOut), kt=P(w.tie), ku=P(w.kup), kl=P(w.klo);
    console.log(`t=${(i/2000).toFixed(3)} hi=${hi.map(x=>x.toFixed(3))} ho=${ho.map(x=>x.toFixed(3))} tie=${kt.map(x=>x.toFixed(3))} kup=${ku.map(x=>x.toFixed(3))} klo=${kl.map(x=>x.toFixed(3))}`); }
}
const arr=[]; for (let b=0;b<v.bc;b++){ const a=v.b1[b], c=v.b2[b]; const names=[v.nodeNames[a],v.nodeNames[c]]; if (!names.some(n=>n.startsWith('fl_k')||n.startsWith('fl_h')||n.startsWith('fl_tie'))) continue; if (names.some(n=>n.startsWith('fl_t')&&n!=='fl_tie'&&n!=='fl_tower')) continue; arr.push([v.bforce[b], b, names.join('-'), v.btype[b], v.K[b]]); }
arr.sort((x,y)=>Math.abs(y[0])-Math.abs(x[0]));
console.log(arr.slice(0,14).map(x=>`${x[2]} F=${x[0].toFixed(0)} t${x[3]}`).join('\n'));
