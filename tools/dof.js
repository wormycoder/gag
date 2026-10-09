import { buildKestrel } from '../src/vehicles/kestrel.js';
const bp = buildKestrel();
const N = (n) => { const i = bp.names.get(n); return [bp.pos[3*i], bp.pos[3*i+1], bp.pos[3*i+2]]; };
const body = ['fl_kup','fl_klo','fl_tie','fl_hi','fl_ho'];
const cons = [['fl_klo','fl_laf'],['fl_klo','fl_lar'],['fl_kup','fl_uaf'],['fl_kup','fl_uar'],['fl_tie','fl_rack']];
// rigid body motion: v = t + w x (p - c); constraint: d.(vp - va) = 0, anchors fixed
const c = N('fl_klo');
const rows = cons.map(([b,a]) => { const p = N(b), q = N(a); const d = [p[0]-q[0],p[1]-q[1],p[2]-q[2]]; const L = Math.hypot(...d); const u = d.map(x=>x/L); const r = [p[0]-c[0],p[1]-c[1],p[2]-c[2]]; // d.(t + w x r) = u.t + (r x u).w
  const rxu = [r[1]*u[2]-r[2]*u[1], r[2]*u[0]-r[0]*u[2], r[0]*u[1]-r[1]*u[0]]; return [...u, ...rxu]; });
// rank via gaussian elimination
const M = rows.map(r=>r.slice()); let rank=0; for (let col=0; col<6; col++){ let piv=-1,best=1e-9; for(let r=rank;r<M.length;r++) if(Math.abs(M[r][col])>best){best=Math.abs(M[r][col]);piv=r;} if(piv<0) continue; [M[rank],M[piv]]=[M[piv],M[rank]]; for(let r=0;r<M.length;r++){ if(r===rank) continue; const f=M[r][col]/M[rank][col]; for(let k=0;k<6;k++) M[r][k]-=f*M[rank][k]; } rank++; }
console.log('rank', rank, '=> DOF', 6-rank);
console.log(rows.map(r=>r.map(x=>x.toFixed(2)).join(' ')).join('\n'));
console.log('klo',N('fl_klo'),'kup',N('fl_kup'),'laf',N('fl_laf'),'lar',N('fl_lar'),'uaf',N('fl_uaf'),'uar',N('fl_uar'));
