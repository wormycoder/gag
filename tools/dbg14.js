import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(3000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
v.input.throttle = 1;
const toe=(w)=>{ const fr=v.frame; return Math.atan2(w.axis[0]*fr.f[0]+w.axis[1]*fr.f[1]+w.axis[2]*fr.f[2], -(w.axis[0]*fr.r[0]+w.axis[1]*fr.r[1]+w.axis[2]*fr.r[2]))*180/Math.PI; };
for (let i = 0; i < 2000*10; i++) {
  sim.step();
  if (i % 1000 === 0 && i >= 4000) { v.frameUpdate(0.2); const f=v.frame; v.updateWheels(); const hd=Math.atan2(f.f[0],-f.f[2])*180/Math.PI;
    console.log(`t=${(i/2000).toFixed(1)} v=${(f.speed*3.6).toFixed(0)} hd=${hd.toFixed(2)} x=${f.com[0].toFixed(1)} toeFL/FR=${toe(v.wheels[0]).toFixed(1)}/${toe(v.wheels[1]).toFixed(1)} Tq=${Array.from(v.drive.torque).slice(0,2).map(x=>x.toFixed(0))} load=${v.wheels.slice(0,2).map(w=>w.load.toFixed(0))} slip=${v.wheels.slice(0,2).map(w=>((w.omega*w.radius-w.vFwd)/Math.max(1,w.vFwd)).toFixed(2))}`); }
}
