import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const out = process.argv[2] || '/tmp/claude-0/shots';
const which = (process.argv[3] || 'kestrel,vulcan,bruiser').split(',');
const views = (process.argv[4] || 'front34,side,rear34').split(',');
const server = spawn('node', ['server.js', '8124'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.type(), m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
await page.goto('http://localhost:8124/index.html');
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; document.getElementById('panel').style.display = 'none'; document.getElementById('hint').style.display = 'none'; });
const angles = { front34: [2.4, 0.2], side: [1.5708, 0.08], rear34: [0.8, 0.2], front: [3.14, 0.1], top: [0.5, 1.2] };
for (const car of which) {
  for (const vw of views) {
    const [yaw, pitch] = angles[vw];
    await page.evaluate(({ car, yaw, pitch }) => {
      const g = window.__game;
      const e = g.vehicles.find((v) => v.id === car); g.select(e);
      g.rig.mode = 3; g.rig.orbit.yaw = yaw; g.rig.orbit.pitch = pitch; g.rig.orbit.dist = car === 'bruiser' ? 10 : 7.5;
    }, { car, yaw, pitch });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${car}_${vw}.png` });
  }
}
await browser.close(); server.kill();
