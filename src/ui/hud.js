// DOM/canvas HUD: tachometer, speed, gear, status pills, damage bar, toasts.
export class Hud {
  constructor() {
    this.el = {
      root: document.getElementById('hud'),
      name: document.getElementById('vehicle-name'),
      speed: document.getElementById('speed'),
      unit: document.getElementById('speed-unit'),
      gear: document.getElementById('gear'),
      tacho: document.getElementById('tacho'),
      dmg: document.getElementById('dbar-fill'),
      toast: document.getElementById('toast'),
      debug: document.getElementById('debugtxt'),
      abs: document.getElementById('abs-pill'), tcs: document.getElementById('tcs-pill'),
      lights: document.getElementById('lights-pill'), hb: document.getElementById('hb-pill'), low: document.getElementById('low-pill'),
    };
    this.ctx = this.el.tacho.getContext('2d');
    this.mph = false;
    this.toastTimer = 0;
    this.rpmSmooth = 0;
  }

  toast(text, ms = 1600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  setVehicle(v) {
    const c = v.cfg;
    this.el.name.innerHTML = `${c.title}<small>${c.cls} · ${c.engine} · ${c.power} · ${c.drive}</small>`;
  }

  draw(v, dt) {
    const d = v.drive, e = d.cfg.engine;
    const kmh = Math.abs(v.frame.speed) * 3.6;
    this.el.speed.textContent = Math.round(this.mph ? kmh * 0.621371 : kmh);
    this.el.unit.textContent = this.mph ? 'mph' : 'km/h';
    this.el.gear.textContent = d.gearLabel + (d.auto ? '' : ' M');
    this.rpmSmooth += (d.rpm - this.rpmSmooth) * Math.min(1, dt * 25);
    const frac = Math.min(1.08, this.rpmSmooth / (e.redline + 400));
    const g = this.ctx, W = 300, c = W / 2;
    g.clearRect(0, 0, W, W);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineCap = 'round';
    g.lineWidth = 14; g.strokeStyle = 'rgba(10,12,16,.55)';
    g.beginPath(); g.arc(c, c, 118, a0, a1); g.stroke();
    const redStart = e.redline / (e.redline + 400);
    // coloured portion
    const grad = g.createLinearGradient(40, 260, 260, 40);
    grad.addColorStop(0, '#ffb347'); grad.addColorStop(0.75, '#ff8a1f'); grad.addColorStop(1, '#ff2d2d');
    g.strokeStyle = grad; g.lineWidth = 10;
    g.beginPath(); g.arc(c, c, 118, a0, a0 + (a1 - a0) * Math.min(frac, 1.0)); g.stroke();
    // ticks
    g.lineWidth = 2; g.font = '600 13px system-ui'; g.fillStyle = '#d6deea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const maxK = Math.ceil((e.redline + 400) / 1000);
    for (let k = 0; k <= maxK; k++) {
      const f = (k * 1000) / (e.redline + 400); if (f > 1.0) break;
      const a = a0 + (a1 - a0) * f;
      g.strokeStyle = k * 1000 >= e.redline ? '#ff4040' : '#c9d2de';
      g.beginPath(); g.moveTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100); g.lineTo(c + Math.cos(a) * 108, c + Math.sin(a) * 108); g.stroke();
      g.fillText(String(k), c + Math.cos(a) * 86, c + Math.sin(a) * 86);
    }
    // needle
    const an = a0 + (a1 - a0) * Math.min(frac, 1.05);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(c + Math.cos(an) * 40, c + Math.sin(an) * 40); g.lineTo(c + Math.cos(an) * 104, c + Math.sin(an) * 104); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(c, c, 6, 0, 7); g.fill();
    g.fillStyle = '#9aa7b8'; g.font = '11px system-ui'; g.fillText('x1000 rpm', c, 270);
    // pills
    const set = (el, on, warn) => { el.classList.toggle('on', !!on && !warn); el.classList.toggle('warn', !!warn); };
    set(this.el.abs, d.abs); set(this.el.tcs, d.tcs, d.tcsActive); set(this.el.lights, v.view?.lightsOn);
    set(this.el.hb, v.input.handbrake > 0, v.input.handbrake > 0);
    this.el.low.style.display = d.cfg.transferLow ? '' : 'none';
    set(this.el.low, d.lowRange);
    this.el.dmg.style.width = `${Math.round(v.damage.fraction * 100)}%`;
  }
}
