import * as THREE from '../vendor/three.module.min.js';
import { createRenderer, createScene } from './render/scene.js';
import { buildMap } from './world/map.js';
import { buildWorldView } from './render/worldView.js';
import { Vehicle } from './physics/vehicle.js';
import { Simulation } from './physics/sim.js';
import { settleBlueprint } from './physics/settle.js';
import { VehicleView } from './render/vehicleView.js';
import { DebugView } from './render/debugView.js';
import { CameraRig } from './render/cameras.js';
import { Input } from './input.js';
import { Hud } from './ui/hud.js';
import { AudioEngine } from './audio/engineAudio.js';
import { buildKestrel } from './vehicles/kestrel.js';
import { buildVulcan } from './vehicles/vulcan.js';
import { buildBruiser } from './vehicles/bruiser.js';

const CARS = [
  { id: 'kestrel', label: 'Kestrel S', build: buildKestrel },
  { id: 'vulcan', label: 'Vulcan GT', build: buildVulcan },
  { id: 'bruiser', label: 'Bruiser 4x4', build: buildBruiser },
];

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const setLoad = async (frac, text) => { $('load-bar').style.width = `${Math.round(frac * 100)}%`; $('load-text').textContent = text; await nextFrame(); };

const params = new URLSearchParams(location.search);

