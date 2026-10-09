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
const w = v.wheels[0];
const rack = bp.names.get('fl_rack');
const P=(i)=>[v.pos[3*i],v.pos[3*i+1],v.pos[3*i+2]];
const D=(a,b)=>{const p=P(a),q=P(b);return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);};
// design distances for knuckle beams
const pairs=[['hubIn','hubOut'],['hubIn','tie'],['hubOut','tie'],['hubIn','kup'],['hubIn','klo'],['hubOut','kup'],['hubOut','klo'],['tie','kup'],['tie','klo'],['kup','klo']];
const base = pairs.map(([a,b])=>D(w[a],w[b]));
for (let i = 0; i < 1100; i++) {
  sim.step();
  if (i % 100 === 0) {
    console.log(`t=${(i/2000).toFixed(3)} `+pairs.map(([a,b],k)=>`${a[0]}${a.slice(-2)}-${b.slice(0,3)}:${((D(w[a],w[b])-base[k])*1000).toFixed(0)}`).join(' ')+` rod:${((D(rack,w.tie)-0.375)*1000).toFixed(0)}mm`);
  }
}
