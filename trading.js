// trading.js  –  Grow-a-Garden
// Trading: online player list, send request, bilateral trade window.

window.Trading = (() => {

  let currentTrade     = null;
  let incomingListener = null;
  let tradeListener    = null;
  let myTradeKey       = null;

  // ── ONLINE PLAYERS LIST ───────────────────────────────────
  function openList() {
    window._tradeListOpen = true;
    const body = document.getElementById('tradeListBody');
    body.innerHTML = `<div style="padding:12px 16px;font-size:8px;color:#8d6e63">Loading online players...</div>`;
    document.getElementById('tradeListOverlay').style.display = 'flex';

    DB.get(DB.ref('gag/players')).then(snap => {
      body.innerHTML = '';
      if (!snap.exists()) {
        body.innerHTML = `<div style="padding:24px;text-align:center;font-size:9px;color:#8d6e63">No other players found</div>`;
        return;
      }

      const now = Date.now();
      const onlineThresh = 5 * 60 * 1000;
      let found = false;

      snap.forEach(child => {
        const d = child.val();
        const username = child.key;
        if (username === Player.state.username) return;

        const isOnline = d.lastSeen && (now - d.lastSeen < onlineThresh);
        const row = document.createElement('div');
        row.className = 'online-player-row';
        row.style.opacity = isOnline ? '1' : '0.45';
        row.innerHTML = `
          <div class="online-dot" style="background:${isOnline?'#4caf50':'#616161'}"></div>
          <div class="online-player-name">${username}</div>
          <div style="font-size:8px;color:#8d6e63">${isOnline ? 'Online now' : 'Offline'}</div>
          <button class="btn-green" style="padding:4px 10px;font-size:8px;"
            onclick="Trading.sendRequest('${username}')">TRADE</button>
        `;
        body.appendChild(row);
        found = true;
      });

      if (!found) {
        body.innerHTML = `<div style="padding:24px;text-align:center;font-size:9px;color:#8d6e63">No other players found</div>`;
      }
    }).catch(e => {
      body.innerHTML = `<div style="padding:24px;font-size:9px;color:#ef5350">Error: ${e.message}</div>`;
    });
  }

  function close() {
    document.getElementById('tradeListOverlay').style.display = 'none';
    window._tradeListOpen = false;
  }

  // ── SEND TRADE REQUEST ────────────────────────────────────
  async function sendRequest(targetUsername) {
    close();
    const key = 'trade_' + Date.now();
    myTradeKey = key;

    const tradeData = {
      key,
      from:       Player.state.username,
      to:         targetUsername,
      status:     'pending',
      createdAt:  Date.now(),
      fromOffer:  [],
      toOffer:    [],
      fromAccept: false,
      toAccept:   false,
    };

    await DB.set(DB.ref(`gag/trades/${key}`), tradeData);
    currentTrade = tradeData;

    UI.showNotif(`🤝 Trade request sent to ${targetUsername}...`, '');
    listenToTrade(key);
  }

  // ── LISTEN TO INCOMING REQUESTS ───────────────────────────
  function initIncomingListener() {
    if (incomingListener) return;
    incomingListener = true; // mark as started
    const username = Player.state.username;

    // Poll every 8s instead of persistent onValue (avoids long-poll blocking)
    async function pollTrades() {
      try {
        const tradesQuery = DB.query(
          DB.ref('gag/trades'),
          DB.orderByChild('to'),
          DB.equalTo(username)
        );
        const snap = await DB.get(tradesQuery);
        if (!snap.exists()) return;
        snap.forEach(child => {
          const td = child.val();
          if (td.status !== 'pending') return;
          if (Date.now() - td.createdAt > 60000) return;
          const popup  = document.getElementById('tradeIncoming');
          const textEl = document.getElementById('tradeIncomingText');
          textEl.textContent = `${td.from} wants to trade with you!`;
          popup.style.display = 'block';
          myTradeKey   = child.key;
          currentTrade = td;
        });
      } catch(e) {}
    }
    setTimeout(pollTrades, 7000);
    setInterval(pollTrades, 8000);
  }

  function acceptIncoming() {
    document.getElementById('tradeIncoming').style.display = 'none';
    if (!myTradeKey) return;
    DB.update(DB.ref(`gag/trades/${myTradeKey}`), { status: 'active' });
    listenToTrade(myTradeKey);
    openWindow();
  }

  function declineIncoming() {
    document.getElementById('tradeIncoming').style.display = 'none';
    if (!myTradeKey) return;
    DB.update(DB.ref(`gag/trades/${myTradeKey}`), { status: 'declined' });
    myTradeKey   = null;
    currentTrade = null;
  }

  // ── LISTEN TO TRADE CHANGES ───────────────────────────────
  function listenToTrade(key) {
    if (tradeListener) { clearInterval(tradeListener); tradeListener = null; }

    let _tradeInterval = null;
    async function pollActiveTrade() {
      try {
        const snap = await DB.get(DB.ref(`gag/trades/${key}`));
        if (!snap.exists()) return;
        const td = snap.val();
        currentTrade = td;

      if (td.status === 'declined') {
        UI.showNotif('Trade was declined', 'error');
        cancelTrade();
        return;
      }
      if (td.status === 'cancelled') {
        UI.showNotif('Trade was cancelled', '');
        cancelTrade();
        return;
      }
      if (td.status === 'active') {
        openWindow();
      }
      if (td.status === 'confirmed') {
        executeTrade(td);
        return;
      }
      renderTradeWindow(td);
      } catch(e) {}
    }
    _tradeInterval = setInterval(pollActiveTrade, 3000);
    pollActiveTrade();
    tradeListener = _tradeInterval;
  }

  // ── TRADE WINDOW ──────────────────────────────────────────
  function openWindow() {
    document.getElementById('tradeWindowOverlay').style.display = 'flex';
    window._tradeWindowOpen = true;
    if (currentTrade) renderTradeWindow(currentTrade);
  }

  function renderTradeWindow(td) {
    const body  = document.getElementById('tradeWindowBody');
    if (!body) return;
    const myUsername = Player.state.username;
    const isFrom = td.from === myUsername;
    const myOffer   = isFrom ? (td.fromOffer || []) : (td.toOffer || []);
    const theirOffer= isFrom ? (td.toOffer || []) : (td.fromOffer || []);
    const myAccept  = isFrom ? td.fromAccept : td.toAccept;
    const theirAccept = isFrom ? td.toAccept : td.fromAccept;
    const partner   = isFrom ? td.to : td.from;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px;">
        <div style="background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.08);border-radius:3px;padding:10px;">
          <div style="font-size:8px;color:#80deea;margin-bottom:8px;">YOUR OFFER</div>
          <div id="myOfferSlots"></div>
          <button class="btn-green" style="width:100%;margin-top:8px;font-size:8px;" onclick="Trading.addToOffer()">+ ADD ITEM</button>
        </div>
        <div style="background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.08);border-radius:3px;padding:10px;">
          <div style="font-size:8px;color:#80deea;margin-bottom:8px;">${partner.toUpperCase()}'S OFFER</div>
          <div id="theirOfferSlots"></div>
        </div>
      </div>
      <div style="padding:8px 16px;display:flex;gap:8px;align-items:center;justify-content:center;border-top:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:8px;color:${myAccept?'#4caf50':'#ff9800'};margin-right:8px;">
          You: ${myAccept ? '✓ READY' : '⏳ Not ready'}
        </div>
        <div style="font-size:8px;color:${theirAccept?'#4caf50':'#8d6e63'};margin-right:12px;">
          ${partner}: ${theirAccept ? '✓ READY' : '⏳ Not ready'}
        </div>
        <button class="btn-green" onclick="Trading.acceptTrade()">✓ ACCEPT</button>
      </div>
    `;

    // Render my offer slots
    const mySlots = document.getElementById('myOfferSlots');
    if (myOffer.length === 0) {
      mySlots.innerHTML = `<div style="font-size:8px;color:#5d4037;padding:8px;">Nothing offered yet</div>`;
    } else {
      myOffer.forEach((item, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:8px;color:#f5e6c8;';
        row.innerHTML = `<span style="font-size:16px">${item.icon}</span> ${item.name}
          <button style="margin-left:auto;background:transparent;border:none;color:#f44336;cursor:pointer;font-size:10px;"
            onclick="Trading.removeFromOffer(${i})">✕</button>`;
        mySlots.appendChild(row);
      });
    }

    // Render their offer slots
    const theirSlots = document.getElementById('theirOfferSlots');
    if (theirOffer.length === 0) {
      theirSlots.innerHTML = `<div style="font-size:8px;color:#5d4037;padding:8px;">Nothing offered yet</div>`;
    } else {
      theirOffer.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:8px;color:#f5e6c8;';
        row.innerHTML = `<span style="font-size:16px">${item.icon}</span> ${item.name}`;
        theirSlots.appendChild(row);
      });
    }

    // Both accepted?
    if (myAccept && theirAccept) {
      if (td.status !== 'confirmed') {
        DB.update(DB.ref(`gag/trades/${myTradeKey}`), { status: 'confirmed' });
      }
    }
  }

  // ── ADD ITEMS TO OFFER ────────────────────────────────────
  function addToOffer() {
    // Show a quick picker from hotbar + backpack (fruit, seeds, pets)
    const available = [
      ...Player.state.hotbar.map((s, i) => s ? { slot:'hotbar', idx:i, item:s } : null),
      ...Player.state.backpack.map((s, i) => ({ slot:'bp', idx:i, item:s })),
    ].filter(Boolean);

    const body = document.getElementById('tradeWindowBody');
    const picker = document.createElement('div');
    picker.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border:2px solid #00bcd4;border-radius:3px;padding:14px;z-index:10;max-height:320px;overflow-y:auto;width:280px;';

    picker.innerHTML = `<div style="font-size:9px;color:#80deea;margin-bottom:10px;">Pick an item to offer:</div>`;

    const td   = currentTrade;
    const isFrom = td && td.from === Player.state.username;
    const myOffer = isFrom ? (td.fromOffer || []) : (td.toOffer || []);

    available.forEach(ref => {
      const item = ref.item;
      if (!item || item.type === 'tool') return;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);';
      row.innerHTML = `<span style="font-size:20px">${item.icon}</span><span style="font-size:9px;color:#f5e6c8">${item.name}</span>`;
      row.onclick = () => {
        // Move item to offer
        if (ref.slot === 'hotbar') Player.removeFromHotbar(ref.idx, 1);
        else {
          const itm = Player.state.backpack[ref.idx];
          if (itm) { itm.count = (itm.count||1) - 1; if (itm.count <= 0) Player.state.backpack.splice(ref.idx,1); }
        }

        const newOffer = [...myOffer, { ...item, count:1 }];
        const upd = isFrom ? { fromOffer: newOffer, fromAccept: false }
                           : { toOffer:   newOffer, toAccept:   false };
        DB.update(DB.ref(`gag/trades/${myTradeKey}`), upd);
        body.querySelector('[style*="position:absolute"]')?.remove();
      };
      picker.appendChild(row);
    });

    const cancel = document.createElement('button');
    cancel.className = 'btn-red-sm';
    cancel.style.cssText = 'display:block;margin-top:10px;';
    cancel.textContent = 'CANCEL';
    cancel.onclick = () => picker.remove();
    picker.appendChild(cancel);

    body.style.position = 'relative';
    body.appendChild(picker);
  }

  function removeFromOffer(idx) {
    const td     = currentTrade;
    const isFrom = td && td.from === Player.state.username;
    const myOffer = isFrom ? [...(td.fromOffer||[])] : [...(td.toOffer||[])];
    const removed = myOffer.splice(idx, 1)[0];
    if (removed) Player.addItem(removed);
    const upd = isFrom ? { fromOffer: myOffer, fromAccept: false }
                       : { toOffer:   myOffer, toAccept:   false };
    DB.update(DB.ref(`gag/trades/${myTradeKey}`), upd);
  }

  function acceptTrade() {
    const td     = currentTrade;
    const isFrom = td && td.from === Player.state.username;
    const upd    = isFrom ? { fromAccept: true } : { toAccept: true };
    DB.update(DB.ref(`gag/trades/${myTradeKey}`), upd);
    UI.showNotif('✓ You accepted! Waiting for partner...', 'success');
  }

  // ── EXECUTE TRADE ─────────────────────────────────────────
  async function executeTrade(td) {
    const myUsername = Player.state.username;
    const isFrom = td.from === myUsername;
    const myOffer    = isFrom ? (td.fromOffer || []) : (td.toOffer   || []);
    const theirOffer = isFrom ? (td.toOffer   || []) : (td.fromOffer || []);

    // Give them our items, take their items
    theirOffer.forEach(item => Player.addItem(item));
    Player.save();

    await DB.update(DB.ref(`gag/trades/${myTradeKey}`), { status: 'done' });

    UI.showNotif('🤝 Trade complete!', 'success');
    cancelTrade();
  }

  // ── CANCEL ────────────────────────────────────────────────
  async function cancelTrade() {
    if (myTradeKey) {
      try { await DB.update(DB.ref(`gag/trades/${myTradeKey}`), { status: 'cancelled' }); } catch {}
    }
    if (tradeListener) {
      try { DB.off(DB.ref(`gag/trades/${myTradeKey || ''}`), 'value', tradeListener); } catch {}
      tradeListener = null;
    }
    document.getElementById('tradeWindowOverlay').style.display = 'none';
    window._tradeWindowOpen = false;
    currentTrade = null;
    myTradeKey   = null;
  }

  return {
    openList, close,
    sendRequest, acceptIncoming, declineIncoming,
    initIncomingListener, cancelTrade,
    openWindow, addToOffer, removeFromOffer,
    acceptTrade,
  };
})();