// World collision geometry: a triangulated heightfield with surface types and a
// set of oriented-box colliders (ramps, walls, barriers). Pure data + queries so it
// can run inside Node (tests) and in the browser alike.

export const SURFACE = {
  ASPHALT: 0,
  CONCRETE: 1,
  GRASS: 2,
  DIRT: 3,
  GRAVEL: 4,
  SAND: 5,
  PAINT: 6, // road markings, same grip as asphalt
};

// grip multiplier (applied to tyre friction), rolling-resistance multiplier,
// squeal/dust colour hint for the renderer.
export const SURFACE_PROPS = [
  { name: 'asphalt', grip: 1.0, rr: 1.0, dust: 0x222222 },
  { name: 'concrete', grip: 0.96, rr: 0.95, dust: 0x8a8a8a },
  { name: 'grass', grip: 0.62, rr: 2.6, dust: 0x4a6a2a },
  { name: 'dirt', grip: 0.74, rr: 2.2, dust: 0x7a5a3a },
  { name: 'gravel', grip: 0.66, rr: 3.0, dust: 0x9a8f7f },
  { name: 'sand', grip: 0.55, rr: 5.0, dust: 0xc9b27c },
  { name: 'paint', grip: 0.92, rr: 1.0, dust: 0xdddddd },
];

export class GroundSample {
  constructor() {
    this.h = 0;
    this.nx = 0;
    this.ny = 1;
    this.nz = 0;
    this.s = 0;
  }
}

export class Terrain {
  /**
   * @param {number} cells   number of cells along each side
   * @param {number} cellSize meters per cell
   * @param {number} originX world x of the (0,0) vertex
   * @param {number} originZ world z of the (0,0) vertex
   */
  constructor(cells, cellSize, originX, originZ) {
    this.cells = cells;
    this.cs = cellSize;
    this.inv = 1 / cellSize;
    this.ox = originX;
    this.oz = originZ;
    this.stride = cells + 1;
    this.heights = new Float32Array(this.stride * this.stride);
    this.surf = new Uint8Array(cells * cells); // per cell
    this.boxes = [];
    this._grid = null;
    this.maxX = originX + cells * cellSize;
    this.maxZ = originZ + cells * cellSize;
  }

  /** Fill the heightfield from f(x, z) -> height. */
  fillHeights(fn) {
    const { stride, cs, ox, oz, heights } = this;
    for (let j = 0; j < stride; j++) {
      for (let i = 0; i < stride; i++) heights[j * stride + i] = fn(ox + i * cs, oz + j * cs);
    }
  }

