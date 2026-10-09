import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
const T = parseFloat(process.argv[2]||'900');
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
for (let i = 0; i < 1500; i++) {
  sim.step();
  if (i % 100 === 0) { v.updateWheels(); v.updateFrame(); const w = v.wheels[0]; const fr=v.frame; const toe = Math.atan2(w.axis[0]*fr.f[0]+w.axis[1]*fr.f[1]+w.axis[2]*fr.f[2], -(w.axis[0]*fr.r[0]+w.axis[1]*fr.r[1]+w.axis[2]*fr.r[2]))*180/Math.PI;
    let minr=9, maxr=0; for (const n of w.treadOut){ const o=3*n; const rx=v.pos[o]-w.center[0], ry=v.pos[o+1]-w.center[1], rz=v.pos[o+2]-w.center[2]; const d=rx*w.axis[0]+ry*w.axis[1]+rz*w.axis[2]; const r=Math.sqrt(rx*rx+ry*ry+rz*rz-d*d); minr=Math.min(minr,r); maxr=Math.max(maxr,r);} 
    console.log(`t=${(i/2000).toFixed(3)} toe(deg)=${toe.toFixed(1)} rmin=${minr.toFixed(3)} rmax=${maxr.toFixed(3)} sp=${fr.speed.toFixed(2)} om=${w.omega.toFixed(1)} def=${v.damage.deformed} brk=${v.damage.broken}`); }
}
