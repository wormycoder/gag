import { Vehicle } from '../src/physics/vehicle.js';
import { Simulation } from '../src/physics/sim.js';
import { flatWorld } from '../src/physics/terrain.js';
import { settleBlueprint } from '../src/physics/settle.js';
import { buildKestrel } from '../src/vehicles/kestrel.js';

export function setup(bp, world) {
  settleBlueprint(bp);
  const sim = new Simulation(world, { dt: 1 / 2000 });
  const v = new Vehicle(bp);
  v.place(0, 0, 0, world, 0.0);
  sim.add(v); v.keepAwake = true;
  return { sim, v };
}
const kmh = (v) => v.frame.speed * 3.6;
if (process.argv[1].endsWith('drive.js')) {
  const which = process.argv[2] || 'kestrel';
  const mod = await import(`../src/vehicles/${which}.js`);
  const bp = mod[Object.keys(mod).find((k) => k.startsWith('build'))]();
  const world = flatWorld(3000, 4, 0);
  const { sim, v } = setup(bp, world);
  for (let i = 0; i < 1000; i++) sim.step();
  console.log('settled; hubY', v.wheels.map((w) => w.center[1].toFixed(3)).join(' '));
  // 0-100
  v.input.throttle = 1;
  let t100 = null, t60 = null;
  const t0 = sim.time;
  for (let i = 0; i < 2000 * 25; i++) {
    sim.step();
    if (i % 100 === 0) {
      v.frameUpdate(0.05);
      const s = kmh(v);
      if (t60 === null && s >= 60) t60 = sim.time - t0;
      if (t100 === null && s >= 100) { t100 = sim.time - t0; break; }
      if (i % 4000 === 0) console.log(`t=${(sim.time - t0).toFixed(1)} v=${s.toFixed(1)} rpm=${v.drive.rpm.toFixed(0)} gear=${v.drive.gearLabel} slip=${v.wheels.map(w=>((w.omega*w.radius-w.vFwd)/Math.max(1,Math.abs(w.vFwd))).toFixed(2))} pos=${v.frame.com.map(x=>x.toFixed(1))}`);
    }
  }
  console.log('0-60 km/h', t60?.toFixed(2), '0-100 km/h', t100?.toFixed(2));
}