  fillSurface(fn) {
    const { cells, cs, ox, oz, surf } = this;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) surf[j * cells + i] = fn(ox + (i + 0.5) * cs, oz + (j + 0.5) * cs);
    }
  }

  heightAt(x, z) {
    const s = this._tmp || (this._tmp = new GroundSample());
    this.sample(x, z, s);
    return s.h;
  }

  /** Triangle-split bilinear sample matching the render mesh triangulation. */
  sample(x, z, out) {
    const { cells, stride, heights, inv, cs } = this;
    let fx = (x - this.ox) * inv;
    let fz = (z - this.oz) * inv;
    if (fx < 0) fx = 0;
    else if (fx > cells - 1e-6) fx = cells - 1e-6;
    if (fz < 0) fz = 0;
    else if (fz > cells - 1e-6) fz = cells - 1e-6;
    const ix = fx | 0;
    const iz = fz | 0;
    const u = fx - ix;
    const v = fz - iz;
    const i00 = iz * stride + ix;
    const h00 = heights[i00];
    const h10 = heights[i00 + 1];
    const h01 = heights[i00 + stride];
    const h11 = heights[i00 + stride + 1];
    let dhdx, dhdz;
    if (u >= v) {
      out.h = h00 + u * (h10 - h00) + v * (h11 - h10);
      dhdx = (h10 - h00) * inv;
      dhdz = (h11 - h10) * inv;
    } else {
      out.h = h00 + u * (h11 - h01) + v * (h01 - h00);
      dhdx = (h11 - h01) * inv;
      dhdz = (h01 - h00) * inv;
    }
    const il = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
    out.nx = -dhdx * il;
    out.ny = il;
    out.nz = -dhdz * il;
    out.s = this.surf[iz * cells + ix];
    return out;
  }

  // ---------------------------------------------------------------- boxes
  /**
   * Oriented box collider. Rotation: yaw about Y, then pitch about the box's
   * local X axis (so a pitched box is a ramp), then roll about local Z.
   * @param {{x,y,z,hx,hy,hz,yaw?,pitch?,roll?,surface?}} b
   */
  addBox(b) {
    const yaw = b.yaw || 0;
    const pitch = b.pitch || 0;
    const roll = b.roll || 0;
    // R = Ry(yaw) * Rx(pitch) * Rz(roll)  (columns are local axes in world space)
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // Rx*Rz
    const a00 = cr, a01 = -sr, a02 = 0;
    const a10 = cp * sr, a11 = cp * cr, a12 = -sp;
    const a20 = sp * sr, a21 = sp * cr, a22 = cp;
    // Ry * (Rx*Rz)
    const m = [
      cy * a00 + sy * a20, cy * a01 + sy * a21, cy * a02 + sy * a22,
      a10, a11, a12,
      -sy * a00 + cy * a20, -sy * a01 + cy * a21, -sy * a02 + cy * a22,
    ];
    const box = {
      x: b.x, y: b.y, z: b.z,
      hx: b.hx, hy: b.hy, hz: b.hz,
      m, // row-major world<-local
      surface: b.surface ?? SURFACE.CONCRETE,
      yaw, pitch, roll,
      color: b.color,
      kind: b.kind || 'box',
    };
    // world AABB
    const ex = Math.abs(m[0]) * b.hx + Math.abs(m[1]) * b.hy + Math.abs(m[2]) * b.hz;
    const ey = Math.abs(m[3]) * b.hx + Math.abs(m[4]) * b.hy + Math.abs(m[5]) * b.hz;
    const ez = Math.abs(m[6]) * b.hx + Math.abs(m[7]) * b.hy + Math.abs(m[8]) * b.hz;
    box.minX = b.x - ex; box.maxX = b.x + ex;
    box.minY = b.y - ey; box.maxY = b.y + ey;
    box.minZ = b.z - ez; box.maxZ = b.z + ez;
    this.boxes.push(box);
    this._grid = null;
    return box;
  }

  /** Build the broad-phase grid; call after all boxes were added. */
  finalize() {
    const cell = 8;
    const gx = Math.ceil((this.maxX - this.ox) / cell);
    const gz = Math.ceil((this.maxZ - this.oz) / cell);
    const lists = new Array(gx * gz);
    for (let b = 0; b < this.boxes.length; b++) {
      const bx = this.boxes[b];
      const x0 = Math.max(0, Math.floor((bx.minX - this.ox) / cell));
      const x1 = Math.min(gx - 1, Math.floor((bx.maxX - this.ox) / cell));
      const z0 = Math.max(0, Math.floor((bx.minZ - this.oz) / cell));
      const z1 = Math.min(gz - 1, Math.floor((bx.maxZ - this.oz) / cell));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const k = z * gx + x;
        (lists[k] || (lists[k] = [])).push(b);
      }
    }
    this._grid = { cell, gx, gz, lists };
  }

  /** Candidate boxes for a world position (array or undefined). */
  boxesAt(x, z) {
    const g = this._grid;
    if (!g) return undefined;
    const cx = Math.floor((x - this.ox) / g.cell);
    const cz = Math.floor((z - this.oz) / g.cell);
    if (cx < 0 || cz < 0 || cx >= g.gx || cz >= g.gz) return undefined;
    return g.lists[cz * g.gx + cx];
  }
}

/** Convenience: a perfectly flat test world. */
export function flatWorld(size = 400, cell = 4, height = 0) {
  const n = Math.round(size / cell);
  const t = new Terrain(n, cell, -size / 2, -size / 2);
  t.heights.fill(height);
  t.finalize();
  return t;
}
