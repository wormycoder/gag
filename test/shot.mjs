// Headless browser smoke test + screenshots:  node test/shot.mjs [outDir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const out = process.argv[2] || '/tmp/claude-0/shots';
const server = spawn('node', ['server.js', '8123'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
await page.goto('http://localhost:8123/index.html');
try { await page.waitForFunction(() => window.__game, null, { timeout: 120000 }); } catch (e) { console.log('timeout waiting for game'); }
const txt = await page.evaluate(() => document.getElementById('load-text')?.textContent);
console.log('load text:', txt);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/chase.png` });
console.log('stats', await page.evaluate(() => ({ fps: 0, veh: window.__game?.vehicles.length, ms: window.__game?.sim.lastStepMs })));
await browser.close(); server.kill();
