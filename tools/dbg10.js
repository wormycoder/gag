import { setup } from './drive.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';
import { flatWorld } from '../src/physics/terrain.js';
const mode = process.argv[2]; const T = parseFloat(process.argv[3]||'900');
const bp = buildKestrel();
const world = flatWorld(1000, 4, 0);
const { sim, v } = setup(bp, world);
if (mode==='rod') for (const sb of v.steerBeams) v.K[sb.beam]*=6;
if (mode==='nospin') {}
for (let i = 0; i < 1000; i++) sim.step();
const tq = new Float64Array(4); tq[0] = T; tq[1] = T;
v.drive.update = () => tq;
for (let i = 0; i < 1600; i++) {
  sim.step();
  if (i % 200 === 0) { v.updateWheels(); v.updateFrame(); const w = v.wheels[0]; const fr=v.frame; const toe = Math.atan2(w.axis[0]*fr.f[0]+w.axis[1]*fr.f[1]+w.axis[2]*fr.f[2], -(w.axis[0]*fr.r[0]+w.axis[1]*fr.r[1]+w.axis[2]*fr.r[2]))*180/Math.PI;
    console.log(`${mode} t=${(i/2000).toFixed(3)} toe=${toe.toFixed(1)} sp=${fr.speed.toFixed(2)} om*R=${(w.omega*w.radius).toFixed(2)} Fz_wheel=${w.load.toFixed(0)}`); }
}
