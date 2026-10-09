import { setup } from './drive.js';
import { flatWorld } from '../src/physics/terrain.js';
const mod = await import(`../src/vehicles/bruiser.js`);
const bp = mod.buildBruiser();
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -60/3.6;
const P=(n)=>{const i=bp.names.get(n); return [v.pos[3*i],v.pos[3*i+1],v.pos[3*i+2]];};
for (let i = 0; i < 2000*2; i++) { sim.step(); if (i%250===0){ v.frameUpdate(0.2); v.updateWheels();
  const aL=P('fl_alo'), aR=P('fr_alo'); const axleYaw=Math.atan2(aR[2]-aL[2], aR[0]-aL[0])*57.3;
  const tL=P('fl_tie'), kL=P('fl_klo'); const rack=P('fl_rack');
  const rod=Math.hypot(...[0,1,2].map(k=>tL[k]-rack[k]));
  const hi=P('fl_hi'), ho=P('fl_ho'); const knuckleYaw=Math.atan2(ho[2]-hi[2], ho[0]-hi[0])*57.3;
  console.log(`t=${(i/2000).toFixed(2)} axleYaw=${axleYaw.toFixed(2)} fl_knuckleYaw=${knuckleYaw.toFixed(2)} rod=${rod.toFixed(4)} y_alo=${aL[1].toFixed(3)}/${aR[1].toFixed(3)}`);} }
