// ui.js  –  Grow-a-Garden
// UI helpers: hotbar rendering, notifications, confirm dialog, backpack, zone.

window.UI = (() => {

  let _currentSlot = 0;

  // ── HOTBAR ────────────────────────────────────────────────
  // Tooltip element (shared, positioned on hover)
  let _tooltip = null;
  function getTooltip() {
    if (!_tooltip) {
      _tooltip = document.createElement('div');
      _tooltip.id = 'hbarTooltip';
      _tooltip.style.cssText = `
        position:fixed;bottom:86px;left:50%;transform:translateX(-50%);
        background:rgba(10,5,0,0.94);border:2px solid #5d4037;border-radius:3px;
        padding:8px 14px;font-family:'Silkscreen',monospace;font-size:8px;
        color:#f5e6c8;letter-spacing:1px;pointer-events:none;
        white-space:nowrap;z-index:200;display:none;line-height:1.8;
      `;
      document.body.appendChild(_tooltip);
    }
    return _tooltip;
  }

  const RARITY_COLORS = {
    common:'#9e9e9e', uncommon:'#66bb6a', rare:'#42a5f5',
    epic:'#ab47bc', legendary:'#ffa726', mythic:'#ff1744'
  };

  // Fruit colours matching data.js seed colours (hex -> css)
  const SEED_CSS_COLORS = {
    carrot:      '#ff7043', tomato:     '#f44336', strawberry: '#e91e63',
    watermelon:  '#4caf50', pumpkin:    '#ff9800', sunflower:  '#ffc107',
    blueberry:   '#3f51b5', mango:      '#ff8f00', dragonfruit:'#e91e63',
    golden_apple:'#ffd700',
  };

  // Draw a fruit mini-icon on a canvas for a given seed + mutations
  function drawFruitCanvas(seedId, mutations, size) {
    const cv  = document.createElement('canvas');
    cv.width  = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const s   = size;

    // Base colour from seed or mutation
    let col = SEED_CSS_COLORS[seedId] || '#aaa';
    if (mutations && mutations.length > 0) {
      const mutCols = {
        rainbow:'#e040fb', golden:'#ffd700', giant:'#ff7043',
        midnight:'#7c4dff', fiery:'#ff3d00', frosty:'#80d8ff',
        cosmic:'#304ffe', chocolate:'#5d4037'
      };
      col = mutCols[mutations[0]] || col;
    }

    // Draw simple shaped fruit based on seed
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetY = 2;

    if (seedId === 'carrot') {
      // Triangle carrot
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(s*0.5, s*0.82);
      ctx.lineTo(s*0.28, s*0.22);
      ctx.lineTo(s*0.72, s*0.22);
      ctx.closePath();
      ctx.fill();
      // Leafy top
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.arc(s*0.5, s*0.2, s*0.12, 0, Math.PI*2);
      ctx.fill();
    } else if (seedId === 'sunflower') {
      // Petals
      ctx.fillStyle = '#ffc107';
      for (let p=0;p<8;p++) {
        const a = p/8*Math.PI*2;
        ctx.beginPath();
        ctx.ellipse(s*0.5+Math.cos(a)*s*0.28, s*0.5+Math.sin(a)*s*0.28, s*0.1, s*0.18, a, 0, Math.PI*2);
        ctx.fill();
      }
      // Centre
      ctx.fillStyle = '#5d4037';
      ctx.beginPath();
      ctx.arc(s*0.5, s*0.5, s*0.18, 0, Math.PI*2);
      ctx.fill();
    } else if (seedId === 'watermelon') {
      // Oval green
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.ellipse(s*0.5, s*0.52, s*0.38, s*0.3, 0, 0, Math.PI*2);
      ctx.fill();
      // Red flesh stripe
      ctx.fillStyle = '#f44336';
      ctx.beginPath();
      ctx.ellipse(s*0.5, s*0.52, s*0.28, s*0.2, 0, 0, Math.PI*2);
      ctx.fill();
      // Seeds
      ctx.fillStyle = '#1a1a1a';
      [[-0.1,-0.02],[0.1,-0.02],[0,-0.08]].forEach(([ox,oy]) => {
        ctx.beginPath();
        ctx.ellipse(s*(0.5+ox), s*(0.52+oy), s*0.025, s*0.04, 0.3, 0, Math.PI*2);
        ctx.fill();
      });
    } else {
      // Generic round fruit (tomato, strawberry, mango, etc.)
      // Add slight gradient effect using multiple circles
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s*0.5, s*0.54, s*0.36, 0, Math.PI*2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(s*0.38, s*0.38, s*0.14, 0, Math.PI*2);
      ctx.fill();
      // Stem
      ctx.fillStyle = '#4e342e';
      ctx.beginPath();
      ctx.rect(s*0.47, s*0.12, s*0.06, s*0.14);
      ctx.fill();
      // Leaf nub
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.ellipse(s*0.5, s*0.2, s*0.08, s*0.05, 0.4, 0, Math.PI*2);
      ctx.fill();
    }

    return cv;
  }

  // Tool icons on canvas
  function drawToolCanvas(itemId, size) {
    const cv  = document.createElement('canvas');
    cv.width  = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const s   = size;

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = 3;

    if (itemId === 'shovel') {
      ctx.strokeStyle='#9e9e9e'; ctx.lineWidth=s*0.1;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s*0.5,s*0.15); ctx.lineTo(s*0.5,s*0.78); ctx.stroke();
      ctx.fillStyle='#9e9e9e';
      ctx.beginPath();
      ctx.rect(s*0.32,s*0.14,s*0.36,s*0.25);
      ctx.fill();
      ctx.fillStyle='#8d6e63';
      ctx.beginPath(); ctx.arc(s*0.5,s*0.86,s*0.1,0,Math.PI*2); ctx.fill();

    } else if (itemId === 'watering_can' || itemId === 'golden_can') {
      const col = itemId==='golden_can' ? '#ffd700' : '#1e88e5';
      ctx.fillStyle = col;
      // Body
      ctx.beginPath(); ctx.roundRect(s*0.18,s*0.35,s*0.5,s*0.36,s*0.06); ctx.fill();
      // Spout
      ctx.strokeStyle=col; ctx.lineWidth=s*0.09; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s*0.65,s*0.42); ctx.lineTo(s*0.88,s*0.28); ctx.stroke();
      // Handle
      ctx.strokeStyle=col; ctx.lineWidth=s*0.08;
      ctx.beginPath(); ctx.arc(s*0.35,s*0.35,s*0.18,-Math.PI*0.8,0); ctx.stroke();

    } else if (itemId === 'sprinkler_a' || itemId === 'sprinkler_b') {
      const col = itemId==='sprinkler_b' ? '#00bcd4' : '#42a5f5';
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(s*0.5,s*0.62,s*0.22,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=s*0.07; ctx.lineCap='round';
      [[-0.22,-0.26],[0,-0.3],[0.22,-0.26]].forEach(([ox,oy]) => {
        ctx.beginPath(); ctx.moveTo(s*0.5,s*0.4); ctx.lineTo(s*(0.5+ox),s*(0.4+oy)); ctx.stroke();
      });
    } else {
      // Generic — show icon letter
      ctx.fillStyle='#8d6e63';
      ctx.font=`bold ${s*0.5}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('?', s*0.5, s*0.5);
    }
    return cv;
  }

  function drawSeedCanvas(seedId, size) {
    const cv  = document.createElement('canvas');
    cv.width  = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const s   = size;
    const col = SEED_CSS_COLORS[seedId] || '#a5d6a7';
    // Seed pouch
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath(); ctx.roundRect(s*0.22,s*0.22,s*0.56,s*0.6,s*0.08); ctx.fill();
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = s*0.05;
    ctx.stroke();
    // Colour dot representing seed
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(s*0.5,s*0.52,s*0.15,0,Math.PI*2); ctx.fill();
    // Tie at top
    ctx.strokeStyle='#8d6e63'; ctx.lineWidth=s*0.06;
    ctx.beginPath(); ctx.moveTo(s*0.35,s*0.22); ctx.lineTo(s*0.65,s*0.22); ctx.stroke();
    return cv;
  }

  function drawEggCanvas(size) {
    const cv  = document.createElement('canvas');
    cv.width  = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const s   = size;
    ctx.fillStyle='#fff9e6';
    ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=4; ctx.shadowOffsetY=2;
    ctx.beginPath();
    ctx.ellipse(s*0.5, s*0.54, s*0.3, s*0.38, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(s*0.4,s*0.4,s*0.1,s*0.14,0.5,0,Math.PI*2); ctx.fill();
    return cv;
  }

  function renderHotbar() {
    const bar = document.getElementById('hotbar');
    if (!bar) return;
    bar.innerHTML = '';
    const tooltip = getTooltip();

    for (let i = 0; i < 9; i++) {
      const item = Player.state.hotbar[i];
      const slot = document.createElement('div');
      slot.className = 'hslot' + (i === _currentSlot ? ' active' : '');
      slot.dataset.slot = i;
      slot.onclick = () => selectHotbarSlot(i);

      // Slot number key
      const keyEl = document.createElement('div');
      keyEl.className = 'hslot-key';
      keyEl.textContent = i + 1;
      slot.appendChild(keyEl);

      if (item) {
        // Draw canvas icon
        const ICO = 38;
        let cv;
        if (item.type === 'fruit')  cv = drawFruitCanvas(item.seedId || item.id, item.mutations || [], ICO);
        else if (item.type === 'seed') cv = drawSeedCanvas(item.id, ICO);
        else if (item.type === 'tool') cv = drawToolCanvas(item.id, ICO);
        else if (item.type === 'egg')  cv = drawEggCanvas(ICO);
        else if (item.type === 'pet')  cv = drawEggCanvas(ICO); // fallback
        else { cv = document.createElement('canvas'); cv.width=cv.height=ICO; }

        cv.style.cssText = 'display:block;image-rendering:pixelated;';
        slot.appendChild(cv);

        // Count badge
        if (item.count && item.count > 1) {
          const cnt = document.createElement('div');
          cnt.className = 'hslot-count';
          cnt.textContent = item.count;
          slot.appendChild(cnt);
        }

        // Rarity dot
        if (item.rarity) {
          const dot = document.createElement('div');
          dot.className = 'hslot-rarity-dot';
          dot.style.background = RARITY_COLORS[item.rarity] || '#fff';
          slot.appendChild(dot);
        }

        // Hover tooltip
        slot.addEventListener('mouseenter', () => {
          let lines = [];
          lines.push(item.name || item.id);

          if (item.type === 'fruit') {
            // Weight in kg: size * seed-base-weight
            const sd = DATA?.getSeedById?.(item.seedId);
            const baseKg = { small:0.08, medium:0.22, large:0.55 }[sd?.size||'small'] || 0.1;
            const kg = ((item.size || 1.0) * baseKg).toFixed(3);
            lines.push(`Weight: ${kg} kg`);
            lines.push(`Value: 🪙${item.value}`);
            if (item.rarity) lines.push(`Rarity: ${item.rarity}`);
            if (item.mutations && item.mutations.length > 0) {
              lines.push(`Mutations: ${item.mutations.map(m => {
                const md = DATA?.getMutationById?.(m);
                return md ? `${md.icon}${md.name}(×${md.valueMult})` : m;
              }).join(', ')}`);
            }
          } else if (item.type === 'seed') {
            const sd = DATA?.getSeedById?.(item.id);
            if (sd) {
              lines.push(`Rarity: ${sd.rarity}`);
              const t = sd.growTime;
              lines.push(`Grow time: ${t<60?t+'s':t<3600?Math.floor(t/60)+'m':Math.floor(t/3600)+'h'}`);
              lines.push(`Base value: 🪙${sd.baseValue}`);
            }
          } else if (item.type === 'tool') {
            const gd = DATA?.getGearById?.(item.id);
            if (gd) lines.push(gd.desc);
          } else if (item.type === 'egg') {
            lines.push('Click to use in Pet Shop');
          }

          tooltip.innerHTML = lines.map((l,i) =>
            i===0
              ? `<div style="color:#ffd700;font-family:var(--font-px);font-size:8px;margin-bottom:3px">${l}</div>`
              : `<div>${l}</div>`
          ).join('');
          tooltip.style.display = 'block';
        });

        slot.addEventListener('mouseleave', () => { tooltip.style.display='none'; });
      }

      bar.appendChild(slot);
    }
  }

  function selectHotbarSlot(i) {
    _currentSlot = i;
    renderHotbar();
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────
  function showNotif(msg, type = '') {
    const c = document.getElementById('notifContainer');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'notif-toast ' + type;
    d.textContent = msg;
    c.appendChild(d);
    setTimeout(() => {
      d.style.animation = 'toastOut 0.25s ease forwards';
      setTimeout(() => d.remove(), 280);
    }, 3800);
  }

  // ── ADMIN BANNER ──────────────────────────────────────────
  function showAdminBanner(msg) {
    const el = document.getElementById('adminBanner');
    if (!el) return;
    el.textContent = '📢 ' + msg;
    el.classList.remove('screen-hidden');
    setTimeout(() => el.classList.add('screen-hidden'), 8000);
  }

  // ── BACKPACK ──────────────────────────────────────────────
  const Backpack = {
    toggle() {
      const ov = document.getElementById('backpackOverlay');
      const isOpen = ov.style.display === 'flex';
      if (isOpen) {
        ov.style.display = 'none';
        window._backpackOpen = false;
      } else {
        this.render();
        ov.style.display = 'flex';
        window._backpackOpen = true;
      }
    },
    render() {
      const body = document.getElementById('backpackBody');
      body.innerHTML = '';

      const items = Player.state.backpack;
      if (!items || items.length === 0) {
        body.innerHTML = `<div class="bp-empty">Backpack is empty!<br><span style="font-size:7px">Hotbar fills first.<br>Overflow lands here.</span></div>`;
        return;
      }

      const header = document.createElement('div');
      header.style.cssText = 'padding:8px 12px;font-size:8px;color:#8d6e63;border-bottom:1px solid rgba(255,255,255,0.05);';
      header.textContent = `${items.length} items in backpack`;
      body.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'bp-grid';

      items.forEach((item, idx) => {
        const slot = document.createElement('div');
        slot.className = 'bp-slot';
        slot.title = item.name + (item.value ? ` (🪙${item.value} each)` : '');
        slot.innerHTML = `
          <span style="font-size:24px">${item.icon || '?'}</span>
          ${item.count > 1 ? `<div class="bp-count">${item.count}</div>` : ''}
        `;
        slot.onclick = () => moveToHotbar(idx);
        grid.appendChild(slot);
      });

      body.appendChild(grid);

      const hint = document.createElement('div');
      hint.style.cssText = 'padding:8px 12px;font-size:7px;color:#5d4037;text-align:center;';
      hint.textContent = 'Click an item to move it to hotbar';
      body.appendChild(hint);
    }
  };

  function moveToHotbar(bpIdx) {
    const item = Player.state.backpack[bpIdx];
    if (!item) return;

    // Find empty hotbar slot
    let moved = false;
    for (let i = 0; i < 9; i++) {
      if (!Player.state.hotbar[i]) {
        Player.state.hotbar[i] = { ...item };
        Player.state.backpack.splice(bpIdx, 1);
        renderHotbar();
        Backpack.render();
        Player.save();
        moved = true;
        break;
      }
    }
    if (!moved) showNotif('Hotbar is full!', 'error');
  }

  // ── CONFIRM DIALOG ────────────────────────────────────────
  const ConfirmDialog = {
    _resolve: null,
    show(title, text, onOk, onCancel) {
      document.getElementById('confirmIcon').textContent = title.length < 5 ? title : '⚠️';
      document.getElementById('confirmText').innerHTML =
        `<strong style="color:#ffd700">${title}</strong><br><br>${text.replace(/\n/g,'<br>')}`;
      document.getElementById('confirmOverlay').style.display = 'flex';
      window._confirmOpen = true;

      document.getElementById('confirmOkBtn').onclick = () => {
        document.getElementById('confirmOverlay').style.display = 'none';
        window._confirmOpen = false;
        if (onOk) onOk();
      };
      document.getElementById('confirmCancelBtn').onclick = () => {
        document.getElementById('confirmOverlay').style.display = 'none';
        window._confirmOpen = false;
        if (onCancel) onCancel();
      };
    }
  };

  // ── ANY MODAL OPEN? ───────────────────────────────────────
  function anyModalOpen() {
    return !!(
      window._shopOpen      ||
      window._gemShopOpen   ||
      window._backpackOpen  ||
      window._petMgrOpen    ||
      window._tradeListOpen ||
      window._tradeWindowOpen ||
      window._adminOpen     ||
      window._confirmOpen   ||
      document.getElementById('hatchOverlay')?.style.display === 'flex' ||
      document.getElementById('packOverlay')?.style.display === 'flex'
    );
  }

  // Register globally so world.js can check
  window._anyModalOpen = anyModalOpen;

  // ── LISTEN FOR ADMIN NOTIFICATIONS ────────────────────────
  function listenAdminMessages() {
    let _lastKey = null;
    async function poll() {
      try {
        const snap = await DB.get(DB.ref('gag/admin_messages'));
        if (!snap.exists()) return;
        let latest = null;
        snap.forEach(child => { latest = { key: child.key, ...child.val() }; });
        if (!latest || latest.key === _lastKey) return;
        _lastKey = latest.key;
        if (Date.now() - latest.timestamp < 30000) showAdminBanner(latest.text);
      } catch(e) {}
    }
    setTimeout(poll, 5000);
    setInterval(poll, 20000);
  }

  // ── LISTEN FOR PERSONAL NOTIFICATIONS / GIFTS ─────────────
  function listenPersonalNotifs(username) {
    async function pollNotifs() {
      try {
        const snap = await DB.get(DB.ref('gag/player_notifs/' + username));
        if (!snap.exists()) return;
        snap.forEach(child => {
          const n = child.val();
          if (!n._seen) {
            showNotif(n.msg, 'admin');
            DB.update(DB.ref('gag/player_notifs/' + username + '/' + child.key), { _seen: true });
          }
        });
      } catch(e) {}
    }
    setTimeout(pollNotifs, 4000);
    setInterval(pollNotifs, 10000);

    async function pollGifts() {
      try {
        const snap = await DB.get(DB.ref('gag/gifts/' + username));
        if (!snap.exists()) return;
        snap.forEach(child => {
          const gift = child.val();
          if (gift._claimed) return;
          if (gift.type === 'seed') {
            const sd = DATA.getSeedById(gift.seedId);
            if (sd) {
              for (let i = 0; i < (gift.count || 1); i++) {
                Player.addItem(Player.makeStack('seed', sd.id, sd.icon, sd.name, { rarity: sd.rarity }));
              }
            }
          } else if (gift.type === 'egg') {
            const eg = DATA.getEggById(gift.eggId);
            if (eg) {
              Player.addItem(Player.makeStack('egg', eg.id, eg.icon, eg.name, { eggData: eg.id }));
            }
          }
          DB.update(DB.ref('gag/gifts/' + username + '/' + child.key), { _claimed: true });
          showNotif('🎁 Gift received: ' + (gift.name || gift.seedId || gift.eggId) + '!', 'gem');
          Player.save();
        });
      } catch(e) {}
    }
    setTimeout(pollGifts, 6000);
    setInterval(pollGifts, 10000);
  }

    // ── UPDATE CURRENCY DISPLAYS ──────────────────────────────
  function updateCurrencyUI() {
    const ce = document.getElementById('coinsVal');
    const ge = document.getElementById('gemsVal');
    if (ce) ce.textContent = Player.state.coins;
    if (ge) ge.textContent = Player.state.gems;
  }

  return {
    renderHotbar,
    selectHotbarSlot,
    showNotif,
    showAdminBanner,
    listenAdminMessages,
    listenPersonalNotifs,
    updateCurrencyUI,
    get currentSlot() { return _currentSlot; },
    Backpack,
  };
})();

// Expose globally for inline onclick use
window.Backpack      = UI.Backpack;
window.ConfirmDialog = {
  show(title, text, onOk, onCancel) {
    document.getElementById('confirmIcon').textContent = '⚠️';
    document.getElementById('confirmText').innerHTML =
      `<strong style="color:#ffd700">${title}</strong><br><br>${text.replace(/\n/g,'<br>')}`;
    document.getElementById('confirmOverlay').style.display = 'flex';
    window._confirmOpen = true;

    document.getElementById('confirmOkBtn').onclick = () => {
      document.getElementById('confirmOverlay').style.display = 'none';
      window._confirmOpen = false;
      if (onOk) onOk();
    };
    document.getElementById('confirmCancelBtn').onclick = () => {
      document.getElementById('confirmOverlay').style.display = 'none';
      window._confirmOpen = false;
      if (onCancel) onCancel();
    };
  }
};