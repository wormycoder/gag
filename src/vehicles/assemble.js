// Turns a declarative car spec into a physics blueprint.

import { Builder } from '../physics/builder.js';

function nearestSection(sections, f) {
  let best = 0, bd = 1e9;
  sections.forEach((s, i) => { const d = Math.abs(s.f - f); if (d < bd) { bd = d; best = i; } });
  return best;
}

export function assemble(spec) {
  const B = new Builder(spec.id);
  const body = B.addBody({ ...spec.body, bodyMass: 1000 });
  const front = spec.axle.front, rear = spec.axle.rear;

  const tireFor = (axleSpec, name, side) => {
    const t = axleSpec.tire;
    return B.addWheel({
      name, side, axle: axleSpec === front ? 'front' : 'rear',
      x: side * axleSpec.track * 0.5, f: axleSpec.f,
      R: t.R, width: t.width, tireMass: t.mass, hubMass: t.hubMass ?? 7,
      nTread: t.n ?? 20, kSpoke: t.kSpoke, kCross: t.kCross, kRing: t.kRing, grip: t.grip ?? 1.05,
      rollRes: t.rollRes ?? 0.011,
      brakeTorque: axleSpec.brake, handbrake: !!axleSpec.handbrake, handbrakeTorque: axleSpec.handbrakeTorque,
      driven: !!axleSpec.driven, steered: !!axleSpec.steered,
    });
  };

  const corners = {};
  for (const [key, ax] of [['front', front], ['rear', rear]]) {
    const wl = tireFor(ax, key[0] + 'l', -1);
    const wr = tireFor(ax, key[0] + 'r', +1);
    const s = ax.susp;
    if (ax.type === 'solid') {
      const r = B.addSolidAxle(wl, wr, {
        f: ax.f, track: ax.track, spring: s.spring, bump: s.bump, rebound: s.rebound,
        frameY: s.frameY, springIn: s.springIn, travel: s.travel, arms: s.arms,
        steer: !!ax.steered, rackEnd: s.rackEnd, tieSide: s.tieSide, tieOff: s.tieOff,
        diffMass: s.axleMass, casterOffset: s.casterOffset,
      });
      corners[key] = { solid: r, wl, wr };
    } else {
      const common = {
        x: ax.track * 0.5, f: ax.f, spring: s.spring, bump: s.bump, rebound: s.rebound,
        tower: s.tower, travel: s.travel, arms: s.arms, steer: !!ax.steered, rackEnd: s.rackEnd,
        tieSide: s.tieSide ?? -1, tieOff: s.tieOff, toeIn: s.toeIn, springOn: s.springOn,
        casterOffset: s.casterOffset, kupIn: s.kupIn, kupUp: s.kupUp, kloIn: s.kloIn, kloDown: s.kloDown,
        kArm: s.kArm,
      };
      const cl = B.addIndependentCorner(wl, common);
      const cr = B.addIndependentCorner(wr, common);
      corners[key] = { cl, cr, wl, wr };
      if (s.arb) B.addArb(wl, wr, cl.klo, cr.klo, cl.laF, cr.laF, s.arb);
    }
  }

  // powertrain & fixed masses ---------------------------------------
  const e = spec.engine;
  const engA = B.massNode('engA', e.x - (e.transverse ? 0 : e.span / 2), e.y, e.f + (e.transverse ? e.span / 2 : 0), e.mass * 0.5, { k: 1.6e5, zeta: 0.3, n: 8 });
  const engB = B.massNode('engB', e.x + (e.transverse ? 0 : e.span / 2), e.y, e.f - (e.transverse ? e.span / 2 : 0), e.mass * 0.5, { k: 1.6e5, zeta: 0.3, n: 8 });
  B.beam(engA, engB, { k: 1.5e6, zeta: 0.2, def: 1e9, brk: 1e9 });
  for (const m of spec.masses || []) B.massNode(m.name, m.x, m.y, m.f, m.mass, { k: m.k, n: m.n ?? 8 });

  // reference nodes ---------------------------------------------------
  const S = body.S;
  const sF = nearestSection(S, spec.refs.front), sB = nearestSection(S, spec.refs.back), sM = nearestSection(S, spec.refs.mid);
  B.refs = {
    front: body.ring[sF][0], back: body.ring[sB][0],
    left: body.ring[sM][11], right: body.ring[sM][1],
    engineA: engA, engineB: engB,
    aeroFront: body.ring[nearestSection(S, front.f)][0],
    aeroRear: body.ring[nearestSection(S, rear.f)][0],
  };
  // scale body mass so the whole car weighs `spec.mass`
  let other = 0;
  const bodySet = new Set(B.bodyNodes);
  for (let i = 0; i < B.mass.length; i++) if (!bodySet.has(i)) other += B.mass[i];
  const bodyNow = B.bodyNodes.reduce((a, i) => a + B.mass[i], 0);
  const want = spec.mass - other;
  if (want < 60) throw new Error(`${spec.id}: non-body masses (${other.toFixed(0)}) exceed target`);
  for (const i of B.bodyNodes) B.mass[i] *= want / bodyNow;

  const wheelbase = Math.abs(front.f - rear.f);
  const bp = B.finish({
    drive: spec.drive,
    steer: { maxAngle: spec.steer.maxAngle, ackermann: spec.steer.ackermann ?? 1, wheelbase, track: front.track },
    aero: spec.aero,
    cfg: spec.info,
    visual: spec.visual,
    spec,
  });
  bp.corners = corners;
  return bp;
}
