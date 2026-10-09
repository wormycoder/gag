// Renders a physics vehicle: a smooth deformable body surface bound to the
// physical shell, glass, details, interior, wheels and lights.
import * as THREE from '../../vendor/three.module.min.js';
import { SkinSpace, makeFrameCache, mergeGeometries } from './skin.js';
import { Loft } from './loft.js';
import { partsFor, MATERIAL_DEFS } from './carParts.js';

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const mBasis = new THREE.Matrix4();

function makeWheelMeshes(R, width, rimR, style, rimColor, caliperColor) {
  const spin = new THREE.Group();
  const fixed = new THREE.Group();
  const w = width;
  const prof = [];
  const add = (r, x) => prof.push(new THREE.Vector2(r, x));
  add(rimR - 0.01, -w * 0.40);
  add(rimR + (R - rimR) * 0.2, -w * 0.505);
  add(rimR + (R - rimR) * 0.7, -w * 0.50);
  add(R - 0.014, -w * 0.45);
  add(R - 0.004, -w * 0.37);
  add(R, -w * 0.30);
  add(R, -w * 0.15); add(R - 0.008, -w * 0.13); add(R - 0.008, -w * 0.09); add(R, -w * 0.07);
  add(R, w * 0.07); add(R - 0.008, w * 0.09); add(R - 0.008, w * 0.13); add(R, w * 0.15);
  add(R, w * 0.30); add(R - 0.004, w * 0.37); add(R - 0.014, w * 0.45);
  add(rimR + (R - rimR) * 0.7, w * 0.50); add(rimR + (R - rimR) * 0.2, w * 0.505); add(rimR - 0.01, w * 0.40);
  const tireG = new THREE.LatheGeometry(prof, 40);
  tireG.rotateZ(-Math.PI / 2); // axis -> X
  const tire = new THREE.Mesh(tireG, new THREE.MeshStandardMaterial({ color: 0x151516, roughness: 0.82, metalness: 0 }));
  tire.castShadow = true;
  spin.add(tire);
  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.28, metalness: 0.95 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR - 0.006, rimR - 0.006, w * 0.78, 28, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2; barrel.material.side = THREE.DoubleSide;
  spin.add(barrel);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(rimR - 0.008, rimR - 0.008, 0.012, 28), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6, metalness: 0.6 }));
  face.rotation.z = Math.PI / 2; face.position.x = w * 0.26;
  spin.add(face);
  const nSp = style === 'truck' ? 6 : style === 'sport' ? 10 : 5;
  const spokeW = style === 'sport' ? 0.026 : style === 'truck' ? 0.05 : 0.05;
  for (let i = 0; i < nSp; i++) {
    const a = (i / nSp) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, rimR - 0.04, spokeW), rimMat);
    sp.position.set(w * 0.29, Math.cos(a) * (rimR - 0.04) * 0.5, Math.sin(a) * (rimR - 0.04) * 0.5);
    sp.rotation.x = a;
    spin.add(sp);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.2, rimR * 0.2, 0.03, 18), rimMat);
  cap.rotation.z = Math.PI / 2; cap.position.x = w * 0.3;
  spin.add(cap);
  const lug = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), lug);
    l.rotation.z = Math.PI / 2; l.position.set(w * 0.305, Math.cos(a) * rimR * 0.3, Math.sin(a) * rimR * 0.3);
    spin.add(l);
  }
  // brake disc spins with the wheel
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.82, rimR * 0.82, 0.026, 28), new THREE.MeshStandardMaterial({ color: 0x8a8a8c, roughness: 0.45, metalness: 0.9 }));
  disc.rotation.z = Math.PI / 2; disc.position.x = w * 0.12;
  spin.add(disc);
  // caliper stays with the knuckle
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, rimR * 0.5, rimR * 0.5), new THREE.MeshStandardMaterial({ color: caliperColor, roughness: 0.4, metalness: 0.3 }));
  cal.position.set(w * 0.12, rimR * 0.1, rimR * 0.5);
  fixed.add(cal);
  return { spin, fixed };
}

export class VehicleView {
  constructor(vehicle, scene, opts = {}) {
    this.v = vehicle;
    this.scene = scene;
    const bp = vehicle.bp;
    const spec = bp.spec;
    this.spec = spec;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.space = new SkinSpace(bp.body, vehicle.pos0);
    this.cache = makeFrameCache(this.space);
    this.loft = new Loft(bp.body, vehicle.pos0);
    this.bindings = [];
    this.lightMats = { head: [], tail: [] };
    this.paintColor = new THREE.Color(opts.paint ?? spec.visual.paint);
    this.materials = {};
    this._buildBody();
    this._buildParts();
    this._buildWheels();
    this.headLights = null;
    this.lightsOn = false;
    this.brakeLit = false;
    this.hidden = new Set();
  }

