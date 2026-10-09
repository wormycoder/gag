import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(buildKestrel(), world);
for (let i = 0; i < 1000; i++) sim.step();
const tq = new Float64Array(4); tq[0] = 900; tq[1] = 900;
v.drive.update = () => tq;
for (let i = 0; i < 1500; i++) sim.step();
// step once with force snapshot
sim.step();
const w = v.wheels[0];
console.log('hub vz', v.vel[3*w.hubOut+2].toFixed(2), 'omega', w.omega.toFixed(1));
for (const n of [...w.treadOut]) {
  const o = 3*n; if (v.nfn[n] <= 0) continue;
  console.log(v.nodeNames[n], 'y', v.pos[o+1].toFixed(3), 'vz', v.vel[o+2].toFixed(2), 'vy', v.vel[o+1].toFixed(2), 'fn', v.nfn[n].toFixed(0), 'Fz_total', v.frc[o+2].toFixed(0), 'Fy', v.frc[o+1].toFixed(0), 'm', v.mass[n]);
}
const cx=w.center; const a=w.axis;
console.log('axis', a.map(x=>x.toFixed(2)), 'center', cx.map(x=>x.toFixed(3)));
w.treadOut.forEach((n,i)=>{ const o=3*n; const rx=v.pos[o]-cx[0], ry=v.pos[o+1]-cx[1], rz=v.pos[o+2]-cx[2]; const r=Math.hypot(ry,rz); const ang=Math.atan2(ry, -rz)*180/Math.PI; // angle from forward
 const ux=v.vel[o]-(v.vel[3*w.hubIn]+v.vel[3*w.hubOut])/2, uy=v.vel[o+1]-(v.vel[3*w.hubIn+1]+v.vel[3*w.hubOut+1])/2, uz=v.vel[o+2]-(v.vel[3*w.hubIn+2]+v.vel[3*w.hubOut+2])/2;
 const cxp=ry*uz-rz*uy, cyp=rz*ux-rx*uz, czp=rx*uy-ry*ux; const om=(cxp*a[0]+cyp*a[1]+czp*a[2])/(r*r);
 console.log('node',i,'ang',ang.toFixed(0),'r',r.toFixed(3),'omega_i',om.toFixed(1)); });
