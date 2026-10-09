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
let Pn = 0, Pf = 0, steps = 0;
const orig = v._contact.bind(v);
v._contact = (i, nx, ny, nz, pen, mu, dt, isTire) => {
  const f0x = v.frc[3*i], f0y = v.frc[3*i+1], f0z = v.frc[3*i+2];
  orig(i, nx, ny, nz, pen, mu, dt, isTire);
  const dx = v.frc[3*i]-f0x, dy = v.frc[3*i+1]-f0y, dz = v.frc[3*i+2]-f0z;
  const vx = v.vel[3*i], vy = v.vel[3*i+1], vz = v.vel[3*i+2];
  // power on node = F.v ; normal vs tangential split
  const fn = dx*nx+dy*ny+dz*nz; const vn = vx*nx+vy*ny+vz*nz;
  Pn += fn*vn; Pf += (dx*vx+dy*vy+dz*vz) - fn*vn;
};
for (let i = 0; i < 4000; i++) { sim.step(); steps++; }
v.frameUpdate(0.1);
const T = steps*sim.dt;
console.log('v', (v.frame.speed*3.6).toFixed(1), 'normal contact power', (Pn/steps/1000).toFixed(2), 'kW; tangential (friction)', (Pf/steps/1000).toFixed(2), 'kW =>', (-Pf/steps/v.frame.speed).toFixed(0), 'N equiv');
