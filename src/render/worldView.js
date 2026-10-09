// Visual representation of the map: terrain mesh with painted colour map,
// physical props (ramps, barriers...) and decorative trees.
import * as THREE from '../../vendor/three.module.min.js';
import { SURFACE } from '../physics/terrain.js';

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function valueNoiseTexture(size, seed, base = 0.9, amp = 0.2) {
  const rnd = mulberry(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  // tileable multi-octave noise
  const grids = [8, 16, 32, 64].map((n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return [n, a]; });
  const sample = (n, a, x, y) => {
    const fx = x * n, fy = y * n; const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g00 = a[(iy % n) * n + (ix % n)], g10 = a[(iy % n) * n + ((ix + 1) % n)];
    const g01 = a[((iy + 1) % n) * n + (ix % n)], g11 = a[((iy + 1) % n) * n + ((ix + 1) % n)];
    return (g00 + (g10 - g00) * sx) + ((g01 + (g11 - g01) * sx) - (g00 + (g10 - g00) * sx)) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, w = 0.5, tot = 0;
    for (const [n, a] of grids) { v += sample(n, a, x / size, y / size) * w; tot += w; w *= 0.6; }
    v /= tot;
    const l = Math.max(0, Math.min(255, (base + (v - 0.5) * 2 * amp) * 255));
    const o = 4 * (y * size + x);
    img.data[o] = img.data[o + 1] = img.data[o + 2] = l; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function buildWorldView(map, scene) {
  const T = map.terrain;
  const group = new THREE.Group();
  scene.add(group);

  // ---- terrain geometry
  const n = T.cells, stride = T.stride;
  const pos = new Float32Array(stride * stride * 3);
  const uv = new Float32Array(stride * stride * 2);
  for (let j = 0; j < stride; j++) for (let i = 0; i < stride; i++) {
    const k = j * stride + i;
    pos[3 * k] = T.ox + i * T.cs; pos[3 * k + 1] = T.heights[k]; pos[3 * k + 2] = T.oz + j * T.cs;
    uv[2 * k] = i / n; uv[2 * k + 1] = 1 - j / n;
  }
  const idx = new Uint32Array(n * n * 6);
  let q = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
    idx[q++] = a; idx[q++] = d; idx[q++] = b;
    idx[q++] = a; idx[q++] = c; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  // ---- colour map
  const TEX = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const g = canvas.getContext('2d');
  const img = g.createImageData(TEX, TEX);
  const palette = {
    [SURFACE.CONCRETE]: [112, 112, 108], [SURFACE.ASPHALT]: [46, 46, 48], [SURFACE.GRASS]: [70, 96, 46],
    [SURFACE.DIRT]: [104, 78, 52], [SURFACE.GRAVEL]: [112, 106, 96], [SURFACE.SAND]: [176, 154, 108], [SURFACE.PAINT]: [200, 200, 200],
  };
  const rnd = mulberry(1234);
  const nz = new Float32Array(256 * 256); for (let i = 0; i < nz.length; i++) nz[i] = rnd();
  const smp = (x, y, sc) => { const fx = x * sc, fy = y * sc; const ix = Math.floor(fx), iy = Math.floor(fy); const tx = fx - ix, ty = fy - iy;
    const a = nz[((iy & 255) << 8) | (ix & 255)], b = nz[((iy & 255) << 8) | ((ix + 1) & 255)], c = nz[(((iy + 1) & 255) << 8) | (ix & 255)], d = nz[(((iy + 1) & 255) << 8) | ((ix + 1) & 255)];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty; };
  const cells = T.cells;
  for (let py = 0; py < TEX; py++) {
    const cj = Math.min(cells - 1, Math.floor((py / TEX) * cells));
    for (let px = 0; px < TEX; px++) {
      const ci = Math.min(cells - 1, Math.floor((px / TEX) * cells));
      const s = T.surf[cj * cells + ci];
      const c = palette[s];
      const n1 = smp(px, py, 0.05) * 0.5 + smp(px, py, 0.2) * 0.3 + smp(px, py, 0.8) * 0.2;
      let k = 0.82 + n1 * 0.36;
      const o = 4 * (py * TEX + px);
      let r = c[0] * k, gg = c[1] * k, b = c[2] * k;
      if (s === SURFACE.GRASS) { const m = smp(px, py, 0.011); r *= 0.85 + m * 0.5; gg *= 0.9 + m * 0.3; b *= 0.8 + m * 0.2; }
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const wx = (x) => ((x - T.ox) / (T.cells * T.cs)) * TEX;
  const wz = (z) => ((z - T.oz) / (T.cells * T.cs)) * TEX;
  const mpp = TEX / (T.cells * T.cs); // pixels per meter
  g.lineCap = 'butt';
  // plaza grid
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.5 * mpp;
  g.beginPath();
  for (let v = -200; v <= 200; v += 10) { g.moveTo(wx(v), wz(-200)); g.lineTo(wx(v), wz(200)); g.moveTo(wx(-200), wz(v)); g.lineTo(wx(200), wz(v)); }
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 0.8 * mpp;
  g.beginPath();
  for (let v = -200; v <= 200; v += 50) { g.moveTo(wx(v), wz(-200)); g.lineTo(wx(v), wz(200)); g.moveTo(wx(-200), wz(v)); g.lineTo(wx(200), wz(v)); }
  g.stroke();
  // plaza border (yellow)
  g.strokeStyle = 'rgba(240,200,40,0.9)'; g.lineWidth = 0.6 * mpp;
  g.strokeRect(wx(-203), wz(-203), 406 * mpp, 406 * mpp);
  // skidpad circle
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.4 * mpp;
  g.beginPath(); g.arc(wx(-80), wz(140), 30 * mpp, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(wx(-80), wz(140), 22 * mpp, 0, Math.PI * 2); g.stroke();
  // road markings
  const road = map.road;
  const strokePath = (w, style, dash) => {
    g.strokeStyle = style; g.lineWidth = w * mpp; g.setLineDash(dash ? dash.map((d) => d * mpp) : []);
    g.beginPath();
    road.forEach((p, i) => { i ? g.lineTo(wx(p[0]), wz(p[1])) : g.moveTo(wx(p[0]), wz(p[1])); });
    g.closePath(); g.stroke();
  };
  strokePath(map.ROAD_W * 2 + 1.0, 'rgba(70,70,72,1)');
  strokePath(map.ROAD_W * 2 - 0.2, 'rgba(48,48,50,1)');
  // edge lines: draw offset curves
  const offsetLine = (off, style, w, dash) => {
    g.strokeStyle = style; g.lineWidth = w * mpp; g.setLineDash(dash ? dash.map((d) => d * mpp) : []);
    g.beginPath();
    road.forEach((p, i) => {
      const b = road[(i + 1) % road.length], a = road[(i + road.length - 1) % road.length];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const x = p[0] - dz * off, z = p[1] + dx * off;
      i ? g.lineTo(wx(x), wz(z)) : g.moveTo(wx(x), wz(z));
    });
    g.closePath(); g.stroke();
  };
  offsetLine(map.ROAD_W - 0.35, 'rgba(235,235,235,0.9)', 0.18);
  offsetLine(-(map.ROAD_W - 0.35), 'rgba(235,235,235,0.9)', 0.18);
  offsetLine(0, 'rgba(240,200,40,0.95)', 0.16, [3, 5]);
  g.setLineDash([]);
  // start/finish bar on the road entrance
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(wx(215 - map.ROAD_W), wz(-1), 2 * map.ROAD_W * mpp, 1.2 * mpp);

  const colorTex = new THREE.CanvasTexture(canvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 16;
  colorTex.wrapS = colorTex.wrapT = THREE.ClampToEdgeWrapping;
  const detail = valueNoiseTexture(256, 7, 0.9, 0.22);
  const mat = new THREE.MeshStandardMaterial({ map: colorTex, roughness: 0.95, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 duv = vMapUv * 2048.0;
        float d1 = texture2D(uDetail, duv * 0.55).r;
        float d2 = texture2D(uDetail, duv * 0.071).r;
        diffuseColor.rgb *= (0.7 + d1 * 0.5) * (0.78 + d2 * 0.4);`);
  };
  const terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // ---- props
  const kindMat = {};
  const matFor = (b) => {
    const key = b.kind + b.color;
    if (!kindMat[key]) kindMat[key] = new THREE.MeshStandardMaterial({ color: b.color ?? 0x999999, roughness: b.kind === 'ramp' ? 0.6 : 0.9, metalness: b.kind === 'rail' ? 0.6 : 0.0 });
    return kindMat[key];
  };
  const unit = new THREE.BoxGeometry(1, 1, 1);
  for (const b of T.boxes) {
    const m = new THREE.Mesh(unit, matFor(b));
    const mt = new THREE.Matrix4();
    // world<-local rotation (row-major m)
    mt.set(b.m[0], b.m[1], b.m[2], b.x, b.m[3], b.m[4], b.m[5], b.y, b.m[6], b.m[7], b.m[8], b.z, 0, 0, 0, 1);
    mt.multiply(new THREE.Matrix4().makeScale(b.hx * 2, b.hy * 2, b.hz * 2));
    m.matrixAutoUpdate = false;
    m.matrix.copy(mt);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // ---- trees (decorative)
  const rnd2 = mulberry(99);
  const trunkG = new THREE.CylinderGeometry(0.25, 0.4, 3, 6); trunkG.translate(0, 1.5, 0);
  const crownG = new THREE.ConeGeometry(2.2, 7, 7); crownG.translate(0, 6, 0);
  const trees = [];
  for (let tries = 0; tries < 9000 && trees.length < 1600; tries++) {
    const x = (rnd2() - 0.5) * 960, z = (rnd2() - 0.5) * 960;
    if (Math.abs(x) < 215 && Math.abs(z) < 215) continue;
    const i = Math.floor((x - T.ox) / T.cs), j = Math.floor((z - T.oz) / T.cs);
    const s = T.surf[j * T.cells + i];
    if (s !== SURFACE.GRASS && s !== SURFACE.DIRT) continue;
    const d = map.roadInfo[2 * (j * T.stride + i)];
    if (d < 16) continue;
    const h = T.heightAt(x, z);
    if (h > 90) continue;
    trees.push([x, h, z, 0.8 + rnd2() * 0.9]);
  }
  const trunkM = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5b4130, roughness: 1 }), trees.length);
  const crownM = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x2f5a31, roughness: 1 }), trees.length);
  const tm = new THREE.Matrix4();
  trees.forEach((t, k) => { tm.makeScale(t[3], t[3], t[3]).setPosition(t[0], t[1] - 0.2, t[2]); trunkM.setMatrixAt(k, tm); crownM.setMatrixAt(k, tm); });
  trunkM.castShadow = crownM.castShadow = true;
  group.add(trunkM, crownM);
  return { group, terrainMesh };
}
