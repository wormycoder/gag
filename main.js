// main.js  –  Grow-a-Garden
// Entry point: imports all modules in dependency order.

// Because this is a module script, all imports execute in order.
// Each file attaches itself to window.* so non-module onclick
// handlers can reach them.

import "./firebase-init.js";
import "./data.js";
import "./player.js";
import "./world.js";
import "./garden.js";
import "./shops.js";
import "./pets.js";
import "./events.js";
import "./trading.js";
import "./admin.js";
import "./ui.js";
import "./auth.js";

// Load admin-added seeds/gear/eggs into DATA before game starts
DATA.loadAdminContent().catch(() => {});

// ── BOOT SEQUENCE ──────────────────────────────────────────
// Wait for DOM + all scripts to initialise, then show login.
window.addEventListener('DOMContentLoaded', () => {
  // Small delay so fonts load
  setTimeout(() => {
    // Animate loading bar to 60% on initial load
    const bar = document.getElementById('loadingBar');
    if (bar) bar.style.width = '60%';

    const msg = document.getElementById('loadingMsg');
    if (msg) msg.textContent = 'CONNECTING TO SERVERS...';

    // Show login after brief pause
    setTimeout(() => {
      document.getElementById('loadingVeil').classList.add('fade-out');
      setTimeout(() => {
        document.getElementById('loadingVeil').style.display = 'none';
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('loginScreen').classList.remove('screen-hidden');
      }, 650);
    }, 900);
  }, 300);
});

// ── GLOBAL ERROR HANDLER ───────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
  if (window.UI) {
    UI.showNotif('⚠ Connection error — check console', 'error');
  }
});

// ── PREVENT DEFAULT BROWSER BEHAVIOURS ────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  // Prevent browser from scrolling with Space
  if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
  }
});