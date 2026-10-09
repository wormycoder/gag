// Keyboard + gamepad input, turned into vehicle controls with speed-sensitive
// steering and auto-reverse handling left to the gearbox.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // one-shot presses
    this.mouse = { dx: 0, dy: 0, wheel: 0, down: false };
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.pad = null;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => { this.mouse.down = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', (e) => { this.mouse.down = false; });
    canvas.addEventListener('pointermove', (e) => { if (this.mouse.down) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    this.padPrev = {};
  }

  was(code) { return this.pressed.has(code); }
  held(...codes) { return codes.some((c) => this.keys.has(c)); }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = [...pads].find((g) => g && g.connected);
    this.pad = p || null;
    return p;
  }

  padPress(i) {
    const p = this.pad; if (!p) return false;
    const now = !!p.buttons[i]?.pressed;
    const was = this.padPrev[i];
    this.padPrev[i] = now;
    return now && !was;
  }

  /** Apply driver controls to a vehicle. */
  drive(vehicle, dt) {
    const v = vehicle, inp = v.input;
    const p = this.pollPad();
    let thr = this.held('KeyW', 'ArrowUp') ? 1 : 0;
    let brk = this.held('KeyS', 'ArrowDown') ? 1 : 0;
    let steerTarget = (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0);
    let hb = this.held('Space') ? 1 : 0;
    let analog = false;
    if (p) {
      const dz = (x) => (Math.abs(x) < 0.08 ? 0 : (x - Math.sign(x) * 0.08) / 0.92);
      const sx = dz(p.axes[0] || 0);
      if (sx !== 0) { steerTarget = sx; analog = true; }
      const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
      if (rt > 0.02) thr = Math.max(thr, rt);
      if (lt > 0.02) brk = Math.max(brk, lt);
      if (p.buttons[0]?.pressed) hb = 1;
    }
    const speed = Math.abs(v.frame.speed);
    // less steering lock at speed (like a real driver / assisted wheel)
    const limit = 1 / (1 + Math.pow(speed / 24, 1.7));
    const target = steerTarget * (analog ? Math.max(limit, 0.22) : Math.max(limit, 0.16));
    if (analog) this.steer += (target - this.steer) * Math.min(1, dt * 14);
    else {
      const toward = Math.sign(target - this.steer);
      const centering = target === 0 || Math.sign(target) !== Math.sign(this.steer);
      const rate = centering ? 5.0 : 2.8 / (1 + speed / 18);
      const step = rate * dt;
      this.steer = Math.abs(target - this.steer) < step ? target : this.steer + toward * step;
    }
    // smooth pedals a little
    this.throttle += (thr - this.throttle) * Math.min(1, dt * 12);
    this.brake += (brk - this.brake) * Math.min(1, dt * 14);
    inp.throttle = thr > 0 ? this.throttle : thr === 0 && this.throttle < 0.02 ? 0 : this.throttle;
    inp.brake = this.brake < 0.01 ? 0 : this.brake;
    inp.steer = clamp(this.steer, -1, 1);
    inp.handbrake = hb;
    inp.clutch = 0;
    if (this.was('KeyE') || this.padPress(5)) inp.shiftUp = true;
    if (this.was('KeyQ') || this.padPress(4)) inp.shiftDown = true;
  }
}
