// Computes spring preload so that, at the designed ride height, the springs
// carry the vehicle's weight (equivalent to BeamNG's "static ride height").

import { Vehicle, NF } from './vehicle.js';
import { Simulation } from './sim.js';
import { flatWorld } from './terrain.js';

/**
 * Mutates bp.L0 for the suspension springs. Returns the list of [beam, L0].
 */
export function settleBlueprint(bp, { iterations = 4, seconds = 1.2, verbose = false } = {}) {
  const world = flatWorld(60, 4, 0);
  const sim = new Simulation(world, { dt: 1 / 2000 });
  const v = new Vehicle(bp);
  sim.add(v);
  v.keepAwake = true;
  // only the tyres may carry load while finding the preload
  v.collideNodes = v.collideNodes.filter((i) => v.nflags[i] & NF.TIRE);
  const springs = Array.from(v.springBeams);
  const Ld = springs.map((i) => bp.L0[i]); // design lengths (L0 == Ld initially)
  const dt = sim.dt;
  const steps = Math.round(seconds / dt);
  for (let it = 0; it < iterations; it++) {
    v.place(0, 0, 0, world, 0.0);
    v.drag = 6; // heavy damping to converge quickly
    const avg = new Float64Array(springs.length);
    let n = 0;
    for (let s = 0; s < steps; s++) {
      sim.step();
      if (s > steps * 0.7) { for (let k = 0; k < springs.length; k++) avg[k] += v.bforce[springs[k]]; n++; }
    }
    let maxDelta = 0;
    for (let k = 0; k < springs.length; k++) {
      const i = springs[k];
      const F = avg[k] / n;
      const L0n = Ld[k] - F / v.K[i];
      maxDelta = Math.max(maxDelta, Math.abs(L0n - v.L0[i]));
      v.L0[i] = L0n;
      v.Lorig[i] = L0n;
      v.Lbase[i] = L0n;
    }
    if (verbose) console.log(`settle it${it}: max preload change ${(maxDelta * 1000).toFixed(1)} mm`);
    if (maxDelta < 0.0006) break;
  }
  const out = springs.map((i) => [i, v.L0[i]]);
  for (const [i, L] of out) bp.L0[i] = L;
  return out;
}
