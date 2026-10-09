import { Vehicle } from '../src/physics/vehicle.js';
import { Simulation } from '../src/physics/sim.js';
import { flatWorld } from '../src/physics/terrain.js';
import { settleBlueprint } from '../src/physics/settle.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
const bp = buildKestrel(); settleBlueprint(bp);
const world = flatWorld(3000, 4, 0);
const sim = new Simulation(world); const v = new Vehicle(bp); v.place(0,0,0,world,0); sim.add(v); v.keepAwake = true;
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
const V0 = 80/3.6; for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -V0;
for (let i = 0; i < 4000; i++) sim.step();
const cat = (b) => { const a = v.nodeNames[v.b1[b]], c = v.nodeNames[v.b2[b]]; const nm = a + c;
  if (/^[a-z]{2}_t[io]\d+/.test(a) && /^[a-z]{2}_t[io]\d+/.test(c)) return 'tire-ring'; if (/_t[io]\d+/.test(nm)) return 'tire-spoke';
  if (v.btype[b] === 2) return 'susp-damper'; if (/^[bc]\d/.test(a) && /^[bc]\d/.test(c)) return 'body'; return 'other'; };
const cats = Array.from({length: v.bc}, (_, b) => cat(b));
const E = {}; let steps = 0; let contactP = 0;
const k0 = 0.5 * v.totalMass * v.frame.speed ** 2;
for (let i = 0; i < 4000; i++) {
  sim.step(); steps++;
  for (let b = 0; b < v.bc; b++) {
    const a = 3*v.b1[b], c = 3*v.b2[b];
    let dx=v.pos[c]-v.pos[a], dy=v.pos[c+1]-v.pos[a+1], dz=v.pos[c+2]-v.pos[a+2]; const l=Math.hypot(dx,dy,dz); dx/=l;dy/=l;dz/=l;
    const vr=(v.vel[c]-v.vel[a])*dx+(v.vel[c+1]-v.vel[a+1])*dy+(v.vel[c+2]-v.vel[a+2])*dz;
    const cc = v.btype[b]===2 ? (vr<0?v.C[b]:v.CReb[b]) : v.C[b];
    E[cats[b]] = (E[cats[b]]||0) + Math.min(cc, v.cMax[b]) * vr * vr * sim.dt;
  }
}
v.frameUpdate(0.1);
const T = steps * sim.dt;
console.log('window', T, 's; v', (v.frame.speed*3.6).toFixed(1));
for (const k in E) console.log(k.padEnd(12), (E[k]/T/1000).toFixed(2), 'kW', '=', (E[k]/T/v.frame.speed).toFixed(0), 'N equiv');
console.log('slip energy rate', (v.slipEnergy/ (steps*sim.dt+1)).toFixed(0));
