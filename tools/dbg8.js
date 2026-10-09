import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const bp = buildKestrel();
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
const rack = bp.names.get('fl_rack'), tie = bp.names.get('fl_tie');
let rb=-1; for (let b=0;b<v.bc;b++) if ((v.b1[b]===rack&&v.b2[b]===tie)||(v.b2[b]===rack&&v.b1[b]===tie)) rb=b;
console.log('rod beam', rb, 'k', v.K[rb], 'L0', v.L0[rb]);
const T = parseFloat(process.argv[2]||'900');
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
const P=(i)=>[v.pos[3*i],v.pos[3*i+1],v.pos[3*i+2]];
for (let i = 0; i < 700; i++) {
  sim.step();
  if (i % 70 === 0) { const a=P(rack), b=P(tie); const len=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    console.log(`t=${(i/2000).toFixed(3)} rodLen=${len.toFixed(4)} L0=${v.L0[rb].toFixed(4)} F=${v.bforce[rb].toFixed(0)} rack=${a.map(x=>x.toFixed(3))} tie=${b.map(x=>x.toFixed(3))} steerAng=${v.steerAngle}`); }
}
console.log('table', bp.steerTables[0].values.filter((_, i) => i % 5 === 0).map(x=>x.toFixed(3)).join(' '));
