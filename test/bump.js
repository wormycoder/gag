import { buildKestrel } from '../src/vehicles/kestrel.js';
const bp = buildKestrel();
const N = (n) => { const i = bp.names.get(n); return [bp.pos[3*i], bp.pos[3*i+1], bp.pos[3*i+2]]; };
const side = process.argv[2] || 'fl';
const kn = ['kup','klo','tie','hi','ho'].map(s=>N(`${side}_${s}`));
const anch = [['laf','klo'],['lar','klo'],['uaf','kup'],['uar','kup'],['rack','tie']].map(([a,b])=>({a:N(`${side}_${a}`), k:['kup','klo','tie','hi','ho'].indexOf(b)}));
const L = anch.map(c=>Math.hypot(...kn[c.k].map((x,i)=>x-c.a[i])));
const rotate=(v,r)=>{ const th=Math.hypot(...r); if(th<1e-12) return v.slice(); const k=r.map(x=>x/th); const c=Math.cos(th), s=Math.sin(th); const d=k[0]*v[0]+k[1]*v[1]+k[2]*v[2]; const cr=[k[1]*v[2]-k[2]*v[1],k[2]*v[0]-k[0]*v[2],k[0]*v[1]-k[1]*v[0]]; return [0,1,2].map(i=>v[i]*c+cr[i]*s+k[i]*d*(1-c)); };
const c0 = kn[1];
const pose=(x)=>kn.map(p=>{ const r=rotate(p.map((v,i)=>v-c0[i]), x.slice(3)); return r.map((v,i)=>v+c0[i]+x[i]); });
const resid=(x,dy)=>{ const P=pose(x); const out=anch.map((c,i)=>Math.hypot(...P[c.k].map((v,j)=>v-c.a[j]))-L[i]); out.push(P[1][1]-c0[1]-dy); return out; };
function solve(dy,x0){ let x=x0.slice(); for(let it=0;it<50;it++){ const r=resid(x,dy); const J=[]; for(let j=0;j<6;j++){ const xp=x.slice(); xp[j]+=1e-6; const rp=resid(xp,dy); J.push(rp.map((v,i)=>(v-r[i])/1e-6)); } // solve J^T dx = -r  (6x6)
  const A=r.map((_,i)=>J.map(col=>col[i])); const b=r.map(v=>-v); // gaussian
  const n=6; for(let c=0;c<n;c++){ let p=c; for(let i=c+1;i<n;i++) if(Math.abs(A[i][c])>Math.abs(A[p][c])) p=i; [A[c],A[p]]=[A[p],A[c]]; [b[c],b[p]]=[b[p],b[c]]; for(let i=c+1;i<n;i++){ const f=A[i][c]/A[c][c]; for(let k=c;k<n;k++) A[i][k]-=f*A[c][k]; b[i]-=f*b[c]; } } const dx=Array(n); for(let i=n-1;i>=0;i--){ let s=b[i]; for(let k=i+1;k<n;k++) s-=A[i][k]*dx[k]; dx[i]=s/A[i][i]; } x=x.map((v,i)=>v+dx[i]); if(Math.hypot(...dx)<1e-10) break; } return x; }
let x=[0,0,0,0,0,0];
for (const dy of [0,-0.02,-0.04,-0.06,-0.08,-0.1,-0.12]) { x=solve(dy,x); const P=pose(x); const v=[P[4][0]-P[3][0],P[4][1]-P[3][1],P[4][2]-P[3][2]]; console.log(`klo dy=${dy.toFixed(2)} toe=${(Math.atan2(v[2],-v[0])*180/Math.PI).toFixed(2)}deg  camber=${(Math.atan2(v[1],Math.abs(v[0]))*180/Math.PI).toFixed(2)} res=${Math.max(...resid(x,dy).map(Math.abs)).toExponential(1)}`); }
for (const dy of [0.02,0.04,0.06,0.08,0.1]) { x=solve(dy,x); const P=pose(x); const v=[P[4][0]-P[3][0],P[4][1]-P[3][1],P[4][2]-P[3][2]]; console.log(`klo dy=${dy.toFixed(2)} toe=${(Math.atan2(v[2],-v[0])*180/Math.PI).toFixed(2)}deg  camber=${(Math.atan2(v[1],Math.abs(v[0]))*180/Math.PI).toFixed(2)}`); }