  // ----------------------------------------------------------------- body
  _paintTexture() {
    const spec = this.spec, vis = spec.visual;
    const S = spec.body.sections;
    const fMin = S[0].f, fMax = S[S.length - 1].f;
    const W = 2048, H = 512;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const X = (f) => ((f - fMin) / (fMax - fMin)) * W;
    const Y = (j) => (j / 12) * H;
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2.2;
    const line = (f0, j0, f1, j1) => { g.beginPath(); g.moveTo(X(f0), Y(j0)); g.lineTo(X(f1), Y(j1)); g.stroke(); };
    const sides = [[1, 0], [-1, 0]];
    for (const [sg] of sides) {
      const ja = sg > 0 ? 2.02 : 12 - 4.0, jb = sg > 0 ? 4.0 : 12 - 2.02; // lower/upper extent of door lines
      const lo = sg > 0 ? 1.95 : 12 - 3.0, hi = sg > 0 ? 3.0 : 12 - 1.95;
      for (const d of vis.doors || []) {
        line(d[0], lo, d[0], hi); line(d[1], lo, d[1], hi);
        // sill + belt seams
        line(d[0], lo, d[1], lo); line(d[0], hi, d[1], hi);
        // door handle
        g.fillStyle = 'rgba(30,30,30,0.7)';
        const hx = X(d[1] + 0.12 * (d[1] > d[0] ? 1 : -1)), hy = Y(sg > 0 ? 2.74 : 12 - 2.74);
        g.fillRect(hx - 18, hy - 4, 36, 8);
      }
    }
    // hood and trunk outlines
    for (const [a, b, c1, d] of vis.panels || []) {
      for (const j of [4.0, 8.0]) line(a, j, b, j);
      line(a, 4.0, a, 8.0); line(b, 4.0, b, 8.0);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  _archUniforms() {
    const arr = [];
    for (let i = 0; i < 4; i++) arr.push(new THREE.Vector4(1e3, 0, 0, 0));
    this.v.wheels.forEach((w, i) => {
      if (i >= 4) return;
      const p = this.v.pos0;
      const cx = 0.5 * (p[3 * w.hubIn] + p[3 * w.hubOut]);
      const cy = 0.5 * (p[3 * w.hubIn + 1] + p[3 * w.hubOut + 1]);
      const cz = 0.5 * (p[3 * w.hubIn + 2] + p[3 * w.hubOut + 2]);
      arr[i].set(Math.abs(cx) - 0.34, cy, cz, w.radius + 0.07 + (this.spec.visual.archExtra ?? 0));
    });
    return arr;
  }

  _applyArchShader(mat) {
    const uArch = this.uArch || (this.uArch = this._archUniforms());
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uArch = { value: uArch };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aRest; varying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec4 uArch[4];')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          for (int k = 0; k < 4; k++) { vec4 a = uArch[k]; vec2 d = vec2(vRest.y - a.y, vRest.z - a.z);
            if (dot(d, d) < a.w * a.w && abs(vRest.x) > a.x) discard; }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.035);');
    };
  }

  _buildBody() {
    const spec = this.spec, vis = spec.visual, loft = this.loft;
    const nS = loft.nS;
    const f2s = (f) => loft.sOfF(f);
    const glass = vis.glass || {};
    const rects = [];
    if (glass.wind) rects.push([f2s(glass.wind[0]), f2s(glass.wind[1]), 4.3, 7.7]);
    if (glass.rear) rects.push([f2s(glass.rear[0]), f2s(glass.rear[1]), 4.3, 7.7]);
    for (const s of glass.side || []) { rects.push([f2s(s[0]), f2s(s[1]), 4.06, 4.94]); rects.push([f2s(s[0]), f2s(s[1]), 7.06, 7.94]); }
    this.glassRects = rects;
    const inGlass = (s, j) => (j < 1.0 || j > 11.0) || rects.some((r) => s >= r[0] && s <= r[1] && j >= r[2] && j <= r[3]);
    // dark regions (underside, bed)
    const bedF = vis.bed;
    const shade = (s, j, n) => {
      if (n[1] < -0.35) return [0.07, 0.07, 0.08];
      if (bedF) {
        const fAt = loft.f[Math.min(nS - 1, Math.floor(s))];
        if (fAt <= bedF[1] && fAt >= bedF[0] && j > 3.6 && j < 8.4) return [0.12, 0.12, 0.13];
      }
      return [1, 1, 1];
    };
    // rows: choose count by length so cells are ~7cm
    const lenF = spec.body.sections[nS - 1].f - spec.body.sections[0].f;
    const rowsN = Math.max(40, Math.round(lenF / 0.065));
    const b2 = loft.build({ s0: 0, s1: nS - 1, j0: 0, j1: loft.K, nS: rowsN, nJ: 72, shade, skip: inGlass });
    this.bodyBuilt = b2;
    const geo = b2.geo;
    // rest positions for arch cut-outs
    geo.setAttribute('aRest', new THREE.BufferAttribute(Float32Array.from(geo.attributes.position.array), 3));
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.paintColor, metalness: 0.45, roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.05,
      vertexColors: true, map: this._paintTexture(), side: THREE.DoubleSide, envMapIntensity: 1.15,
    });
    this._applyArchShader(mat);
    this.materials.paint = mat;
    this.bodyMesh = new THREE.Mesh(geo, mat);
    this.bodyMesh.frustumCulled = false;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);
    this.bodyBinding = this.space.bind(geo, b2.params);
    this.bindings.push(this.bodyBinding);

    // glass patches
    const gm = new THREE.MeshPhysicalMaterial({ color: 0x0a1218, metalness: 0.0, roughness: 0.03, transparent: true, opacity: 0.68, envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false });
    this.materials.glass = gm;
    this.glassMeshes = [];
    for (const r of rects) {
      const gb = loft.build({ s0: r[0], s1: r[1], j0: r[2], j1: r[3], nS: 6, nJ: 8, offset: 0.004 });
      const m = new THREE.Mesh(gb.geo, gm);
      m.frustumCulled = false; m.renderOrder = 2;
      this.group.add(m);
      this.bindings.push(this.space.bind(gb.geo, gb.params));
      this.glassMeshes.push(m);
    }
    // dark cabin lining behind the glass so the interior reads
    // wheel-arch liners
    const lm = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.95, side: THREE.DoubleSide });
    this.v.wheels.forEach((w) => {
      const p = this.v.pos0;
      const cx = 0.5 * (p[3 * w.hubIn] + p[3 * w.hubOut]);
      const cy = 0.5 * (p[3 * w.hubIn + 1] + p[3 * w.hubOut + 1]);
      const cz = 0.5 * (p[3 * w.hubIn + 2] + p[3 * w.hubOut + 2]);
      const sg = Math.sign(cx);
      const rad = w.radius + 0.05;
      const g = new THREE.CylinderGeometry(rad, rad, 0.46, 20, 1, true, 0, Math.PI);
      g.rotateZ(Math.PI / 2); // axis -> X, arc covers the top half
      g.translate(cx - sg * 0.04, cy, cz);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, lm);
      m.frustumCulled = false;
      this.group.add(m);
      this.bindings.push(this.space.bind(g));
    });
  }

  // ---------------------------------------------------------------- parts
  _buildParts() {
    const list = partsFor(this.spec.visual.kind, this.spec);
    const byMat = {};
    for (const p of list) (byMat[p.mat] = byMat[p.mat] || []).push(p.geo);
    this.partMeshes = [];
    for (const [key, geos] of Object.entries(byMat)) {
      for (const g of geos) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      const geo = mergeGeometries(geos);
      let mat;
      if (key === 'paint') {
        mat = new THREE.MeshPhysicalMaterial({ color: this.paintColor, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
      } else {
        const d = MATERIAL_DEFS[key] || MATERIAL_DEFS.black;
        mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness, emissive: d.emissive ?? 0x000000, emissiveIntensity: d.emissiveIntensity ?? 0 });
        if (d.light) this.lightMats[d.light].push(mat);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.castShadow = key !== 'interior' && key !== 'seat'; mesh.receiveShadow = true;
      this.group.add(mesh);
      this.bindings.push(this.space.bind(geo));
      this.partMeshes.push(mesh);
    }
  }

  // --------------------------------------------------------------- wheels
  _buildWheels() {
    const vis = this.spec.visual;
    this.wheelObjs = this.v.wheels.map((w) => {
      const st = vis.wheel || {};
      const rimR = st.rimRadius ?? 0.2;
      const { spin, fixed } = makeWheelMeshes(w.radius, w.width, rimR, st.style || 'sedan', st.color ?? 0xb8bcc2, st.caliper ?? 0xc22a2a);
      const root = new THREE.Group();
      const spinRoot = new THREE.Group();
      spinRoot.add(spin);
      root.add(spinRoot, fixed);
      this.group.add(root);
      return { w, root, spinRoot, fixed };
    });
  }

  // ------------------------------------------------------------------ update
  update() {
    const v = this.v;
    const pos = v.pos;
    this.cache.cur++;
    for (const b of this.bindings) b.update(pos, this.cache);
    // hide quads that tore off
    if (v.dirtyBroken) { v.dirtyBroken = false; this._rebuildIndex(); }
    // wheels
    const up = v.frame.u;
    for (const o of this.wheelObjs) {
      const w = o.w;
      const a = w.axis;
      const sgn = w.side > 0 ? -1 : 1; // outward axis
      let ox = a[0] * sgn, oy = a[1] * sgn, oz = a[2] * sgn;
      let yx = up[0] - (up[0] * ox + up[1] * oy + up[2] * oz) * ox;
      let yy = up[1] - (up[0] * ox + up[1] * oy + up[2] * oz) * oy;
      let yz = up[2] - (up[0] * ox + up[1] * oy + up[2] * oz) * oz;
      const yl = Math.hypot(yx, yy, yz) || 1; yx /= yl; yy /= yl; yz /= yl;
      const zx = oy * yz - oz * yy, zy = oz * yx - ox * yz, zz = ox * yy - oy * yx;
      mBasis.makeBasis(tmpV.set(ox, oy, oz), new THREE.Vector3(yx, yy, yz), new THREE.Vector3(zx, zy, zz));
      tmpQ.setFromRotationMatrix(mBasis);
      o.root.quaternion.copy(tmpQ);
      o.root.position.set(w.center[0], w.center[1], w.center[2]);
      o.spinRoot.rotation.x = (w.side > 0 ? -1 : 1) * w.angle;
      // mirror the left side so the outer face points outwards
      o.fixed.visible = true;
    }
    // lights
    const braking = v.drive.effBrake > 0.05 || v.input.handbrake > 0;
    const reverse = v.drive.gear < 0;
    const headI = this.lightsOn ? 2.2 : 0.0;
    for (const m of this.lightMats.head) m.emissiveIntensity = headI;
    const tailI = braking ? 3.2 : this.lightsOn ? 0.9 : 0.12;
    for (const m of this.lightMats.tail) m.emissiveIntensity = tailI;
    if (this.headLights) {
      for (const l of this.headLights) l.visible = this.lightsOn;
      if (this.lightsOn) {
        const f = v.frame, c = f.com;
        const hp = [c[0] + f.f[0] * 2.0, c[1] + f.f[1] * 0.0 + 0.05, c[2] + f.f[2] * 2.0];
        this.headLights.forEach((l, i) => {
          const side = i === 0 ? -0.6 : 0.6;
          l.position.set(hp[0] + f.r[0] * side, c[1] + 0.1, hp[2] + f.r[2] * side);
          l.target.position.set(hp[0] + f.f[0] * 30 + f.r[0] * side * 0.4, c[1] - 0.6, hp[2] + f.f[2] * 30 + f.r[2] * side * 0.4);
          l.target.updateMatrixWorld();
        });
      }
    }
  }

  setLights(on) {
    this.lightsOn = on;
    if (on && !this.headLights) {
      this.headLights = [0, 1].map(() => {
        const l = new THREE.SpotLight(0xfff2d8, 90, 70, 0.5, 0.6, 1.4);
        l.castShadow = false;
        this.scene.add(l); this.scene.add(l.target);
        return l;
      });
    }
  }

  _rebuildIndex() {
    // drop faces of body cells whose edges tore
    const v = this.v, K = this.space.K;
    const base = this.bodyBuilt;
    const bad = new Set();
    const ring = this.space.ring;
    const nodePairBroken = (a, b) => {
      // look through broken beam set for this node pair
      for (const bi of v.broken) {
        const x = v.b1[bi], y = v.b2[bi];
        if ((x === a && y === b) || (x === b && y === a)) return true;
      }
      return false;
    };
    const ringEdges = new Map();
    for (const bi of v.broken) {
      const a = v.b1[bi], b = v.b2[bi];
      ringEdges.set(a * 4096 + b, true); ringEdges.set(b * 4096 + a, true);
    }
    for (let i = 0; i < this.space.nS - 1; i++) for (let j = 0; j < K; j++) {
      const [a, b, c, d] = this.space.quadNodes(i, j);
      if (ringEdges.has(a * 4096 + b) || ringEdges.has(c * 4096 + d) || ringEdges.has(a * 4096 + c) || ringEdges.has(b * 4096 + d)) bad.add(i * K + j);
    }
    const src = base.fullIndex;
    const out = [];
    // each cell contributed 6 indices in order; reconstruct by cellQuad (2 entries per cell)
    for (let c = 0, k = 0; c < base.cellQuad.length; c += 2, k += 6) {
      if (!bad.has(base.cellQuad[c])) for (let t = 0; t < 6; t++) out.push(src[k + t]);
    }
    this.bodyMesh.geometry.setIndex(out);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (this.headLights) for (const l of this.headLights) { this.scene.remove(l); this.scene.remove(l.target); }
  }
}
