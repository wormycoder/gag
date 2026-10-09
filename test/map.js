import { buildMap } from '../src/world/map.js';
const t0 = performance.now();
const m = buildMap();
console.log('map built in', (performance.now() - t0).toFixed(0), 'ms; boxes', m.terrain.boxes.length);
const T = m.terrain;
console.log('height at origin', T.heightAt(0, 0).toFixed(2), 'at (0,300)', T.heightAt(0,300).toFixed(1), 'road start', T.heightAt(215, 0).toFixed(2), 'peak', T.heights.reduce((a,b)=>Math.max(a,b),-1e9).toFixed(0), 'min', T.heights.reduce((a,b)=>Math.min(a,b),1e9).toFixed(1));
// ramp check: sample first ramp top surface via brute force
for (const b of T.boxes.filter(b => b.kind === 'ramp')) {
  const dir = [-Math.sin(b.yaw), -Math.cos(b.yaw)];
  const top = (d) => { // find max world y of box along centre line at distance d from start
    const L = b.hz * 2 * Math.cos(b.pitch);
    const cx = b.x + dir[0] * (d - L / 2), cz = b.z + dir[1] * (d - L / 2);
    let y = -1; for (let yy = 12; yy > -2; yy -= 0.01) { const dx = cx - b.x, dy = yy - b.y, dz = cz - b.z; const m = b.m; const lx = m[0]*dx+m[3]*dy+m[6]*dz, ly = m[1]*dx+m[4]*dy+m[7]*dz, lz = m[2]*dx+m[5]*dy+m[8]*dz; if (Math.abs(lx) < b.hx && Math.abs(ly) < b.hy && Math.abs(lz) < b.hz) { y = yy; break; } } return y; };
  const L = b.hz * 2 * Math.cos(b.pitch);
  console.log('ramp len', L.toFixed(1), 'top@0.1m', top(0.1).toFixed(2), 'top@mid', top(L/2).toFixed(2), 'top@end-0.1', top(L-0.1).toFixed(2));
}
