import { setup } from './drive.js';
import { Terrain, flatWorld } from '../src/physics/terrain.js';
const which = process.argv[2] || 'kestrel';
const kmh = parseFloat(process.argv[3] || '60');
const mod = await import(`../src/vehicles/${which}.js`);
const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
const world = flatWorld(400, 4, 0);
world.addBox({ x: 0, y: 2, z: -40, hx: 20, hy: 2, hz: 1 });
world.finalize();
const { sim, v } = setup(bp, world);
for (let i = 0; i < 1000; i++) sim.step();
v.drive.gear = 0; v.drive.dir = 'N';
for (let i = 0; i < v.nc; i++) v.vel[3*i+2] = -kmh / 3.6;
const nose0 = -v.pos[3 * bp.names.get('b14_0') + 2];
let minF = 1e9;
for (let i = 0; i < 2000 * 4; i++) {
  sim.step();
  if (i % 200 === 0) { v.frameUpdate(0.1); const nose = -v.pos[3 * bp.names.get('b14_0') + 2]; const rear = -v.pos[3*bp.names.get('b0_0')+2];
    console.log(`t=${(i/2000).toFixed(2)} v=${(v.frame.speed*3.6).toFixed(1)} noseZ=${nose.toFixed(2)} rearZ=${rear.toFixed(2)} length=${(nose-rear).toFixed(2)} def=${v.damage.deformed} brk=${v.damage.broken} energy=${(v.damage.energy/1000).toFixed(1)}kJ alive=${v.alive}`); }
}
