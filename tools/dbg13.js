import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const F = parseFloat(process.argv[2]||'3000');
const bp = buildKestrel();
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(bp, world);
v.drive.gear=0; v.drive.dir='N';
for (let i = 0; i < 2000; i++) sim.step();
const w = v.wheels[0];
const zeros = new Float64Array(4);
// brake car to hold: use handbrake? instead hold the body by applying the opposite force on the body ring
v.drive.update = () => { v.frc[3*w.hubIn+2] -= F*0.5; v.frc[3*w.hubOut+2] -= F*0.5; // forward = -z
  // reaction on body (front) to keep car in place
  const f = v.refs.front; v.frc[3*f+2] += F; return zeros; };
const P=(n)=>{const i=bp.names.get(n); return [v.pos[3*i],v.pos[3*i+1],v.pos[3*i+2]];};
const snap=()=>['fl_kup','fl_klo','fl_tie','fl_hi','fl_ho','fl_laf','fl_rack'].map(n=>P(n));
const s0=snap();
for (let i = 0; i < 3000; i++) sim.step();
const s1=snap();
['kup','klo','tie','hi','ho','laf','rack'].forEach((n,i)=>console.log(n, s1[i].map((x,k)=>((x-s0[i][k])*1000).toFixed(1)).join(' ')));
