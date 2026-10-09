// Small detail parts for each body style, authored in vehicle space:
// x = right, y = up, f = forward (converted to world z = -f when baked).
import * as THREE from '../../vendor/three.module.min.js';

const M = new THREE.Matrix4();
function bake(geo, x, y, f, rx = 0, ry = 0, rz = 0) {
  M.compose(new THREE.Vector3(x, y, -f), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(M);
  return geo;
}
// helper: all sizes are in (x width, y height, f length)
export const box = (mat, x, y, f, sx, sy, sf, rot = [0, 0, 0]) => ({ mat, geo: bake(new THREE.BoxGeometry(sx, sy, sf), x, y, f, ...rot) });
export const cyl = (mat, x, y, f, r, len, axis = 'f', seg = 14) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  // cylinder default axis is Y
  if (axis === 'f') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  return { mat, geo: bake(g, x, y, f) };
};
export const sph = (mat, x, y, f, r, sx = 1, sy = 1, sz = 1) => {
  const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz);
  return { mat, geo: bake(g, x, y, f) };
};
const mirror = (list) => list; // placeholder for symmetrical helpers

function sym(fn) { return [fn(1), fn(-1)].flat(); }

function interior(spec, o) {
  const p = [];
  // dash, seats, steering wheel, driver
  p.push(box('interior', 0, o.dashY, o.dashF, 1.5, 0.16, 0.38));
  p.push(box('interior', 0, o.dashY + 0.08, o.dashF + 0.02, 1.3, 0.05, 0.32));
  for (const [x, f] of o.seats) {
    p.push(box('seat', x, o.seatY, f, 0.5, 0.12, 0.5));
    p.push(box('seat', x, o.seatY + 0.28, f - 0.26, 0.5, 0.52, 0.12, [-0.22, 0, 0]));
    p.push(box('seat', x, o.seatY + 0.58, f - 0.3, 0.3, 0.14, 0.1));
  }
  if (o.bench) for (const b of o.bench) {
    p.push(box('seat', 0, b.y, b.f, 1.35, 0.14, 0.5));
    p.push(box('seat', 0, b.y + 0.3, b.f - 0.27, 1.35, 0.55, 0.12, [-0.15, 0, 0]));
  }
  // steering wheel
  const sw = new THREE.TorusGeometry(0.17, 0.018, 8, 18); sw.rotateY(0); sw.rotateX(-0.5);
  p.push({ mat: 'interior', geo: bake(sw, o.wheelX, o.wheelY, o.wheelF) });
  p.push(cyl('interior', o.wheelX, o.wheelY - 0.12, o.wheelF + 0.2, 0.03, 0.35, 'f'));
  // driver
  p.push(sph('skin', o.wheelX, o.seatY + 0.74, o.seatF ?? o.seats[0][1] - 0.08, 0.11));
  p.push(box('shirt', o.wheelX, o.seatY + 0.42, o.seats[0][1] - 0.12, 0.36, 0.5, 0.2));
  p.push(box('shirt', o.wheelX - 0.1, o.seatY + 0.22, o.seats[0][1] + 0.22, 0.14, 0.12, 0.45, [0.1, 0, 0]));
  p.push(box('shirt', o.wheelX + 0.1, o.seatY + 0.22, o.seats[0][1] + 0.22, 0.14, 0.12, 0.45, [0.1, 0, 0]));
  return p;
}

