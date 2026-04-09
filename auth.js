// auth.js  –  Grow-a-Garden
// Login, signup, signout. Uses garden_players node in Firebase.

window.Auth = (() => {

  const ADMINS = { cucumber: 'cucumber', admin: 'admin123', worm: 'Thomas47!' };

  async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const err      = document.getElementById('loginErr');
    err.textContent = '';

    if (!username || !password) { err.textContent = '⚠ Fill in all fields'; return; }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'ENTERING...';

    // Admin shortcut
    if (ADMINS[username] && ADMINS[username] === password) {
      await startGame(username, true, {});
      return;
    }

    try {
      const snap = await DB.get(DB.ref(`gag/players/${username}`));
      if (!snap.exists()) {
        err.textContent = '⚠ Username not found';
        btn.disabled = false; btn.textContent = '▶ ENTER GARDEN'; return;
      }
      const data = snap.val();
      if (data.password !== btoa(password)) {
        err.textContent = '⚠ Incorrect password';
        btn.disabled = false; btn.textContent = '▶ ENTER GARDEN'; return;
      }
      await startGame(username, false, data);
    } catch(e) {
      err.textContent = '⚠ ' + e.message;
      btn.disabled = false; btn.textContent = '▶ ENTER GARDEN';
    }
  }

  async function doSignup() {
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const err      = document.getElementById('signupErr');
    err.textContent = '';

    if (!username || !password) { err.textContent = '⚠ Fill in all fields'; return; }
    if (username.length < 3)   { err.textContent = '⚠ Username min 3 characters'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { err.textContent = '⚠ Letters, numbers and _ only'; return; }
    if (password.length < 6)   { err.textContent = '⚠ Password min 6 characters'; return; }
    if (ADMINS[username])      { err.textContent = '⚠ Username is reserved'; return; }

    const btn = document.getElementById('signupBtn');
    btn.disabled = true; btn.textContent = 'CREATING...';

    try {
      const snap = await DB.get(DB.ref(`gag/players/${username}`));
      if (snap.exists()) {
        err.textContent = '⚠ Username already taken';
        btn.disabled = false; btn.textContent = '🌱 CREATE ACCOUNT'; return;
      }

      const newData = {
        username,
        password:   btoa(password),
        coins:      40,
        gems:       0,
        hotbar:     Array(9).fill(null),
        backpack:   [],
        garden:     {},
        ownedPets:  [],
        pets:       [],
        inventory:  {},
        createdAt:  Date.now(),
        lastSeen:   Date.now(),
        online:     true,
      };

      await DB.set(DB.ref(`gag/players/${username}`), newData);
      await startGame(username, false, newData);
    } catch(e) {
      err.textContent = '⚠ ' + e.message;
      btn.disabled = false; btn.textContent = '🌱 CREATE ACCOUNT';
    }
  }

  async function startGame(username, isAdmin, data) {
    setLoadingMsg('PREPARING GARDEN...', 80);

    // Init player state
    await Player.init(username, isAdmin, data);

    // Show HUD
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('gameCanvas').classList.remove('screen-hidden');
    document.getElementById('hud').classList.remove('screen-hidden');
    document.getElementById('hudUsername').textContent = username + (isAdmin ? ' 🛡' : '');

    // Admin button
    if (isAdmin) {
      document.getElementById('adminTopBtn').style.display = '';
    }

    UI.updateCurrencyUI();
    UI.renderHotbar();

    // Init world (Three.js)
    setLoadingMsg('BUILDING WORLD...', 90);
    console.log('[Auth] starting World.init');
    const _t0 = performance.now();
    World.init();
    console.log('[Auth] World.init returned in', (performance.now()-_t0).toFixed(1), 'ms');

    // Load saved plants
    const _t1 = performance.now();
    Garden.loadExisting();
    console.log('[Auth] Garden.loadExisting:', (performance.now()-_t1).toFixed(1), 'ms');

    // Wire canvas click for planting/shovel
    document.getElementById('gameCanvas').addEventListener('mousedown', e => {
      if (e.button === 0) Garden.onWorldClick(e);
    });

    // Hold E tracking
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && !e.repeat && !window._anyModalOpen?.()) {
        Garden.setHoldE(true);
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'KeyE') Garden.setHoldE(false);
    });

    // Start events listener
    Events.init();
    Events.startAutoEvents();

    // Listen for trade requests
    Trading.initIncomingListener();

    // Admin / personal notification listeners
    UI.listenAdminMessages();
    UI.listenPersonalNotifs(username);

    // Mark online
    DB.update(DB.ref(`gag/players/${username}`), {
      online: true, lastSeen: Date.now()
    });

    // Heartbeat every 2 minutes
    setInterval(() => {
      DB.update(DB.ref(`gag/players/${username}`), { lastSeen: Date.now() });
    }, 120000);

    // Dismiss loading
    setLoadingMsg('READY!', 100);
    setTimeout(() => {
      document.getElementById('loadingVeil').classList.add('fade-out');
      setTimeout(() => document.getElementById('loadingVeil').style.display = 'none', 700);
    }, 400);

    UI.showNotif(`🌱 Welcome${isAdmin?' Admin':''}, ${username}!`, 'success');
  }

  async function signOut() {
    if (Player.state.username) {
      await Player.save();
      await DB.update(DB.ref(`gag/players/${Player.state.username}`), { online: false });
    }
    location.reload();
  }

  function setLoadingMsg(msg, pct) {
    const el  = document.getElementById('loadingMsg');
    const bar = document.getElementById('loadingBar');
    if (el)  el.textContent = msg;
    if (bar) bar.style.width = pct + '%';
  }

  return { doLogin, doSignup, signOut };
})();