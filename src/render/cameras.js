import * as THREE from '../../vendor/three.module.min.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // 0 chase, 1 hood, 2 cockpit, 3 orbit, 4 high chase
    this.names = ['Chase', 'Hood', 'Cockpit', 'Orbit', 'Overhead'];
    this.heading = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.orbit = { yaw: 0.6, pitch: 0.28, dist: 7.5 };
    this.init = false;
    this.shake = 0;
    this.fovBase = 62;
  }

  next() { this.mode = (this.mode + 1) % this.names.length; this.init = false; return this.names[this.mode]; }

  update(vehicle, dt, input, terrain) {
    const f = vehicle.frame, cam = this.camera;
    const com = new THREE.Vector3(f.com[0], f.com[1], f.com[2]);
    const fw = new THREE.Vector3(f.f[0], f.f[1], f.f[2]);
    const up = new THREE.Vector3(f.u[0], f.u[1], f.u[2]);
    const right = new THREE.Vector3(f.r[0], f.r[1], f.r[2]);
    const speed = Math.abs(f.speed);
    const spec = vehicle.bp.spec.visual.camera || {};
    // heading follows the velocity direction when moving fast (sliding cars show their angle)
    const hd = Math.atan2(fw.x, -fw.z);
    let target = hd;
    if (speed > 3) { const vd = Math.atan2(f.vcom[0], -f.vcom[2]); const sgn = f.speed < 0 ? Math.PI : 0; target = f.speed > 0 ? vd : hd; }
    let dh = target - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * (this.init ? 3.2 : 100));
    const orbit = this.orbit;
    if (input.mouse.down) { orbit.yaw -= input.mouse.dx * 0.005; orbit.pitch = Math.max(-0.2, Math.min(1.4, orbit.pitch + input.mouse.dy * 0.004)); }
    orbit.dist = Math.max(3, Math.min(30, orbit.dist * (1 + input.mouse.wheel * 0.08)));
    let fov = this.fovBase + Math.min(14, speed * 0.2);
    if (this.mode === 0 || this.mode === 4) {
      const dist = (spec.dist ?? 7.2) * (this.mode === 4 ? 1.8 : 1) * (1 + (input.mouse.wheel ? 0 : 0));
      const h = (spec.height ?? 2.5) * (this.mode === 4 ? 2.4 : 1);
      const yaw = this.heading + (input.mouse.down ? 0 : 0) + (this.userYaw || 0);
      if (input.mouse.down) this.userYaw = (this.userYaw || 0) - input.mouse.dx * 0.005; else this.userYaw = (this.userYaw || 0) * (1 - Math.min(1, dt * 1.5));
      const yw = this.heading + (this.userYaw || 0);
      const dir = new THREE.Vector3(Math.sin(yw), 0, -Math.cos(yw));
      const want = com.clone().addScaledVector(dir, -dist).add(new THREE.Vector3(0, h, 0));
      const gh = terrain.heightAt(want.x, want.z) + 0.8;
      if (want.y < gh) want.y = gh;
      if (!this.init) { this.pos.copy(want); this.look.copy(com); this.init = true; }
      this.pos.lerp(want, Math.min(1, dt * 7));
      const wl = com.clone().addScaledVector(dir, 3).add(new THREE.Vector3(0, 0.9, 0));
      this.look.lerp(wl, Math.min(1, dt * 9));
      cam.position.copy(this.pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(this.look);
    } else if (this.mode === 1 || this.mode === 2) {
      const e = this.mode === 1 ? (spec.hood || [0, 1.15, 1.0]) : (spec.eye || [-0.38, 1.18, 0.05]);
      // eye in vehicle-local axes: x right, y up, f forward from the car's centre of mass projection
      const cr = vehicle.comRest;
      const p = com.clone().addScaledVector(right, e[0]).addScaledVector(up, e[1] - cr[1]).addScaledVector(fw, e[2] + cr[2]);
      cam.position.copy(p);
      cam.up.copy(up);
      cam.lookAt(p.clone().addScaledVector(fw, 10).addScaledVector(up, -0.4));
      fov = this.mode === 2 ? 74 : 70;
      this.init = true;
    } else {
      const o = orbit;
      const p = new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist).add(com);
      const gh = terrain.heightAt(p.x, p.z) + 0.5; if (p.y < gh) p.y = gh;
      cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(com);
      this.init = true;
    }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  }
}
