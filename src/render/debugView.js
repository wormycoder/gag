// Node/beam visualisation (BeamNG's "N" view): beams coloured by spring force,
// plastic deformation highlighted, broken beams hidden.
import * as THREE from '../../vendor/three.module.min.js';
import { NF } from '../physics/vehicle.js';

export class DebugView {
  constructor(vehicle, scene) {
    this.v = vehicle; this.scene = scene;
    const n = vehicle.bc;
    this.pos = new Float32Array(n * 6);
    this.col = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 10;
    const pg = new THREE.BufferGeometry();
    this.npos = new Float32Array(vehicle.nc * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.npos, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, depthTest: false }));
    this.points.frustumCulled = false; this.points.renderOrder = 11;
    this.group = new THREE.Group(); this.group.add(this.lines, this.points);
    scene.add(this.group);
  }
  set visible(b) { this.group.visible = b; }
  update() {
    const v = this.v, P = v.pos;
    for (let i = 0; i < v.bc; i++) {
      const a = 3 * v.b1[i], b = 3 * v.b2[i], o = 6 * i;
      if (v.btype[i] === 3) { this.pos.fill(0, o, o + 6); continue; }
      this.pos[o] = P[a]; this.pos[o + 1] = P[a + 1]; this.pos[o + 2] = P[a + 2];
      this.pos[o + 3] = P[b]; this.pos[o + 4] = P[b + 1]; this.pos[o + 5] = P[b + 2];
      const f = v.bforce[i] / Math.max(2000, v.defF0[i] < 1e8 ? v.defF0[i] : 40000);
      let r = 0.35, g = 0.6, bl = 0.35;
      if (f > 0) { r = 0.35 + Math.min(1, f) * 0.65; g = 0.6 - Math.min(1, f) * 0.45; bl = 0.35 - Math.min(1, f) * 0.25; }
      else { bl = 0.4 + Math.min(1, -f) * 0.6; r = 0.3 - Math.min(0.25, -f * 0.25); g = 0.55 - Math.min(0.3, -f * 0.3); }
      if (Math.abs(v.L0[i] - v.Lorig[i]) > 0.004 * v.Lorig[i] + 0.0015) { r = 1; g = 0.9; bl = 0.1; }
      for (let k = 0; k < 2; k++) { this.col[o + 3 * k] = r; this.col[o + 3 * k + 1] = g; this.col[o + 3 * k + 2] = bl; }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    this.npos.set(P);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.group); this.lines.geometry.dispose(); this.points.geometry.dispose(); }
}
