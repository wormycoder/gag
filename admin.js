// admin.js  –  Grow-a-Garden
// Admin panel: events, give items, global messages, shop management, codes.

window.AdminPanel = (() => {

  let currentTab = 'events';

  function open() {
    if (!Player.state.isAdmin) return;
    document.getElementById('adminOverlay').style.display = 'flex';
    window._adminOpen = true;
    buildTabs();
    showTab('events');
  }

  function close() {
    document.getElementById('adminOverlay').style.display = 'none';
    window._adminOpen = false;
  }

  function buildTabs() {
    const tabBar = document.getElementById('adminTabs');
    tabBar.innerHTML = '';
    const tabs = [
      { id:'events',      label:'⚡ Events'   },
      { id:'give',        label:'🎁 Give'     },
      { id:'shopContent', label:'🏪 Shops'    },
      { id:'message',     label:'📢 Broadcast'},
      { id:'shop',        label:'🛒 Gem Shop' },
      { id:'codes',       label:'🔑 Codes'    },
      { id:'players',     label:'👥 Players'  },
    ];
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'admin-tab' + (t.id === currentTab ? ' active' : '');
      btn.textContent = t.label;
      btn.onclick = () => showTab(t.id);
      tabBar.appendChild(btn);
    });
  }

  function showTab(id) {
    currentTab = id;
    buildTabs();
    const body = document.getElementById('adminBody');
    body.innerHTML = '';

    if (id === 'events')      renderEvents(body);
    if (id === 'give')        renderGive(body);
    if (id === 'shopContent') renderShopContent(body);
    if (id === 'message')     renderMessage(body);
    if (id === 'shop')        renderShopMgr(body);
    if (id === 'codes')       renderCodes(body);
    if (id === 'players')     renderPlayers(body);
  }

  // ── EVENTS TAB ────────────────────────────────────────────
  function renderEvents(body) {
    // ✅ Always clear body first to prevent duplication on re-render
    body.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:14px;">
        <button id="evTabPreset" class="admin-tab active" onclick="AdminPanel._evTab('preset')">⚡ Preset Events</button>
        <button id="evTabCreate" class="admin-tab"        onclick="AdminPanel._evTab('create')">➕ Create Event</button>
      </div>

      <!-- PRESET EVENTS -->
      <div id="evFormPreset">
        <div class="admin-label">START A PRESET EVENT</div>
        <div id="adminEventGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:20px;"></div>
        <div class="admin-label">CUSTOM DURATION (seconds)</div>
        <input class="admin-input" type="number" id="adminEventDur" placeholder="Duration in seconds (default: event default)" value="">
        <div class="admin-label" style="margin-top:14px">ACTIVE EVENTS</div>
        <div id="adminActiveEvents"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>
      </div>

      <!-- CREATE EVENT -->
      <div id="evFormCreate" style="display:none">
        <div class="admin-label">CREATE CUSTOM EVENT</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label class="admin-label" style="font-size:7px">ID (no spaces)</label>
            <input class="admin-input" id="ev_id" placeholder="e.g. rainbow_hour"></div>
          <div><label class="admin-label" style="font-size:7px">NAME</label>
            <input class="admin-input" id="ev_name" placeholder="Rainbow Hour"></div>
          <div><label class="admin-label" style="font-size:7px">ICON (emoji)</label>
            <input class="admin-input" id="ev_icon" placeholder="🌈" maxlength="4"></div>
          <div><label class="admin-label" style="font-size:7px">MUTATION NAME</label>
            <input class="admin-input" id="ev_mutation" placeholder="e.g. Rainbow"></div>
          <div><label class="admin-label" style="font-size:7px">MUTATION CHANCE (0–1)</label>
            <input class="admin-input" type="number" step="0.01" min="0" max="1" id="ev_chance" placeholder="0.25"></div>
          <div><label class="admin-label" style="font-size:7px">DEFAULT DURATION (seconds)</label>
            <input class="admin-input" type="number" id="ev_duration" placeholder="120"></div>
          <div style="grid-column:1/-1"><label class="admin-label" style="font-size:7px">DESCRIPTION</label>
            <input class="admin-input" id="ev_desc" placeholder="Plants have a chance to mutate during this event!"></div>
        </div>
        <button class="admin-btn green" style="margin-top:10px;width:100%" onclick="AdminPanel._createEvent()">+ CREATE EVENT</button>

        <div class="admin-label" style="margin-top:20px">CUSTOM EVENTS</div>
        <div id="ev_existing_list"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>
      </div>
    `;
    body.appendChild(section);

    // Build preset grid
    _buildEventGrid(section);

    // Load active events
    _refreshActiveEvents(section);

    // Load custom events list
    _loadCustomEvents(section);
  }

  function _evTab(tab) {
    ['preset','create'].forEach(t => {
      const form = document.getElementById('evForm' + t.charAt(0).toUpperCase() + t.slice(1));
      const btn  = document.getElementById('evTab'  + t.charAt(0).toUpperCase() + t.slice(1));
      if (form) form.style.display = t === tab ? '' : 'none';
      if (btn)  btn.classList.toggle('active', t === tab);
    });
  }

  function _buildEventGrid(section) {
    const grid = section.querySelector('#adminEventGrid');
    if (!grid) return;
    grid.innerHTML = '';
    DATA.EVENTS.forEach(ev => {
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.borderColor = '#ff9800';
      el.innerHTML = `
        <div class="s-icon">${ev.icon}</div>
        <div class="s-name">${ev.name}</div>
        <div class="s-desc r-epic">${ev.mutation} mutation</div>
        <div class="s-desc" style="color:#8d6e63">${ev.mutationChance*100}% chance · ${ev.duration}s default</div>
        <button class="admin-btn green" style="margin-top:6px;width:100%">▶ START</button>
      `;
      // ✅ Only refresh the active events list, never re-render the whole tab
      el.querySelector('button').onclick = () => {
        const dur = parseInt(document.getElementById('adminEventDur')?.value) || ev.duration;
        Events.adminStartEvent(ev.id, dur);
        _refreshActiveEvents(section);
      };
      grid.appendChild(el);
    });
  }

  function _refreshActiveEvents(section) {
    const ae = section.querySelector('#adminActiveEvents');
    if (!ae) return;
    ae.innerHTML = '<div style="font-size:9px;color:#8d6e63">Loading...</div>';
    DB.get(DB.ref('gag/events')).then(snap => {
      ae.innerHTML = '';
      if (!snap.exists()) { ae.innerHTML = `<div style="font-size:9px;color:#8d6e63">No active events</div>`; return; }
      let any = false;
      snap.forEach(child => {
        const ev = child.val();
        if (!ev.active) return;
        any = true;
        const row = document.createElement('div');
        row.className = 'player-search-result';
        const remaining = Math.max(0, Math.round((ev.endsAt - Date.now()) / 1000));
        row.innerHTML = `
          <span>${ev.icon} ${ev.name} — ${remaining}s remaining</span>
          <button class="admin-btn red" onclick="Events.adminEndEvent('${child.key}')">END</button>
        `;
        ae.appendChild(row);
      });
      if (!any) ae.innerHTML = `<div style="font-size:9px;color:#8d6e63">No active events</div>`;
    }).catch(() => {
      ae.innerHTML = `<div style="font-size:9px;color:#ef5350">Error loading events</div>`;
    });
  }

  async function _createEvent() {
    const id       = document.getElementById('ev_id').value.trim().replace(/\s+/g,'_');
    const name     = document.getElementById('ev_name').value.trim();
    const icon     = document.getElementById('ev_icon').value.trim() || '⚡';
    const mutation = document.getElementById('ev_mutation').value.trim();
    const chance   = parseFloat(document.getElementById('ev_chance').value) || 0.25;
    const duration = parseInt(document.getElementById('ev_duration').value) || 120;
    const desc     = document.getElementById('ev_desc').value.trim();

    if (!id || !name || !mutation) { UI.showNotif('Fill in ID, Name and Mutation', 'error'); return; }
    if (DATA.EVENTS.find(e => e.id === id)) { UI.showNotif('Event ID already exists!', 'error'); return; }
    if (chance < 0 || chance > 1) { UI.showNotif('Chance must be between 0 and 1', 'error'); return; }

    const evDef = { id, name, icon, mutation, mutationChance: chance, duration, description: desc || name };

    DATA.EVENTS.push(evDef);
    await DB.set(DB.ref(`gag/admin_content/events/${id}`), evDef);
    UI.showNotif(`⚡ Event "${name}" created!`, 'success');

    // Clear form
    ['ev_id','ev_name','ev_icon','ev_mutation','ev_chance','ev_duration','ev_desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Refresh the custom events list and rebuild the preset grid
    const section = document.querySelector('.admin-section');
    _buildEventGrid(section);
    _loadCustomEvents(section);
  }

  async function _loadCustomEvents(section) {
    const el = section?.querySelector('#ev_existing_list') || document.getElementById('ev_existing_list');
    if (!el) return;
    el.innerHTML = '<div style="font-size:9px;color:#8d6e63">Loading...</div>';
    try {
      const snap = await DB.get(DB.ref('gag/admin_content/events'));
      el.innerHTML = '';
      if (!snap.exists()) { el.innerHTML = '<div style="font-size:9px;color:#8d6e63">No custom events yet</div>'; return; }
      snap.forEach(child => {
        const ev = child.val();
        const row = document.createElement('div');
        row.className = 'player-search-result';
        row.innerHTML = `
          <div>
            <div style="font-size:10px;color:#ffd700">${ev.icon} ${ev.name}</div>
            <div style="font-size:8px;color:#8d6e63;margin-top:2px">${ev.mutation} mutation · ${ev.mutationChance*100}% · ${ev.duration}s</div>
          </div>
          <button class="admin-btn red" onclick="AdminPanel._deleteEvent('${child.key}','${ev.id}')">DEL</button>
        `;
        el.appendChild(row);
      });
    } catch(e) {
      el.innerHTML = '<div style="font-size:9px;color:#ef5350">Error loading</div>';
    }
  }

  async function _deleteEvent(firebaseKey, eventId) {
    await DB.remove(DB.ref(`gag/admin_content/events/${firebaseKey}`));
    const i = DATA.EVENTS.findIndex(e => e.id === eventId);
    if (i > -1) DATA.EVENTS.splice(i, 1);
    UI.showNotif('Event deleted', '');
    const section = document.querySelector('.admin-section');
    _buildEventGrid(section);
    _loadCustomEvents(section);
  }

  // ── GIVE TAB ──────────────────────────────────────────────
  function renderGive(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div class="admin-label">TARGET PLAYER (username or "ALL")</div>
      <div class="admin-row">
        <input class="admin-input" style="flex:1;margin-bottom:0" type="text" id="giveTarget" placeholder="username or ALL">
        <button class="admin-btn gold" onclick="AdminPanel.lookupPlayer()">FIND</button>
      </div>
      <div id="givePlayerInfo" style="margin-bottom:14px;font-size:9px;color:#8d6e63;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <!-- Give Coins -->
        <div>
          <div class="admin-label">GIVE COINS 🪙</div>
          <input class="admin-input" type="number" id="giveCoins" placeholder="Amount">
          <button class="admin-btn gold" onclick="AdminPanel.giveCoins()">GIVE COINS</button>
        </div>
        <!-- Give Gems -->
        <div>
          <div class="admin-label">GIVE GEMS 💎</div>
          <input class="admin-input" type="number" id="giveGems" placeholder="Amount">
          <button class="admin-btn green" onclick="AdminPanel.giveGems()">GIVE GEMS</button>
        </div>
      </div>

      <div style="margin-top:16px">
        <div class="admin-label">GIVE SEED</div>
        <div class="admin-row">
          <select class="admin-input" id="giveSeedId" style="margin-bottom:0">
            ${DATA.SEEDS.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('')}
          </select>
          <input class="admin-input" type="number" id="giveSeedCount" placeholder="Count" value="1" style="max-width:80px;margin-bottom:0">
          <button class="admin-btn green" onclick="AdminPanel.giveSeed()">GIVE</button>
        </div>
      </div>

      <div style="margin-top:14px">
        <div class="admin-label">GIVE PET EGG</div>
        <div class="admin-row">
          <select class="admin-input" id="giveEggId" style="margin-bottom:0">
            ${DATA.PET_EGGS.map(e => `<option value="${e.id}">${e.icon} ${e.name}</option>`).join('')}
          </select>
          <button class="admin-btn green" onclick="AdminPanel.giveEgg()">GIVE</button>
        </div>
      </div>
    `;
    body.appendChild(section);
  }

  async function lookupPlayer() {
    const target = document.getElementById('giveTarget').value.trim();
    const info   = document.getElementById('givePlayerInfo');
    if (!target) return;
    if (target.toUpperCase() === 'ALL') {
      info.textContent = '⚠ Will affect ALL players';
      info.style.color = '#ff9800';
      return;
    }
    try {
      const snap = await DB.get(DB.ref(`gag/players/${target}`));
      if (!snap.exists()) { info.style.color='#ef5350'; info.textContent = '✕ Player not found'; return; }
      const d = snap.val();
      info.style.color = '#66bb6a';
      info.textContent = `✓ Found: ${target} | 🪙${d.coins||0} | 💎${d.gems||0}`;
    } catch(e) { info.style.color='#ef5350'; info.textContent='Error: '+e.message; }
  }

  async function giveToTarget(updateFn, notifMsg) {
    const target = document.getElementById('giveTarget').value.trim();
    if (!target) { UI.showNotif('Enter a target username or ALL', 'error'); return; }

    if (target.toUpperCase() === 'ALL') {
      const snap = await DB.get(DB.ref('gag/players'));
      if (!snap.exists()) return;
      const promises = [];
      snap.forEach(child => {
        promises.push(updateFn(child.key, child.val()));
      });
      await Promise.all(promises);
      await DB.push(DB.ref('gag/admin_notifs'), {
        msg: notifMsg, timestamp: Date.now()
      });
      UI.showNotif('✓ Given to ALL players', 'success');
    } else {
      const snap = await DB.get(DB.ref(`gag/players/${target}`));
      if (!snap.exists()) { UI.showNotif('Player not found!', 'error'); return; }
      await updateFn(target, snap.val());
      await DB.push(DB.ref(`gag/player_notifs/${target}`), {
        msg: `🎁 An admin gave you: ${notifMsg}`, timestamp: Date.now()
      });
      UI.showNotif(`✓ Given to ${target}`, 'success');
    }
  }

  async function giveCoins() {
    const amount = parseInt(document.getElementById('giveCoins').value);
    if (!amount || amount <= 0) return;
    await giveToTarget(async (username, data) => {
      await DB.update(DB.ref(`gag/players/${username}`), { coins: (data.coins || 0) + amount });
      if (username === Player.state.username) Player.addCoins(amount);
    }, `🪙 ${amount} coins`);
  }

  async function giveGems() {
    const amount = parseInt(document.getElementById('giveGems').value);
    if (!amount || amount <= 0) return;
    await giveToTarget(async (username, data) => {
      await DB.update(DB.ref(`gag/players/${username}`), { gems: (data.gems || 0) + amount });
      if (username === Player.state.username) Player.addGems(amount);
    }, `💎 ${amount} gems`);
  }

  async function giveSeed() {
    const seedId = document.getElementById('giveSeedId').value;
    const count  = parseInt(document.getElementById('giveSeedCount').value) || 1;
    const seed   = DATA.getSeedById(seedId);
    if (!seed) return;

    await giveToTarget(async (username) => {
      await DB.push(DB.ref(`gag/gifts/${username}`), {
        type:'seed', seedId, count, giftedAt: Date.now(),
        icon: seed.icon, name: seed.name
      });
      if (username === Player.state.username) {
        for (let i = 0; i < count; i++) {
          Player.addItem(Player.makeStack('seed', seed.id, seed.icon, seed.name, { rarity: seed.rarity }));
        }
      }
    }, `${seed.icon} ${seed.name} ×${count}`);
  }

  async function giveEgg() {
    const eggId = document.getElementById('giveEggId').value;
    const egg   = DATA.getEggById(eggId);
    if (!egg) return;

    await giveToTarget(async (username) => {
      await DB.push(DB.ref(`gag/gifts/${username}`), {
        type:'egg', eggId, giftedAt: Date.now(),
        icon: egg.icon, name: egg.name
      });
      if (username === Player.state.username) {
        Player.addItem(Player.makeStack('egg', egg.id, egg.icon, egg.name, { eggData: egg.id }));
      }
    }, `${egg.icon} ${egg.name}`);
  }

  // ── MESSAGE TAB ───────────────────────────────────────────
  function renderMessage(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div class="admin-label">GLOBAL BROADCAST MESSAGE</div>
      <textarea class="admin-input" id="broadcastMsg" rows="3"
        placeholder="Type a message to send to all players..." style="resize:vertical"></textarea>
      <button class="admin-btn red" onclick="AdminPanel.broadcast()">📢 BROADCAST TO ALL</button>
      <div style="margin-top:20px;font-size:8px;color:#8d6e63;">
        Message will appear at the top of every active player's screen immediately.
      </div>
    `;
    body.appendChild(section);
  }

  async function broadcast() {
    const msg = document.getElementById('broadcastMsg').value.trim();
    if (!msg) return;
    await DB.push(DB.ref('gag/admin_messages'), {
      text:      msg,
      from:      Player.state.username,
      timestamp: Date.now()
    });
    document.getElementById('broadcastMsg').value = '';
    UI.showNotif('📢 Message broadcasted!', 'success');
  }

  // ── SHOP MANAGER TAB ──────────────────────────────────────
  function renderShopMgr(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div class="admin-label">ADD EXCLUSIVE GEM SHOP ITEM</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="admin-label" style="font-size:7px">NAME</label>
          <input class="admin-input" type="text" id="newItemName" placeholder="Item name">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">ICON (emoji)</label>
          <input class="admin-input" type="text" id="newItemIcon" placeholder="🎁" maxlength="4">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">GEM PRICE</label>
          <input class="admin-input" type="number" id="newItemPrice" placeholder="25">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">ITEM TYPE</label>
          <select class="admin-input" id="newItemType">
            <option value="seed">Seed</option>
            <option value="tool">Gear</option>
            <option value="egg">Pet Egg</option>
          </select>
        </div>
        <div style="grid-column:1/-1">
          <label class="admin-label" style="font-size:7px">ITEM ID (from data.js)</label>
          <input class="admin-input" type="text" id="newItemId" placeholder="e.g. golden_apple or common_egg">
        </div>
        <div style="grid-column:1/-1">
          <label class="admin-label" style="font-size:7px">DESCRIPTION</label>
          <input class="admin-input" type="text" id="newItemDesc" placeholder="Description for players">
        </div>
      </div>
      <button class="admin-btn gold" onclick="AdminPanel.addShopItem()" style="margin-top:10px">+ ADD TO GEM SHOP</button>

      <div class="admin-label" style="margin-top:20px">CURRENT EXCLUSIVE ITEMS</div>
      <div id="currentShopItems"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>

      <div class="admin-label" style="margin-top:20px">DROP CODE (paste JS from Claude)</div>
      <textarea class="admin-input" id="dropCode" rows="6"
        placeholder="// Paste the code snippet Claude gives you here to add new content...&#10;// e.g. AdminPanel.injectSeed({...})" style="resize:vertical;font-family:monospace;font-size:11px;"></textarea>
      <button class="admin-btn red" onclick="AdminPanel.runDropCode()">▶ RUN DROP CODE</button>
      <div style="font-size:8px;color:#8d6e63;margin-top:6px;">Only run code you received from the game developer.</div>
    `;
    body.appendChild(section);

    DB.get(DB.ref('gag/admin_shop_items')).then(snap => {
      const el = section.querySelector('#currentShopItems');
      el.innerHTML = '';
      if (!snap.exists()) { el.innerHTML = `<div style="font-size:9px;color:#8d6e63">No exclusive items yet</div>`; return; }
      snap.forEach(child => {
        const it = child.val();
        const row = document.createElement('div');
        row.className = 'player-search-result';
        row.innerHTML = `
          <span>${it.icon} ${it.name} — 💎${it.gemPrice} — ${it.active?'<span style="color:#4caf50">ACTIVE</span>':'<span style="color:#8d6e63">HIDDEN</span>'}</span>
          <div style="display:flex;gap:6px;">
            <button class="admin-btn ${it.active?'red':'green'}" onclick="AdminPanel.toggleShopItem('${child.key}',${!it.active})">
              ${it.active ? 'HIDE' : 'SHOW'}
            </button>
            <button class="admin-btn red" onclick="AdminPanel.deleteShopItem('${child.key}')">DEL</button>
          </div>
        `;
        el.appendChild(row);
      });
    }).catch(() => {});
  }

  async function addShopItem() {
    const name    = document.getElementById('newItemName').value.trim();
    const icon    = document.getElementById('newItemIcon').value.trim() || '🎁';
    const price   = parseInt(document.getElementById('newItemPrice').value) || 10;
    const type    = document.getElementById('newItemType').value;
    const itemId  = document.getElementById('newItemId').value.trim();
    const desc    = document.getElementById('newItemDesc').value.trim();

    if (!name || !itemId) { UI.showNotif('Fill in name and item ID', 'error'); return; }

    await DB.push(DB.ref('gag/admin_shop_items'), {
      name, icon, gemPrice: price, itemType: type,
      itemId, description: desc, active: true,
      addedAt: Date.now(), addedBy: Player.state.username
    });
    UI.showNotif(`✓ ${name} added to Gem Shop!`, 'success');
    renderShopMgr(document.getElementById('adminBody'));
  }

  async function toggleShopItem(key, active) {
    await DB.update(DB.ref(`gag/admin_shop_items/${key}`), { active });
    UI.showNotif(active ? 'Item visible in shop' : 'Item hidden from shop', '');
    renderShopMgr(document.getElementById('adminBody'));
  }

  // ✅ FIXED — use DB.remove instead of DB.update with null
  async function deleteShopItem(key) {
    await DB.remove(DB.ref(`gag/admin_shop_items/${key}`));
    renderShopMgr(document.getElementById('adminBody'));
  }

  function runDropCode() {
    const code = document.getElementById('dropCode').value.trim();
    if (!code) return;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('AdminPanel','Player','DATA','DB','UI','Events',
        `"use strict";\n${code}`
      );
      fn(AdminPanel, Player, DATA, DB, UI, Events);
      UI.showNotif('✓ Drop code executed!', 'success');
      document.getElementById('dropCode').value = '';
    } catch(e) {
      UI.showNotif('✕ Code error: ' + e.message, 'error');
      console.error('Drop code error:', e);
    }
  }

  // ── SHOP CONTENT TAB ─────────────────────────────────────
  function renderShopContent(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';

    const RARITIES = ['common','uncommon','rare','epic','legendary','mythic'];
    const SIZES    = ['small','medium','large'];

    section.innerHTML = `
      <div style="display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:14px;">
        <button id="scTabSeed" class="admin-tab active" onclick="AdminPanel._scTab('seed')">🌱 Seed</button>
        <button id="scTabGear" class="admin-tab"        onclick="AdminPanel._scTab('gear')">⚙️ Gear</button>
        <button id="scTabEgg"  class="admin-tab"        onclick="AdminPanel._scTab('egg')">🥚 Egg</button>
        <button id="scTabList" class="admin-tab"        onclick="AdminPanel._scTab('list')">📋 Existing</button>
      </div>

      <!-- SEED FORM -->
      <div id="scFormSeed">
        <div class="admin-label">ADD SEED TO SEED SHOP</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label class="admin-label" style="font-size:7px">ID (no spaces)</label>
            <input class="admin-input" id="sc_seed_id" placeholder="e.g. grape"></div>
          <div><label class="admin-label" style="font-size:7px">NAME</label>
            <input class="admin-input" id="sc_seed_name" placeholder="Grape"></div>
          <div><label class="admin-label" style="font-size:7px">ICON (emoji)</label>
            <input class="admin-input" id="sc_seed_icon" placeholder="🍇" maxlength="4"></div>
          <div><label class="admin-label" style="font-size:7px">RARITY</label>
            <select class="admin-input" id="sc_seed_rarity">
              ${RARITIES.map(r=>`<option value="${r}">${r}</option>`).join('')}
            </select></div>
          <div><label class="admin-label" style="font-size:7px">GROW TIME (seconds)</label>
            <input class="admin-input" type="number" id="sc_seed_growTime" placeholder="120"></div>
          <div><label class="admin-label" style="font-size:7px">BASE SELL VALUE 🪙</label>
            <input class="admin-input" type="number" id="sc_seed_baseValue" placeholder="50"></div>
          <div><label class="admin-label" style="font-size:7px">BUY PRICE 🪙</label>
            <input class="admin-input" type="number" id="sc_seed_buyPrice" placeholder="100"></div>
          <div><label class="admin-label" style="font-size:7px">SIZE</label>
            <select class="admin-input" id="sc_seed_size">
              ${SIZES.map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select></div>
          <div style="grid-column:1/-1"><label class="admin-label" style="font-size:7px">DESCRIPTION</label>
            <input class="admin-input" id="sc_seed_desc" placeholder="A delicious fruit..."></div>
        </div>
        <button class="admin-btn green" style="margin-top:10px;width:100%" onclick="AdminPanel._addSeed()">+ ADD TO SEED SHOP</button>
      </div>

      <!-- GEAR FORM -->
      <div id="scFormGear" style="display:none">
        <div class="admin-label">ADD GEAR TO GEAR SHOP</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label class="admin-label" style="font-size:7px">ID (no spaces)</label>
            <input class="admin-input" id="sc_gear_id" placeholder="e.g. super_can"></div>
          <div><label class="admin-label" style="font-size:7px">NAME</label>
            <input class="admin-input" id="sc_gear_name" placeholder="Super Can"></div>
          <div><label class="admin-label" style="font-size:7px">ICON (emoji)</label>
            <input class="admin-input" id="sc_gear_icon" placeholder="🚿" maxlength="4"></div>
          <div><label class="admin-label" style="font-size:7px">TYPE</label>
            <select class="admin-input" id="sc_gear_type">
              <option value="tool">Tool (stackable)</option>
              <option value="sprinkler">Sprinkler (placeable)</option>
            </select></div>
          <div><label class="admin-label" style="font-size:7px">BUY PRICE 🪙</label>
            <input class="admin-input" type="number" id="sc_gear_price" placeholder="200"></div>
          <div><label class="admin-label" style="font-size:7px">EFFECT TYPE</label>
            <select class="admin-input" id="sc_gear_effectType">
              <option value="speed">Speed (watering)</option>
              <option value="size">Size (sprinkler)</option>
            </select></div>
          <div><label class="admin-label" style="font-size:7px">EFFECT MULTIPLIER</label>
            <input class="admin-input" type="number" step="0.1" id="sc_gear_effectMult" placeholder="2.0"></div>
          <div><label class="admin-label" style="font-size:7px">EFFECT DURATION (secs, tools only)</label>
            <input class="admin-input" type="number" id="sc_gear_effectDur" placeholder="60"></div>
          <div style="grid-column:1/-1"><label class="admin-label" style="font-size:7px">DESCRIPTION</label>
            <input class="admin-input" id="sc_gear_desc" placeholder="Speeds growth by..."></div>
        </div>
        <button class="admin-btn green" style="margin-top:10px;width:100%" onclick="AdminPanel._addGear()">+ ADD TO GEAR SHOP</button>
      </div>

      <!-- EGG FORM -->
      <div id="scFormEgg" style="display:none">
        <div class="admin-label">ADD EGG TO PET SHOP</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label class="admin-label" style="font-size:7px">ID (no spaces)</label>
            <input class="admin-input" id="sc_egg_id" placeholder="e.g. mystery_egg"></div>
          <div><label class="admin-label" style="font-size:7px">NAME</label>
            <input class="admin-input" id="sc_egg_name" placeholder="Mystery Egg"></div>
          <div><label class="admin-label" style="font-size:7px">ICON (emoji)</label>
            <input class="admin-input" id="sc_egg_icon" placeholder="🥚" maxlength="4"></div>
          <div><label class="admin-label" style="font-size:7px">BUY PRICE 🪙</label>
            <input class="admin-input" type="number" id="sc_egg_price" placeholder="500"></div>
          <div><label class="admin-label" style="font-size:7px">RARITY BORDER COLOR</label>
            <input class="admin-input" id="sc_egg_border" placeholder="#ab47bc"></div>
          <div style="grid-column:1/-1"><label class="admin-label" style="font-size:7px">DESCRIPTION</label>
            <input class="admin-input" id="sc_egg_desc" placeholder="What could be inside?"></div>
        </div>
        <div class="admin-label" style="margin-top:12px">PETS IN THIS EGG <span style="color:#8d6e63;font-size:7px">(add up to 6, chances must total 100)</span></div>
        <div id="sc_egg_pets"></div>
        <button class="admin-btn gold" style="margin-top:6px" onclick="AdminPanel._addPetRow()">+ ADD PET</button>
        <button class="admin-btn green" style="margin-top:10px;width:100%" onclick="AdminPanel._addEgg()">+ ADD TO PET SHOP</button>
      </div>

      <!-- LIST -->
      <div id="scFormList" style="display:none">
        <div class="admin-label">ADMIN-ADDED SHOP ITEMS</div>
        <div id="sc_existing_list"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>
      </div>
    `;
    body.appendChild(section);
    _loadExistingShopContent(section);
  }

  function _scTab(tab) {
    ['seed','gear','egg','list'].forEach(t => {
      document.getElementById('scForm' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? '' : 'none';
      const btn = document.getElementById('scTab' + t.charAt(0).toUpperCase() + t.slice(1));
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'list') _loadExistingShopContent(document.querySelector('.admin-section'));
  }

  async function _addSeed() {
    const id        = document.getElementById('sc_seed_id').value.trim().replace(/\s+/g,'_');
    const name      = document.getElementById('sc_seed_name').value.trim();
    const icon      = document.getElementById('sc_seed_icon').value.trim() || '🌱';
    const rarity    = document.getElementById('sc_seed_rarity').value;
    const growTime  = parseInt(document.getElementById('sc_seed_growTime').value) || 120;
    const baseValue = parseInt(document.getElementById('sc_seed_baseValue').value) || 50;
    const buyPrice  = parseInt(document.getElementById('sc_seed_buyPrice').value) || 100;
    const size      = document.getElementById('sc_seed_size').value;
    const desc      = document.getElementById('sc_seed_desc').value.trim();

    if (!id || !name) { UI.showNotif('Fill in ID and Name', 'error'); return; }
    if (DATA.getSeedById(id)) { UI.showNotif('Seed ID already exists!', 'error'); return; }

    const sizeRanges = { small:[0.6,1.2], medium:[0.8,1.6], large:[1.0,2.2] };
    const seedDef = {
      id, name, icon, rarity, growTime, baseValue, buyPrice,
      color: 0xaaaaaa, size,
      sizeRange: sizeRanges[size] || [0.8,1.4],
      description: desc || name
    };

    DATA.SEEDS.push(seedDef);
    await DB.set(DB.ref(`gag/admin_content/seeds/${id}`), seedDef);
    UI.showNotif(`🌱 ${name} added to Seed Shop!`, 'success');
    showTab('shopContent');
  }

  async function _addGear() {
    const id         = document.getElementById('sc_gear_id').value.trim().replace(/\s+/g,'_');
    const name       = document.getElementById('sc_gear_name').value.trim();
    const icon       = document.getElementById('sc_gear_icon').value.trim() || '⚙️';
    const type       = document.getElementById('sc_gear_type').value;
    const price      = parseInt(document.getElementById('sc_gear_price').value) || 200;
    const effectType = document.getElementById('sc_gear_effectType').value;
    const effectMult = parseFloat(document.getElementById('sc_gear_effectMult').value) || 2.0;
    const effectDur  = parseInt(document.getElementById('sc_gear_effectDur').value) || 60;
    const desc       = document.getElementById('sc_gear_desc').value.trim();

    if (!id || !name) { UI.showNotif('Fill in ID and Name', 'error'); return; }
    if (DATA.getGearById(id)) { UI.showNotif('Gear ID already exists!', 'error'); return; }

    const gearDef = {
      id, name, icon, desc: desc || name,
      price, type, stackable: type === 'tool',
      effect: { type: effectType, mult: effectMult, duration: effectDur }
    };

    DATA.GEAR.push(gearDef);
    await DB.set(DB.ref(`gag/admin_content/gear/${id}`), gearDef);
    UI.showNotif(`⚙️ ${name} added to Gear Shop!`, 'success');
    showTab('shopContent');
  }

  function _addPetRow() {
    const container = document.getElementById('sc_egg_pets');
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:2fr 2fr 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:6px;';
    row.innerHTML = `
      <input class="admin-input" style="margin:0" placeholder="Pet name" data-pet="name">
      <input class="admin-input" style="margin:0" placeholder="Ability" data-pet="ability">
      <input class="admin-input" style="margin:0;max-width:60px" placeholder="Icon" maxlength="4" data-pet="icon">
      <input class="admin-input" type="number" style="margin:0;max-width:60px" placeholder="%" data-pet="chance">
      <select class="admin-input" style="margin:0" data-pet="rarity">
        ${['common','uncommon','rare','epic','legendary'].map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select>
      <button class="admin-btn red" style="padding:4px 8px;font-size:9px" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  }

  async function _addEgg() {
    const id     = document.getElementById('sc_egg_id').value.trim().replace(/\s+/g,'_');
    const name   = document.getElementById('sc_egg_name').value.trim();
    const icon   = document.getElementById('sc_egg_icon').value.trim() || '🥚';
    const price  = parseInt(document.getElementById('sc_egg_price').value) || 500;
    const border = document.getElementById('sc_egg_border').value.trim() || '#9e9e9e';
    const desc   = document.getElementById('sc_egg_desc').value.trim();

    if (!id || !name) { UI.showNotif('Fill in ID and Name', 'error'); return; }
    if (DATA.getEggById(id)) { UI.showNotif('Egg ID already exists!', 'error'); return; }

    const petRows = document.getElementById('sc_egg_pets').children;
    if (petRows.length === 0) { UI.showNotif('Add at least one pet!', 'error'); return; }

    const pets = [];
    let totalChance = 0;
    for (const row of petRows) {
      const petName  = row.querySelector('[data-pet="name"]').value.trim();
      const ability  = row.querySelector('[data-pet="ability"]').value.trim();
      const petIcon  = row.querySelector('[data-pet="icon"]').value.trim() || '🐾';
      const chance   = parseFloat(row.querySelector('[data-pet="chance"]').value) || 0;
      const rarity   = row.querySelector('[data-pet="rarity"]').value;
      if (!petName) continue;
      const petId = id + '_' + petName.toLowerCase().replace(/\s+/g,'_');
      pets.push({ id: petId, name: petName, icon: petIcon, rarity, chance, ability });
      totalChance += chance;
    }

    if (pets.length === 0) { UI.showNotif('Add at least one pet!', 'error'); return; }
    if (Math.abs(totalChance - 100) > 1) {
      UI.showNotif(`Chances total ${totalChance}% — must equal 100!`, 'error'); return;
    }

    const eggDef = { id, name, icon, price, rarityBorder: border, description: desc || name, pets };
    DATA.PET_EGGS.push(eggDef);
    await DB.set(DB.ref(`gag/admin_content/eggs/${id}`), eggDef);
    UI.showNotif(`🥚 ${name} added to Pet Shop!`, 'success');
    showTab('shopContent');
  }

  async function _loadExistingShopContent(section) {
    const el = section?.querySelector?.('#sc_existing_list') || document.getElementById('sc_existing_list');
    if (!el) return;
    el.innerHTML = '<div style="font-size:9px;color:#8d6e63">Loading...</div>';
    try {
      const snap = await DB.get(DB.ref('gag/admin_content'));
      el.innerHTML = '';
      if (!snap.exists()) { el.innerHTML = '<div style="font-size:9px;color:#8d6e63">No admin-added items yet</div>'; return; }
      const data = snap.val();

      const addRows = (items, label, pathKey) => {
        if (!items) return;
        const header = document.createElement('div');
        header.style.cssText = 'font-size:8px;color:#ffd700;margin:10px 0 4px;letter-spacing:1px;';
        header.textContent = label;
        el.appendChild(header);
        Object.entries(items).forEach(([key, it]) => {
          const row = document.createElement('div');
          row.className = 'player-search-result';
          row.innerHTML = `
            <span>${it.icon || '?'} ${it.name} ${it.buyPrice||it.price ? '— 🪙'+(it.buyPrice||it.price) : ''}</span>
            <button class="admin-btn red" onclick="AdminPanel._removeShopContent('${pathKey}','${key}','${it.id}','${pathKey}')">REMOVE</button>
          `;
          el.appendChild(row);
        });
      };

      addRows(data.seeds, '🌱 SEEDS', 'seeds');
      addRows(data.gear,  '⚙️ GEAR',  'gear');
      addRows(data.eggs,  '🥚 EGGS',  'eggs');
    } catch(e) {
      el.innerHTML = '<div style="font-size:9px;color:#ef5350">Error loading</div>';
    }
  }

  // ✅ FIXED — type is now 'seeds', 'gear', or 'eggs' (matching pathKey), not an emoji
  async function _removeShopContent(pathKey, firebaseKey, itemId, type) {
    await DB.remove(DB.ref(`gag/admin_content/${pathKey}/${firebaseKey}`));
    if (type === 'seeds') { const i = DATA.SEEDS.findIndex(s=>s.id===itemId);    if(i>-1) DATA.SEEDS.splice(i,1); }
    if (type === 'gear')  { const i = DATA.GEAR.findIndex(g=>g.id===itemId);     if(i>-1) DATA.GEAR.splice(i,1); }
    if (type === 'eggs')  { const i = DATA.PET_EGGS.findIndex(e=>e.id===itemId); if(i>-1) DATA.PET_EGGS.splice(i,1); }
    UI.showNotif('Item removed from shop', '');
    showTab('shopContent');
  }

  // Public inject helpers (called by drop code)
  async function injectSeed(seedDef) {
    if (!DATA.getSeedById(seedDef.id)) DATA.SEEDS.push(seedDef);
    await DB.set(DB.ref(`gag/admin_content/seeds/${seedDef.id}`), seedDef);
    UI.showNotif(`🌱 New seed added: ${seedDef.icon} ${seedDef.name}`, 'success');
  }

  async function injectGear(gearDef) {
    if (!DATA.getGearById(gearDef.id)) DATA.GEAR.push(gearDef);
    await DB.set(DB.ref(`gag/admin_content/gear/${gearDef.id}`), gearDef);
    UI.showNotif(`⚙️ New gear added: ${gearDef.icon} ${gearDef.name}`, 'success');
  }

  async function injectPetEgg(eggDef) {
    if (!DATA.getEggById(eggDef.id)) DATA.PET_EGGS.push(eggDef);
    await DB.set(DB.ref(`gag/admin_content/eggs/${eggDef.id}`), eggDef);
    UI.showNotif(`🥚 New egg added: ${eggDef.icon} ${eggDef.name}`, 'success');
  }

  // ── CODES TAB ─────────────────────────────────────────────
  function renderCodes(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div class="admin-label">CREATE REDEEM CODE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="admin-label" style="font-size:7px">CODE (UPPERCASE)</label>
          <input class="admin-input" type="text" id="newCodeStr" placeholder="SPRINGUPDATE"
            style="text-transform:uppercase;letter-spacing:2px" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">COINS REWARD 🪙</label>
          <input class="admin-input" type="number" id="newCodeCoins" placeholder="0">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">GEMS REWARD 💎</label>
          <input class="admin-input" type="number" id="newCodeGems" placeholder="0">
        </div>
        <div>
          <label class="admin-label" style="font-size:7px">SEED IDS (comma separated)</label>
          <input class="admin-input" type="text" id="newCodeSeeds" placeholder="carrot,mango">
        </div>
      </div>
      <button class="admin-btn gold" onclick="AdminPanel.createCode()" style="margin-top:10px">+ CREATE CODE</button>

      <div class="admin-label" style="margin-top:20px">EXISTING CODES</div>
      <div id="codesList"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>
    `;
    body.appendChild(section);

    DB.get(DB.ref('gag/codes')).then(snap => {
      const el = section.querySelector('#codesList');
      el.innerHTML = '';
      if (!snap.exists()) { el.innerHTML = `<div style="font-size:9px;color:#8d6e63">No codes yet</div>`; return; }
      snap.forEach(child => {
        const cd = child.val();
        const row = document.createElement('div');
        row.className = 'player-search-result';
        row.innerHTML = `
          <div>
            <div style="font-family:var(--font-px);font-size:9px;color:#ffd700;letter-spacing:2px">${child.key}</div>
            <div style="font-size:8px;color:#8d6e63;margin-top:3px">
              ${cd.coins?'🪙'+cd.coins+' ':''}${cd.gems?'💎'+cd.gems+' ':''}${cd.seeds?'🌱'+cd.seeds.join(','):''}
            </div>
          </div>
          <button class="admin-btn red" onclick="AdminPanel.deleteCode('${child.key}')">DELETE</button>
        `;
        el.appendChild(row);
      });
    }).catch(() => {});
  }

  async function createCode() {
    const code  = document.getElementById('newCodeStr').value.trim().toUpperCase();
    const coins = parseInt(document.getElementById('newCodeCoins').value) || 0;
    const gems  = parseInt(document.getElementById('newCodeGems').value) || 0;
    const seeds = document.getElementById('newCodeSeeds').value.trim()
                    .split(',').map(s => s.trim()).filter(Boolean);

    if (!code) { UI.showNotif('Enter a code string', 'error'); return; }

    await DB.set(DB.ref(`gag/codes/${code}`), {
      coins, gems,
      seeds: seeds.length > 0 ? seeds : null,
      createdAt: Date.now(), createdBy: Player.state.username
    });
    UI.showNotif(`✓ Code created: ${code}`, 'success');
    renderCodes(document.getElementById('adminBody'));
  }

  // ✅ FIXED — use DB.remove instead of DB.update with null
  async function deleteCode(code) {
    await DB.remove(DB.ref(`gag/codes/${code}`));
    renderCodes(document.getElementById('adminBody'));
  }

  // ── PLAYERS TAB ───────────────────────────────────────────
  function renderPlayers(body) {
    const section = document.createElement('div');
    section.className = 'admin-section';
    section.innerHTML = `
      <div class="admin-label">ALL PLAYERS</div>
      <div id="playersList"><div style="font-size:9px;color:#8d6e63">Loading...</div></div>
    `;
    body.appendChild(section);

    const now = Date.now();
    DB.get(DB.ref('gag/players')).then(snap => {
      const el = section.querySelector('#playersList');
      el.innerHTML = '';
      if (!snap.exists()) { el.innerHTML = `<div style="font-size:9px;color:#8d6e63">No players yet</div>`; return; }
      snap.forEach(child => {
        const d   = child.val();
        const key = child.key;
        const isOnline = d.lastSeen && (now - d.lastSeen < 5 * 60 * 1000);
        const row = document.createElement('div');
        row.className = 'player-search-result';
        row.style.flexWrap = 'wrap';
        row.innerHTML = `
          <div>
            <div style="font-size:10px;color:${isOnline?'#4caf50':'#f5e6c8'}">${isOnline?'🟢 ':'⚫ '}${key}</div>
            <div style="font-size:8px;color:#8d6e63;margin-top:3px">
              🪙${d.coins||0} | 💎${d.gems||0} | ${isOnline?'Online':'Last seen '+timeAgo(d.lastSeen)}
            </div>
          </div>
        `;
        el.appendChild(row);
      });
    }).catch(() => {});
  }

  function timeAgo(ts) {
    if (!ts) return 'never';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    return Math.floor(s/3600) + 'h ago';
  }

  window.AdminPanel = {
    open, close, tab: showTab,
    lookupPlayer, giveCoins, giveGems, giveSeed, giveEgg,
    broadcast,
    addShopItem, toggleShopItem, deleteShopItem, runDropCode,
    injectSeed, injectGear, injectPetEgg,
    createCode, deleteCode,
    _scTab, _addSeed, _addGear, _addEgg, _addPetRow,
    _loadExistingShopContent, _removeShopContent,
    _evTab, _createEvent, _loadCustomEvents, _deleteEvent,
    _buildEventGrid, _refreshActiveEvents,
  };

  return window.AdminPanel;
})();