export function partsFor(kind, spec) {
  const S = spec.body.sections;
  const nose = S[S.length - 1], tail = S[0];
  const p = [];
  if (kind === 'sedan') {
    const fN = nose.f, fT = tail.f;
    p.push(...sym((s) => box('headlight', s * 0.60, 0.70, fN - 0.04, 0.34, 0.09, 0.14, [0, -s * 0.12, 0])));
    p.push(...sym((s) => box('black', s * 0.60, 0.70, fN - 0.07, 0.38, 0.12, 0.06, [0, -s * 0.12, 0])));
    p.push(box('black', 0, 0.55, fN + 0.0, 0.66, 0.16, 0.06));
    p.push(box('chrome', 0, 0.635, fN + 0.0, 0.66, 0.02, 0.07));
    p.push(box('black', 0, 0.36, fN - 0.04, 0.95, 0.12, 0.08));
    p.push(...sym((s) => box('fog', s * 0.62, 0.40, fN - 0.07, 0.12, 0.07, 0.04)));
    p.push(box('plate', 0, 0.48, fN + 0.025, 0.46, 0.11, 0.015));
    p.push(...sym((s) => box('tail', s * 0.60, 0.78, fT + 0.03, 0.42, 0.10, 0.07, [0, s * 0.1, 0])));
    p.push(box('plate', 0, 0.62, fT - 0.03, 0.46, 0.11, 0.015));
    p.push(...sym((s) => cyl('chrome', s * 0.5, 0.31, fT - 0.1, 0.035, 0.18)));
    p.push(...sym((s) => box('black', s * 0.93, 1.04, 0.88, 0.1, 0.07, 0.17)));
    p.push(...sym((s) => box('paint', s * 0.88, 1.01, 0.88, 0.14, 0.02, 0.04)));
    p.push(...sym((s) => box('chrome', s * 0.903, 0.88, 0.25, 0.02, 0.02, 0.14)));
    p.push(...sym((s) => box('chrome', s * 0.903, 0.88, -0.75, 0.02, 0.02, 0.14)));
    p.push(...interior(spec, { dashY: 0.92, dashF: 0.82, seats: [[-0.38, 0.1], [0.38, 0.1]], seatY: 0.46, bench: [{ y: 0.46, f: -0.8 }], wheelX: -0.38, wheelY: 0.98, wheelF: 0.6 }));
  } else if (kind === 'coupe') {
    const fN = nose.f, fT = tail.f;
    p.push(...sym((s) => box('headlight', s * 0.66, 0.58, fN - 0.14, 0.40, 0.07, 0.16, [0, -s * 0.28, 0])));
    p.push(...sym((s) => box('black', s * 0.66, 0.58, fN - 0.17, 0.44, 0.10, 0.06, [0, -s * 0.28, 0])));
    p.push(box('black', 0, 0.45, fN - 0.02, 0.92, 0.17, 0.08));
    p.push(box('chrome', 0, 0.54, fN - 0.0, 0.92, 0.015, 0.09));
    p.push(box('black', 0, 0.30, fN - 0.05, 1.5, 0.08, 0.12)); // splitter
    p.push(...sym((s) => box('black', s * 0.45, 0.34, fN - 0.04, 0.34, 0.12, 0.08)));
    p.push(...sym((s) => box('black', s * 0.28, 0.90 - 0.04, 1.75, 0.34, 0.015, 0.5))); // hood vents
    p.push(box('plate', 0, 0.40, fN + 0.02, 0.46, 0.11, 0.015));
    p.push(...sym((s) => box('tail', s * 0.66, 0.82, fT + 0.03, 0.52, 0.10, 0.07, [0, s * 0.12, 0])));
    p.push(box('tail', 0, 0.84, fT + 0.025, 0.4, 0.03, 0.04));
    p.push(box('plate', 0, 0.56, fT - 0.02, 0.5, 0.11, 0.015));
    p.push(box('black', 0, 0.40, fT + 0.04, 1.4, 0.12, 0.08)); // diffuser
    p.push(...sym((s) => cyl('chrome', s * 0.38, 0.36, fT - 0.1, 0.045, 0.22)));
    p.push(...sym((s) => cyl('chrome', s * 0.58, 0.36, fT - 0.1, 0.045, 0.22)));
    // ducktail spoiler
    p.push(box('paint', 0, 1.01, fT + 0.38, 1.55, 0.035, 0.34, [0.05, 0, 0]));
    p.push(...sym((s) => box('paint', s * 0.77, 0.98, fT + 0.38, 0.03, 0.09, 0.34)));
    p.push(...sym((s) => box('black', s * 0.97, 0.99, 0.62, 0.1, 0.06, 0.2)));
    p.push(...sym((s) => box('black', s * 0.93, 0.50, 1.38, 0.02, 0.12, 0.36))); // fender gills
    p.push(...sym((s) => box('chrome', s * 0.945, 0.84, 0.25, 0.02, 0.02, 0.14)));
    p.push(...interior(spec, { dashY: 0.9, dashF: 0.72, seats: [[-0.4, -0.15], [0.4, -0.15]], seatY: 0.4, wheelX: -0.4, wheelY: 0.93, wheelF: 0.35 }));
  } else if (kind === 'pickup') {
    const fN = nose.f, fT = tail.f;
    p.push(...sym((s) => box('headlight', s * 0.68, 0.84, fN - 0.04, 0.34, 0.14, 0.12)));
    p.push(...sym((s) => box('black', s * 0.68, 0.84, fN - 0.07, 0.38, 0.18, 0.06)));
    p.push(box('black', 0, 0.84, fN + 0.0, 0.82, 0.36, 0.07)); // big grille
    p.push(box('chrome', 0, 1.04, fN + 0.01, 0.84, 0.03, 0.08));
    p.push(box('chrome', 0, 0.84, fN + 0.01, 0.84, 0.02, 0.08));
    p.push(box('chrome', 0, 0.58, fN - 0.04, 1.9, 0.14, 0.14)); // bumper
    p.push(box('black', 0, 0.58, fN - 0.07, 1.92, 0.07, 0.06));
    p.push(...sym((s) => box('fog', s * 0.62, 0.56, fN - 0.11, 0.14, 0.08, 0.03)));
    p.push(box('plate', 0, 0.62, fN - 0.12, 0.5, 0.12, 0.015));
    p.push(...sym((s) => box('tail', s * 0.9, 0.96, fT + 0.015, 0.1, 0.34, 0.04)));
    p.push(box('chrome', 0, 0.55, fT + 0.0, 1.95, 0.13, 0.13)); // rear bumper
    p.push(box('plate', 0, 0.7, fT - 0.03, 0.5, 0.12, 0.015));
    p.push(...sym((s) => cyl('chrome', s * 0.6, 0.38, fT + 0.5, 0.045, 0.3)));
    p.push(...sym((s) => box('black', s * 1.12, 1.46, 0.95, 0.1, 0.17, 0.30)));
    p.push(...sym((s) => box('black', s * 1.04, 1.40, 0.95, 0.12, 0.03, 0.04)));
    p.push(...sym((s) => box('chrome', s * 1.005, 1.1, 0.3, 0.02, 0.03, 0.16)));
    p.push(...sym((s) => box('chrome', s * 1.005, 1.1, -0.45, 0.02, 0.03, 0.16)));
    p.push(...sym((s) => box('black', s * 1.02, 0.52, 1.8, 0.04, 0.05, 1.0))); // side steps
    p.push(...sym((s) => box('black', s * 1.02, 0.55, -0.1, 0.18, 0.05, 1.4)));
    p.push(box('black', 0, 1.9, 0.2, 0.9, 0.05, 0.16)); // cab marker lights bar
    p.push(...interior(spec, { dashY: 1.1, dashF: 0.88, seats: [[-0.42, 0.25], [0.42, 0.25]], seatY: 0.74, bench: [{ y: 0.78, f: -0.2 }], wheelX: -0.42, wheelY: 1.18, wheelF: 0.55 }));
  }
  return p;
}

export const MATERIAL_DEFS = {
  black: { color: 0x0c0c0e, roughness: 0.55, metalness: 0.1 },
  chrome: { color: 0xdedede, roughness: 0.12, metalness: 1.0 },
  headlight: { color: 0xe8f0ff, roughness: 0.1, metalness: 0.0, emissive: 0xffffff, emissiveIntensity: 0.0, light: 'head' },
  fog: { color: 0xfff1c0, roughness: 0.2, metalness: 0.0 },
  tail: { color: 0x7a0a0a, roughness: 0.2, metalness: 0.0, emissive: 0xff1010, emissiveIntensity: 0.15, light: 'tail' },
  plate: { color: 0xe9e6d6, roughness: 0.6, metalness: 0.0 },
  interior: { color: 0x17181a, roughness: 0.8, metalness: 0.0 },
  seat: { color: 0x2b2c30, roughness: 0.9, metalness: 0.0 },
  skin: { color: 0xc99a7b, roughness: 0.8, metalness: 0.0 },
  shirt: { color: 0x2d4f7c, roughness: 0.9, metalness: 0.0 },
};
