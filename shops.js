// shops.js  –  Grow-a-Garden
// ShopModal: seed shop, gear shop, pet shop, sell shop, mutation machine.
// GemShop: gem-currency shop with seed packs, exclusive eggs, codes.

// ═════════════════════════════════════════════════════════
//  SHOP MODAL
// ═════════════════════════════════════════════════════════
window.ShopModal = (() => {

  const SHOP_CFG = {
    seed: {
      icon:'🌰', title:'SEED SHOP', color:'#4caf50',
      npc:'"Fresh seeds for a bountiful harvest, traveller!"'
    },
    gear: {
      icon:'⚙️', title:'GEAR SHOP', color:'#ff9800',
      npc:'"The finest tools coins can buy — boost your garden!"'
    },
    pet: {
      icon:'🥚', title:'PET SHOP', color:'#e91e63',
      npc:'"Every egg holds a surprise — maybe even a legend!"'
    },
    sell: {
      icon:'💰', title:'SELL SHOP', color:'#ffd700',
      npc:'"I\'ll pay top coin for your finest crops!"'
    },
    mutation: {
      icon:'🔬', title:'MUTATION MACHINE', color:'#9c27b0',
      npc:'"Feed your pet to the machine... it comes back stronger!"'
    },
  };

  function open(type, shackDef) {
    window._shopOpen = true;
    const cfg = SHOP_CFG[type] || SHOP_CFG.seed;

    document.getElementById('shopIconEl').textContent   = cfg.icon;
    document.getElementById('shopTitleEl').textContent  = cfg.title;
    document.getElementById('shopNpcEl').textContent    = shackDef?.npcQuote || cfg.npc;
    document.getElementById('shopHdr').style.borderBottomColor = cfg.color;

    const body = document.getElementById('shopBody');
    body.innerHTML = '';

    if (type === 'seed')     renderSeedShop(body);
    if (type === 'gear')     renderGearShop(body);
    if (type === 'pet')      renderPetShop(body);
    if (type === 'sell')     renderSellShop(body);
    if (type === 'mutation') renderMutationMachine(body);

    document.getElementById('shopOverlay').style.display = 'flex';
  }

  function close() {
    document.getElementById('shopOverlay').style.display = 'none';
    window._shopOpen = false;
  }

  // ── SEED SHOP ─────────────────────────────────────────────
  function renderSeedShop(body) {
    const coins = Player.state.coins;
    body.innerHTML = `<div style="padding:10px 14px;font-size:8px;color:#8d6e63;border-bottom:1px solid rgba(255,255,255,0.05)">
      Your coins: <span style="color:#ffd700">🪙 ${coins}</span>
    </div>`;
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    DATA.SEEDS.forEach(seed => {
      const price = seed.buyPrice;
      const canAfford = coins >= price;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.opacity = canAfford ? '1' : '0.55';
      el.innerHTML = `
        <div class="s-icon">${seed.icon}</div>
        <div class="s-name">${seed.name}</div>
        <div class="s-desc r-${seed.rarity}">${seed.rarity.toUpperCase()}</div>
        <div class="s-desc" style="color:#8d6e63">${fmtTime(seed.growTime)}</div>
        <div class="s-price">🪙 ${price}</div>
      `;
      el.onclick = () => buySeed(seed, price);
      grid.appendChild(el);
    });
    body.appendChild(grid);
  }

  function buySeed(seed, price) {
    if (!Player.spendCoins(price)) {
      UI.showNotif('Not enough coins! 🪙', 'error'); return;
    }
    const item = Player.makeStack('seed', seed.id, seed.icon, seed.name, {
      rarity: seed.rarity, growTime: seed.growTime, baseValue: seed.baseValue
    });
    Player.addItem(item);
    Player.save();
    UI.showNotif(`${seed.icon} Bought ${seed.name} seed!`, 'success');
    // Re-render to update coin display
    renderSeedShop(document.getElementById('shopBody'));
  }

  // ── GEAR SHOP ─────────────────────────────────────────────
  function renderGearShop(body) {
    body.innerHTML = `<div style="padding:10px 14px;font-size:8px;color:#8d6e63;border-bottom:1px solid rgba(255,255,255,0.05)">
      Your coins: <span style="color:#ffd700">🪙 ${Player.state.coins}</span>
    </div>`;
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    DATA.GEAR.forEach(gear => {
      const canAfford = Player.state.coins >= gear.price;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.opacity = canAfford ? '1' : '0.55';
      el.innerHTML = `
        <div class="s-icon">${gear.icon}</div>
        <div class="s-name">${gear.name}</div>
        <div class="s-desc" style="color:#a5d6a7">${gear.desc}</div>
        <div class="s-price">🪙 ${gear.price}</div>
      `;
      el.onclick = () => buyGear(gear);
      grid.appendChild(el);
    });
    body.appendChild(grid);
  }

  function buyGear(gear) {
    if (!Player.spendCoins(gear.price)) {
      UI.showNotif('Not enough coins! 🪙', 'error'); return;
    }
    const item = Player.makeStack('tool', gear.id, gear.icon, gear.name, {
      stackable: gear.stackable
    });
    Player.addItem(item);
    Player.save();
    UI.showNotif(`${gear.icon} Bought ${gear.name}!`, 'success');
    renderGearShop(document.getElementById('shopBody'));
  }

  // ── PET SHOP ──────────────────────────────────────────────
  function renderPetShop(body) {
    body.innerHTML = `<div style="padding:10px 14px;font-size:8px;color:#8d6e63;border-bottom:1px solid rgba(255,255,255,0.05)">
      Your coins: <span style="color:#ffd700">🪙 ${Player.state.coins}</span>
    </div>`;
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    DATA.PET_EGGS.forEach(egg => {
      const canAfford = Player.state.coins >= egg.price;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.opacity = canAfford ? '1' : '0.55';
      el.style.borderColor = egg.rarityBorder;

      const bestPet = egg.pets.reduce((a, b) => a.chance < b.chance ? a : b);
      el.innerHTML = `
        <div class="s-icon">${egg.icon}</div>
        <div class="s-name">${egg.name}</div>
        <div class="s-desc" style="color:#8d6e63">${egg.description}</div>
        <div class="s-desc r-legendary" style="font-size:7px">Best: ${bestPet.icon} ${bestPet.name} (${bestPet.chance}%)</div>
        <div class="s-price">🪙 ${egg.price}</div>
      `;
      el.onclick = () => buyEgg(egg);
      grid.appendChild(el);
    });
    body.appendChild(grid);
  }

  function buyEgg(egg) {
    if (!Player.spendCoins(egg.price)) {
      UI.showNotif('Not enough coins! 🪙', 'error'); return;
    }
    const item = Player.makeStack('egg', egg.id, egg.icon, egg.name, {
      eggData: egg.id, pets: egg.pets
    });
    Player.addItem(item);
    Player.save();
    UI.showNotif(`${egg.icon} Bought ${egg.name}!`, 'success');
    renderPetShop(document.getElementById('shopBody'));
  }

  // ── SELL SHOP ─────────────────────────────────────────────
  function renderSellShop(body) {
    const heldItem = Player.state.hotbar[UI.currentSlot];
    const isHeldFruit = heldItem && heldItem.type === 'fruit';

    let totalFruitValue = 0;
    [...Player.state.hotbar, ...Player.state.backpack].forEach(s => {
      if (s && s.type === 'fruit') totalFruitValue += (s.value || 0) * (s.count || 1);
    });

    const rows = document.createElement('div');
    rows.className = 'sell-opts';

    // Check price
    const checkRow = document.createElement('div');
    checkRow.className = 'sell-opt';
    checkRow.innerHTML = `
      <span class="so-label">📋 Check held fruit price</span>
      <span class="so-val">${isHeldFruit ? `🪙 ${heldItem.value}` : '—'}</span>
    `;
    checkRow.onclick = () => Garden.checkHeldFruitPrice();
    rows.appendChild(checkRow);

    // Sell held
    const sellHeld = document.createElement('div');
    sellHeld.className = 'sell-opt';
    sellHeld.style.opacity = isHeldFruit ? '1' : '0.4';
    sellHeld.innerHTML = `
      <span class="so-label">💰 Sell held fruit${isHeldFruit ? ': ' + heldItem.icon + ' ' + heldItem.name : ''}</span>
      <span class="so-val">${isHeldFruit ? `🪙 ${heldItem.value * (heldItem.count||1)}` : '—'}</span>
    `;
    sellHeld.onclick = () => { if (isHeldFruit) { Garden.sellFruit('held'); close(); } };
    rows.appendChild(sellHeld);

    // Sell all fruit
    const sellAll = document.createElement('div');
    sellAll.className = 'sell-opt';
    sellAll.style.opacity = totalFruitValue > 0 ? '1' : '0.4';
    sellAll.innerHTML = `
      <span class="so-label">🎒 Sell ALL fruit in inventory</span>
      <span class="so-val">🪙 ${totalFruitValue}</span>
    `;
    sellAll.onclick = () => { Garden.sellFruit('all'); close(); };
    rows.appendChild(sellAll);

    // Sell pet
    const sellPet = document.createElement('div');
    sellPet.className = 'sell-opt';
    sellPet.innerHTML = `
      <span class="so-label">🐾 Sell a pet (at a loss)</span>
      <span class="so-val">Choose →</span>
    `;
    sellPet.onclick = () => { close(); PetManager.openSellMode(); };
    rows.appendChild(sellPet);

    body.appendChild(rows);
  }

  // ── MUTATION MACHINE ──────────────────────────────────────
  function renderMutationMachine(body) {
    const pets = Player.state.ownedPets || [];
    const eligible = pets.filter(p => !p.mutation && p.level >= 10);

    body.innerHTML = `
      <div style="padding:16px;font-size:9px;color:#ce93d8;line-height:1.8;border-bottom:1px solid rgba(255,255,255,0.05)">
        Feed your pet into the Mutation Machine to reset it to level 1, but grant it a
        permanent mutation — making it <strong style="color:#ffd700">permanently stronger</strong>.<br><br>
        Requirement: Pet must be <strong>level 10+</strong> and have no mutation yet.
      </div>
    `;

    if (eligible.length === 0) {
      body.innerHTML += `<div style="padding:24px;text-align:center;font-size:9px;color:#8d6e63">
        No eligible pets right now.<br>Level up a pet to level 10 first!
      </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'pet-grid';
    eligible.forEach(pet => {
      const el = document.createElement('div');
      el.className = 'pet-card';
      el.innerHTML = `
        <div class="p-icon">${pet.icon}</div>
        <div class="p-name">${pet.name}</div>
        <div class="p-level">Lv ${pet.level}</div>
        <div style="font-size:7px;color:#ce93d8;margin-top:4px">Click to mutate</div>
      `;
      el.onclick = () => mutatePet(pet);
      grid.appendChild(el);
    });
    body.appendChild(grid);
  }

  function mutatePet(pet) {
    ConfirmDialog.show(
      '🔬 Mutation Machine',
      `Reset ${pet.icon} ${pet.name} to Lv 1 in exchange for a permanent mutation?\nThis cannot be undone!`,
      () => {
        const mutations = ['Rainbow', 'Golden', 'Cosmic', 'Fiery', 'Frosty', 'Midnight', 'Chocolate'];
        pet.mutation = mutations[Math.floor(Math.random() * mutations.length)];
        pet.level = 1;
        pet.xp    = 0;
        Player.save();
        UI.showNotif(`✨ ${pet.name} got ${pet.mutation} mutation!`, 'gem');
        close();
      }
    );
  }

  // ── UTILS ─────────────────────────────────────────────────
  function fmtTime(secs) {
    if (secs < 60)   return secs + 's';
    if (secs < 3600) return Math.floor(secs/60) + 'm';
    return Math.floor(secs/3600) + 'h ' + Math.floor((secs%3600)/60) + 'm';
  }

  return { open, close };
})();


// ═════════════════════════════════════════════════════════
//  GEM SHOP
// ═════════════════════════════════════════════════════════
window.GemShop = (() => {

  let currentTab = 'items';

  function open() {
    window._gemShopOpen = true;
    renderShop();
    document.getElementById('gemShopOverlay').style.display = 'flex';
  }

  function close() {
    document.getElementById('gemShopOverlay').style.display = 'none';
    window._gemShopOpen = false;
  }

  function renderShop() {
    const body = document.getElementById('gemShopBody');
    body.innerHTML = '';

    // Tabs row
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);';
    [
      { id:'items',  label:'🛒 Items' },
      { id:'packs',  label:'🎁 Packs' },
      { id:'codes',  label:'🔑 Codes' },
    ].forEach(t => {
      const btn = document.createElement('button');
      btn.style.cssText = `flex:1;padding:8px;background:transparent;border:none;
        font-family:var(--font-si);font-size:9px;cursor:pointer;letter-spacing:1px;
        color:${currentTab===t.id?'#b39ddb':'#5c5c8a'};
        border-bottom:2px solid ${currentTab===t.id?'#7c4dff':'transparent'};
        margin-bottom:-1px;`;
      btn.textContent = t.label;
      btn.onclick = () => { currentTab = t.id; renderShop(); };
      tabs.appendChild(btn);
    });
    body.appendChild(tabs);

    const gems = Player.state.gems;
    const info = document.createElement('div');
    info.style.cssText = 'padding:8px 14px;font-size:8px;color:#8d6e63;';
    info.textContent = `Your gems: 💎 ${gems}  (+1 every 15s of playing)`;
    body.appendChild(info);

    if (currentTab === 'items') renderItems(body);
    if (currentTab === 'packs') renderPacks(body);
    if (currentTab === 'codes') renderCodes(body);
  }

  function renderItems(body) {
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    DATA.GEM_ITEMS.forEach(item => {
      const canAfford = Player.state.gems >= item.gemPrice;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.opacity = canAfford ? '1' : '0.5';
      el.innerHTML = `
        <div class="s-icon">${item.icon}</div>
        <div class="s-name">${item.name}</div>
        <div class="s-desc" style="color:#8d6e63">${item.description}</div>
        <div class="s-price gem-price">💎 ${item.gemPrice}</div>
      `;
      el.onclick = () => buyGemItem(item);
      grid.appendChild(el);
    });

    // Admin-released exclusive items
    DB.get(DB.ref('gag/admin_shop_items')).then(snap => {
      if (!snap.exists()) return;
      snap.forEach(child => {
        const it = child.val();
        if (!it.active) return;
        const canAfford = Player.state.gems >= it.gemPrice;
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.style.opacity = canAfford ? '1' : '0.5';
        el.style.borderColor = '#ffd700';
        el.innerHTML = `
          <div class="s-icon">${it.icon || '🎁'}</div>
          <div class="s-name">${it.name}</div>
          <div class="s-desc r-legendary">EXCLUSIVE</div>
          <div class="s-desc" style="color:#8d6e63">${it.description || ''}</div>
          <div class="s-price gem-price">💎 ${it.gemPrice}</div>
        `;
        el.onclick = () => buyAdminItem(child.key, it);
        grid.appendChild(el);
      });
    }).catch(() => {});

    body.appendChild(grid);
  }

  function renderPacks(body) {
    const packItems = DATA.GEM_ITEMS.filter(i => i.type === 'seed_pack' || i.type === 'pet_egg');
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    packItems.forEach(item => {
      const canAfford = Player.state.gems >= item.gemPrice;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.style.opacity = canAfford ? '1' : '0.5';
      el.innerHTML = `
        <div class="s-icon">${item.icon}</div>
        <div class="s-name">${item.name}</div>
        <div class="s-desc" style="color:#8d6e63">${item.description}</div>
        <div class="s-price gem-price">💎 ${item.gemPrice}</div>
      `;
      el.onclick = () => buyGemItem(item);
      grid.appendChild(el);
    });
    body.appendChild(grid);
  }

  function renderCodes(body) {
    const section = document.createElement('div');
    section.style.cssText = 'padding:16px;';
    section.innerHTML = `
      <div style="font-size:9px;color:#8d6e63;margin-bottom:12px;line-height:1.8">
        Enter a secret code from the game creator to get exclusive rewards!
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" id="codeInput" placeholder="Enter code..." class="admin-input"
          style="margin-bottom:0;text-transform:uppercase;letter-spacing:2px;"
          oninput="this.value=this.value.toUpperCase()">
        <button class="btn-gold" onclick="GemShop.redeemCode()">REDEEM</button>
      </div>
      <div id="codeResult" style="font-size:9px;min-height:20px;"></div>
    `;
    body.appendChild(section);
  }

  async function redeemCode() {
    const code  = document.getElementById('codeInput')?.value?.trim().toUpperCase();
    const resEl = document.getElementById('codeResult');
    if (!code) return;

    try {
      const snap = await DB.get(DB.ref(`gag/codes/${code}`));
      if (!snap.exists()) {
        resEl.style.color = '#ef5350';
        resEl.textContent = '✕ Invalid code';
        return;
      }
      const codeData = snap.val();

      // Check if already redeemed by this player
      const redeemedSnap = await DB.get(DB.ref(`gag/code_redemptions/${Player.state.username}/${code}`));
      if (redeemedSnap.exists()) {
        resEl.style.color = '#ff9800';
        resEl.textContent = 'You already redeemed this code!';
        return;
      }

      // Redeem!
      if (codeData.coins)  Player.addCoins(codeData.coins);
      if (codeData.gems)   Player.addGems(codeData.gems);
      if (codeData.seeds) {
        codeData.seeds.forEach(seedId => {
          const sd = DATA.getSeedById(seedId);
          if (sd) Player.addItem(Player.makeStack('seed', sd.id, sd.icon, sd.name));
        });
      }

      // Mark redeemed
      await DB.set(DB.ref(`gag/code_redemptions/${Player.state.username}/${code}`), {
        redeemedAt: Date.now()
      });
      await Player.save();

      resEl.style.color = '#66bb6a';
      resEl.textContent = `✓ Code redeemed! ${codeData.coins ? '🪙'+codeData.coins : ''} ${codeData.gems ? '💎'+codeData.gems : ''}`;
      UI.showNotif('🎁 Code redeemed!', 'success');

    } catch(e) {
      resEl.style.color = '#ef5350';
      resEl.textContent = 'Error: ' + e.message;
    }
  }

  function buyGemItem(item) {
    if (!Player.spendGems(item.gemPrice)) {
      UI.showNotif('Not enough gems! 💎', 'error'); return;
    }
    Player.save();

    if (item.type === 'seed_pack') {
      openSeedPack(item);
    } else if (item.type === 'pet_egg') {
      Pets.openHatch({ ...item, isGemEgg: true });
    } else if (item.type === 'item_bundle') {
      item.gives?.forEach(g => {
        const gear = DATA.getGearById(g.id);
        if (gear) {
          for (let i = 0; i < g.count; i++) {
            Player.addItem(Player.makeStack('tool', gear.id, gear.icon, gear.name));
          }
        }
      });
      UI.showNotif(`${item.icon} Got ${item.name}!`, 'success');
    }
  }

  function buyAdminItem(key, it) {
    if (!Player.spendGems(it.gemPrice)) {
      UI.showNotif('Not enough gems! 💎', 'error'); return;
    }
    Player.addItem(Player.makeStack(it.itemType || 'seed', it.itemId || key, it.icon || '🎁', it.name));
    Player.save();
    UI.showNotif(`✨ Got exclusive item: ${it.name}!`, 'gem');
  }

  function openSeedPack(packDef) {
    const pool = packDef.pool || [];
    const count = 1 + Math.floor(Math.random() * 3);
    const overlay = document.getElementById('packOverlay');
    const body    = document.getElementById('packBody');
    body.innerHTML = '';
    overlay.style.display = 'flex';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:var(--font-px);font-size:12px;color:#9c27b0;margin-bottom:20px;';
    title.textContent = '🎁 ' + packDef.name;
    body.appendChild(title);

    let rollIdx = 0;
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    const display = document.createElement('div');
    display.style.cssText = 'font-size:48px;margin:16px;min-height:60px;';
    body.appendChild(display);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:9px;color:#ce93d8;margin-bottom:20px;';
    sub.textContent = 'Rolling...';
    body.appendChild(sub);

    // Animate roll
    let frames = 0;
    const allSeeds = DATA.SEEDS;
    const roll = setInterval(() => {
      const fake = allSeeds[Math.floor(Math.random() * allSeeds.length)];
      display.textContent = fake.icon;
      frames++;
      if (frames >= 24) {
        clearInterval(roll);
        // Reveal results
        display.style.cssText = 'font-size:36px;margin:8px;';
        body.innerHTML = '';
        body.appendChild(title);

        const resultRow = document.createElement('div');
        resultRow.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin:20px 0;';
        results.forEach(seedId => {
          const sd = DATA.getSeedById(seedId);
          if (!sd) return;
          Player.addItem(Player.makeStack('seed', sd.id, sd.icon, sd.name, {
            rarity: sd.rarity
          }));
          const card = document.createElement('div');
          card.className = 'pack-result';
          card.style.cssText = 'text-align:center;';
          card.innerHTML = `
            <div style="font-size:40px">${sd.icon}</div>
            <div style="font-size:9px;color:#f5e6c8;margin-top:4px">${sd.name}</div>
            <div class="r-${sd.rarity}" style="font-size:8px">${sd.rarity}</div>
          `;
          resultRow.appendChild(card);
        });
        body.appendChild(resultRow);
        Player.save();

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-gold';
        closeBtn.textContent = '✓ COLLECT';
        closeBtn.onclick = () => { overlay.style.display = 'none'; };
        body.appendChild(closeBtn);
      }
    }, 80);
  }

  return { open, close, redeemCode };
})();