async function main() {
  await setLoad(0.02, 'Creating renderer…');
  const canvas = $('view');
  const renderer = createRenderer(canvas);
  const { scene, follow, updateSky } = createScene(renderer);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  await setLoad(0.08, 'Generating the Proving Grounds…');
  const map = buildMap();
  const terrain = map.terrain;
  await setLoad(0.2, 'Painting terrain…');
  buildWorldView(map, scene);

  const sim = new Simulation(terrain, { dt: 1 / 2000 });
  const blueprints = {};
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i];
    await setLoad(0.25 + 0.2 * i, `Building ${c.label} (nodes, beams, suspension)…`);
    const bp = c.build();
    await setLoad(0.25 + 0.2 * i + 0.1, `Setting ride height: ${c.label}…`);
    settleBlueprint(bp);
    blueprints[c.id] = bp;
  }
  await setLoad(0.9, 'Spawning vehicles…');

  const input = new Input(canvas);
  const hud = new Hud();
  const audio = new AudioEngine();
  const rig = new CameraRig(camera);
  const vehicles = []; // {v, view, debug, id}
  let current = null;
  let debugOn = false;

  const refreshPanel = () => {
    const list = $('vlist');
    list.innerHTML = '';
    vehicles.forEach((e, i) => {
      const d = document.createElement('div');
      d.className = 'vitem' + (e === current ? ' sel' : '');
      d.innerHTML = `<span>${i + 1}. ${e.v.cfg.title}</span><span class="dm">${Math.round(e.v.damage.fraction * 100)}%</span>`;
      d.onclick = () => select(e);
      list.appendChild(d);
    });
  };
  const select = (e) => {
    if (current) { current.v.keepAwake = false; current.v.input.throttle = current.v.input.brake = current.v.input.steer = 0; current.v.input.handbrake = 0; }
    current = e; e.v.keepAwake = true; e.v.wake();
    hud.setVehicle(e.v);
    input.steer = input.throttle = input.brake = 0;
    refreshPanel();
  };
  const spawn = (id, x, z, yaw) => {
    if (vehicles.length >= 8) { hud.toast('Vehicle limit reached'); return null; }
    const bp = blueprints[id];
    const v = new Vehicle(bp);
    v.place(x, z, yaw, terrain, 0.02);
    sim.add(v);
    const view = new VehicleView(v, scene);
    v.view = view;
    const entry = { v, view, debug: null, id, spawn: { x, z, yaw } };
    vehicles.push(entry);
    // settle one tick so wheels sit on the ground before the first frame
    v.frameUpdate(0); view.update();
    return entry;
  };
  const spawnPoints = map.spawn;
  const first = spawn('kestrel', spawnPoints[1].x, spawnPoints[1].z, 0);
  spawn('vulcan', spawnPoints[0].x, spawnPoints[0].z, 0);
  spawn('bruiser', spawnPoints[2].x, spawnPoints[2].z, 0);
  select(first);

  // spawn menu
  CARS.forEach((c) => {
    const b = document.createElement('button');
    b.textContent = `+ ${c.label}`;
    b.onclick = () => {
      const e = vehicles.indexOf(current) >= 0 ? current : vehicles[0];
      const f = e.v.frame;
      const yaw = Math.atan2(-f.f[0], -f.f[2]);
      const x = f.com[0] + f.f[0] * 7 + f.r[0] * 4, z = f.com[2] + f.f[2] * 7 + f.r[2] * 4;
      const n = spawn(c.id, x, z, headingOf(f));
      if (n) { select(n); hud.toast(`${c.label} spawned`); }
    };
    $('spawn-btns').appendChild(b);
  });
  const headingOf = (f) => Math.atan2(-f.f[0], -f.f[2]); // yaw so that yaw=0 faces -Z, positive turns left

  const respawn = (e) => {
    const sp = e.spawn;
    e.v.place(sp.x, sp.z, sp.yaw, terrain, 0.02);
    e.v.wake();
    e.view.hidden = new Set(); e.view._rebuildIndex();
    input.steer = 0;
  };

  $('loading').classList.add('done');
  $('hud').classList.remove('hidden');
  $('panel').classList.remove('hidden');
  setTimeout(() => { $('loading').style.display = 'none'; }, 700);
  hud.toast('W/S throttle & brake · A/D steer · H for controls', 3500);

  // ------------------------------------------------------------ main loop
  let last = performance.now();
  let fpsAvg = 60, showStats = false, paused = false, slow = false;
  let panelTimer = 0;
  let audioStarted = false;

  const toggles = () => {
    const v = current.v, d = v.drive;
    if (input.was('Tab')) { select(vehicles[(vehicles.indexOf(current) + 1) % vehicles.length]); hud.toast(current.v.cfg.title); }
    for (let i = 1; i <= 9; i++) if (input.was('Digit' + i) && vehicles[i - 1]) select(vehicles[i - 1]);
    if (input.was('KeyC') || input.padPress(3)) hud.toast(`Camera: ${rig.next()}`);
    if (input.was('KeyL') || input.padPress(1)) { current.view.setLights(!current.view.lightsOn); hud.toast(current.view.lightsOn ? 'Lights on' : 'Lights off'); }
    if (input.was('KeyB')) { d.abs = !d.abs; hud.toast(`ABS ${d.abs ? 'on' : 'off'}`); }
    if (input.was('KeyY')) { d.tcs = !d.tcs; hud.toast(`Traction control ${d.tcs ? 'on' : 'off'}`); }
    if (input.was('KeyM')) { const a = d.toggleAuto(); hud.toast(a ? 'Automatic gearbox' : 'Manual gearbox'); }
    if (input.was('KeyG') && d.cfg.transferLow) { d.lowRange = !d.lowRange; hud.toast(d.lowRange ? '4WD low range' : '4WD high range'); }
    if (input.was('KeyU')) { hud.mph = !hud.mph; }
    if (input.was('KeyH')) $('help').classList.toggle('hidden');
    if (input.was('KeyF')) { showStats = !showStats; if (!showStats) $('debugtxt').textContent = ''; }
    if (input.was('KeyV')) $('panel').classList.toggle('hidden');
    if (input.was('KeyP')) { paused = !paused; hud.toast(paused ? 'Paused' : 'Resumed'); }
    if (input.was('KeyT')) { slow = !slow; sim.timeScale = slow ? 0.12 : 1; hud.toast(slow ? 'Slow motion' : 'Normal speed'); }
    if (input.was('KeyN')) {
      debugOn = !debugOn;
      for (const e of vehicles) { if (debugOn && !e.debug) e.debug = new DebugView(e.v, scene); if (e.debug) e.debug.visible = debugOn; }
      for (const e of vehicles) e.view.bodyMesh.visible = !debugOn;
      hud.toast(debugOn ? 'Node / beam view' : 'Normal view');
    }
    if (input.was('KeyR') || input.padPress(2)) { v.recover(terrain); hud.toast('Recovered'); }
    if (input.was('Backspace')) { const sp = { x: v.frame.com[0], z: v.frame.com[2], yaw: headingOf(v.frame) }; current.spawn = current.spawn; v.place(sp.x, sp.z, sp.yaw, terrain, 0.3); v.wake(); current.view._rebuildIndex(); hud.toast('Repaired'); }
    if (input.was('Home')) { respawn(current); hud.toast('Back to spawn'); }
    if (input.was('Delete') && vehicles.length > 1) {
      const idx = vehicles.indexOf(current);
      const e = current; sim.remove(e.v); e.view.dispose(); if (e.debug) e.debug.dispose();
      vehicles.splice(idx, 1);
      select(vehicles[Math.min(idx, vehicles.length - 1)]);
    }
  };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAvg += (1 / Math.max(dt, 1e-4) - fpsAvg) * 0.05;
    if (!audioStarted && (input.pressed.size || input.mouse.down)) { audio.start(); audioStarted = true; }
    toggles();
    if (!paused) {
      input.drive(current.v, dt);
      if (!current.v.alive) { respawn(current); current.v.alive = true; hud.toast('Simulation reset'); }
      sim.advance(dt, 9);
    }
    for (const e of vehicles) {
      if (!e.v.alive) { e.v.alive = true; respawn(e); }
      e.view.update();
      if (e.debug && debugOn) e.debug.update();
    }
    const v = current.v;
    rig.update(v, dt, input, terrain);
    follow(new THREE.Vector3(v.frame.com[0], v.frame.com[1], v.frame.com[2]));
    updateSky(camera.position);
    hud.draw(v, dt);
    audio.update(v, dt);
    panelTimer += dt;
    if (panelTimer > 0.5) { panelTimer = 0; refreshPanel(); }
    if (showStats) {
      $('debugtxt').textContent = `fps ${fpsAvg.toFixed(0)}   physics ${sim.lastStepMs.toFixed(1)} ms${sim.behind ? ' (behind)' : ''}\nnodes ${v.nc}  beams ${v.bc}  deformed ${v.damage.deformed}  broken ${v.damage.broken}\nrpm ${v.drive.rpm.toFixed(0)}  gear ${v.drive.gearLabel}  clutch ${v.drive.clutchEng.toFixed(2)}\nsteer ${v.steerAngle.toFixed(2)}  surface ${v.surfaceUnderWheel.name}\nwheel loads ${v.wheels.map((w) => w.load.toFixed(0)).join(' ')}`;
    }
    renderer.render(scene, camera);
    input.endFrame();
  }
  requestAnimationFrame(frame);

  window.__game = { sim, vehicles, rig, camera, scene, renderer, input, select, map, hud, get current() { return current; }, setPaused: (p) => { paused = p; } };
}

main().catch((e) => {
  console.error(e);
  const t = document.getElementById('load-text');
  if (t) { t.style.color = '#ff6b6b'; t.textContent = 'Error: ' + (e && e.message ? e.message : e); }
});
