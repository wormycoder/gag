// pets.js  –  Grow-a-Garden
// Pet hatching, leveling, feeding, manager UI, sell pets.

window.Pets = (() => {

  // ── HATCH EGG ────────────────────────────────────────────
  function openHatch(eggItem) {
    const eggDef = DATA.getEggById(eggItem.eggData || eggItem.id)
                || (eggItem.pets ? eggItem : null);
    if (!eggDef) { UI.showNotif('Unknown egg type!', 'error'); return; }

    const overlay = document.getElementById('hatchOverlay');
    const body    = document.getElementById('hatchBody');
    body.innerHTML = '';
    overlay.style.display = 'flex';

    // Shaking egg animation
    const eggDiv = document.createElement('div');
    eggDiv.style.cssText = 'font-size:64px;animation:hatchShake 0.35s ease infinite;margin:20px 0;';
    eggDiv.textContent = eggDef.icon || '🥚';
    body.appendChild(eggDiv);

    const label = document.createElement('div');
    label.style.cssText = 'font-family:var(--font-px);font-size:10px;color:#ffd700;margin-bottom:8px;';
    label.textContent = 'HATCHING...';
    body.appendChild(label);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:8px;color:#8d6e63;';
    sub.textContent = 'Something is moving inside...';
    body.appendChild(sub);

    setTimeout(() => {
      const pet    = rollPet(eggDef);
      const isGiant = shouldBeGiant(pet);
      const size   = isGiant ? 3.0 + Math.random() * 1.5
                              : 0.8 + Math.random() * 0.4;

      const instance = makePetInstance(pet, eggDef.id, size, isGiant);
      Player.state.ownedPets = Player.state.ownedPets || [];
      Player.state.ownedPets.push(instance);
      Player.save();

      // Reveal
      body.innerHTML = '';

      const resultIcon = document.createElement('div');
      resultIcon.style.cssText = `font-size:${isGiant?80:64}px;animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1);margin:16px 0;
        ${isGiant ? 'filter:drop-shadow(0 0 16px gold);' : ''}`;
      resultIcon.textContent = pet.icon;
      body.appendChild(resultIcon);

      const rLabel = document.createElement('div');
      rLabel.style.cssText = 'font-family:var(--font-px);font-size:14px;color:#ffd700;margin-bottom:6px;';
      rLabel.textContent = pet.name;
      body.appendChild(rLabel);

      const rRarity = document.createElement('div');
      rRarity.className = `r-${pet.rarity}`;
      rRarity.style.cssText = 'font-size:9px;letter-spacing:2px;margin-bottom:6px;';
      rRarity.textContent = pet.rarity.toUpperCase();
      body.appendChild(rRarity);

      if (isGiant) {
        const giantLabel = document.createElement('div');
        giantLabel.style.cssText = 'font-size:10px;color:#ffd700;animation:blink 0.5s step-end infinite;margin-bottom:8px;';
        giantLabel.textContent = '✨ GIANT! ✨';
        body.appendChild(giantLabel);
      }

      const abilLabel = document.createElement('div');
      abilLabel.style.cssText = 'font-size:8px;color:#a5d6a7;margin-bottom:16px;font-style:italic;';
      abilLabel.textContent = pet.ability;
      body.appendChild(abilLabel);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn-gold';
      closeBtn.textContent = '✓ WONDERFUL!';
      closeBtn.onclick = () => { overlay.style.display = 'none'; };
      body.appendChild(closeBtn);

      UI.showNotif(`${pet.icon} Hatched ${pet.name}!${isGiant?' (GIANT!)':''}`, 'gem');
    }, 2200);
  }

  function rollPet(eggDef) {
    const total = eggDef.pets.reduce((s, p) => s + p.chance, 0);
    let   rand  = Math.random() * total;
    for (const pet of eggDef.pets) {
      rand -= pet.chance;
      if (rand <= 0) return pet;
    }
    return eggDef.pets[0];
  }

  function shouldBeGiant(pet) {
    const chances = { common:0.005, uncommon:0.01, rare:0.03, epic:0.06, legendary:0.12 };
    return Math.random() < (chances[pet.rarity] || 0.005);
  }

  function makePetInstance(petDef, eggId, size, isGiant) {
    return {
      uid:      'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      id:       petDef.id,
      name:     petDef.name,
      icon:     petDef.icon,
      rarity:   petDef.rarity,
      eggId:    eggId,
      ability:  petDef.ability,
      size:     Math.round(size * 100) / 100,
      isGiant:  isGiant,
      level:    1,
      xp:       0,
      hunger:   100,
      mutation: null,
      inGarden: false,
    };
  }

  // ── PET MANAGER ───────────────────────────────────────────
  function open() {
    window._petMgrOpen = true;
    render();
    document.getElementById('petMgrOverlay').style.display = 'flex';
  }

  function close() {
    document.getElementById('petMgrOverlay').style.display = 'none';
    window._petMgrOpen = false;
  }

  let sellMode = false;

  function openSellMode() {
    sellMode = true;
    open();
  }

  function render() {
    const body = document.getElementById('petMgrBody');
    body.innerHTML = '';

    const pets = Player.state.ownedPets || [];

    if (pets.length === 0) {
      body.innerHTML = `<div style="padding:32px;text-align:center;font-size:9px;color:#8d6e63">
        No pets yet! Buy an egg from the Pet Shop or Gem Shop.
      </div>`;
      return;
    }

    if (sellMode) {
      const sellHeader = document.createElement('div');
      sellHeader.style.cssText = 'padding:12px 16px;font-size:8px;color:#ff9800;background:rgba(255,152,0,0.08);border-bottom:1px solid rgba(255,152,0,0.2)';
      sellHeader.textContent = '⚠ SELL MODE — Click a pet to sell it (for less than you paid)';
      body.appendChild(sellHeader);
    } else {
      const header = document.createElement('div');
      header.style.cssText = 'padding:10px 16px;font-size:8px;color:#8d6e63;border-bottom:1px solid rgba(255,255,255,0.05);';
      const inGarden = pets.filter(p => p.inGarden).length;
      header.textContent = `${inGarden}/8 pets in garden  |  ${pets.length} total owned`;
      body.appendChild(header);
    }

    // Feed section (if non-sell mode and fruit in inventory)
    if (!sellMode) {
      const fruitSlots = [...Player.state.hotbar, ...Player.state.backpack].filter(s => s && s.type === 'fruit');
      if (fruitSlots.length > 0) {
        const feedHdr = document.createElement('div');
        feedHdr.style.cssText = 'padding:8px 16px;font-size:8px;color:#a5d6a7;border-bottom:1px solid rgba(255,255,255,0.05);';
        feedHdr.textContent = '🍓 Click a pet then pick a fruit to feed it!';
        body.appendChild(feedHdr);
      }
    }

    const grid = document.createElement('div');
    grid.className = 'pet-grid';

    pets.forEach(pet => {
      const card = document.createElement('div');
      card.className = 'pet-card' + (pet.isGiant ? ' giant' : '');
      if (pet.inGarden) card.style.borderColor = '#4caf50';

      const hungerPct = Math.max(0, Math.min(100, pet.hunger));
      card.innerHTML = `
        <div class="p-icon" style="font-size:${pet.isGiant?42:34}px">${pet.icon}</div>
        <div class="p-name">${pet.name} ${pet.isGiant ? '★' : ''}</div>
        <div class="p-level r-${pet.rarity}">Lv ${pet.level}  ${pet.rarity.toUpperCase()}</div>
        ${pet.mutation ? `<div class="p-mutation">✨ ${pet.mutation}</div>` : ''}
        <div style="font-size:7px;color:#8d6e63;margin:2px 0">${pet.ability}</div>
        <div class="p-hunger"><div class="p-hunger-fill" style="width:${hungerPct}%"></div></div>
        <div style="font-size:7px;color:#8d6e63">Hunger: ${hungerPct}%</div>
        <div style="font-size:7px;color:#a5d6a7;margin-top:2px">${pet.inGarden ? '🟢 In garden' : '📦 In inventory'}</div>
      `;

      card.onclick = () => {
        if (sellMode) { sellPet(pet); }
        else { showPetOptions(pet); }
      };
      grid.appendChild(card);
    });

    body.appendChild(grid);

    if (sellMode) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-red-sm';
      cancelBtn.style.cssText = 'display:block;margin:16px auto;';
      cancelBtn.textContent = '✕ CANCEL';
      cancelBtn.onclick = () => { sellMode = false; close(); };
      body.appendChild(cancelBtn);
    }
  }

  function showPetOptions(pet) {
    const body = document.getElementById('petMgrBody');
    body.innerHTML = `
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="font-size:40px">${pet.icon}</div>
          <div>
            <div style="font-family:var(--font-px);font-size:11px;color:#ffd700">${pet.name}</div>
            <div class="r-${pet.rarity}" style="font-size:8px">${pet.rarity.toUpperCase()}</div>
            <div style="font-size:8px;color:#8d6e63">Lv ${pet.level}  |  XP: ${pet.xp}/${xpNeeded(pet.level)}</div>
          </div>
        </div>
        ${pet.mutation ? `<div style="font-size:8px;color:#ffa726;margin-bottom:4px">✨ Mutation: ${pet.mutation}</div>` : ''}
        <div style="font-size:8px;color:#a5d6a7;margin-bottom:8px">${pet.ability}</div>
        ${pet.isGiant ? '<div style="font-size:8px;color:#ffd700">★ GIANT — all stats boosted</div>' : ''}
      </div>
    `;

    const opts = [
      {
        label: pet.inGarden ? '🟢 Remove from garden' : '🌱 Place in garden (max 8)',
        fn: () => toggleInGarden(pet)
      },
      {
        label: '🍓 Feed a fruit to gain XP',
        fn: () => feedPetMenu(pet)
      },
      {
        label: '⬅ Back to all pets',
        fn: () => render()
      }
    ];

    opts.forEach(o => {
      const btn = document.createElement('div');
      btn.className = 'sell-opt';
      btn.innerHTML = `<span class="so-label">${o.label}</span>`;
      btn.onclick = o.fn;
      body.querySelector('div').appendChild(btn);
    });
  }

  function toggleInGarden(pet) {
    const inGarden = Player.state.pets.filter(p => p.inGarden).length;
    if (!pet.inGarden && inGarden >= 8) {
      UI.showNotif('Max 8 pets in garden at once!', 'error'); return;
    }
    pet.inGarden = !pet.inGarden;
    const existing = Player.state.pets.findIndex(p => p.uid === pet.uid);
    if (existing >= 0) {
      Player.state.pets.splice(existing, 1);
    }
    if (pet.inGarden) Player.state.pets.push(pet);
    Player.save();
    UI.showNotif(pet.inGarden ? `${pet.icon} ${pet.name} placed in garden!` : `${pet.icon} ${pet.name} removed from garden`, '');
    render();
  }

  function feedPetMenu(pet) {
    const fruits = [
      ...Player.state.hotbar.map((s, i) => s && s.type === 'fruit' ? { slot: 'hotbar', idx: i, item: s } : null),
      ...Player.state.backpack.map((s, i) => s && s.type === 'fruit' ? { slot: 'bp', idx: i, item: s } : null),
    ].filter(Boolean);

    if (fruits.length === 0) {
      UI.showNotif('No fruit in inventory to feed!', 'error'); return;
    }

    const body = document.getElementById('petMgrBody');
    body.innerHTML = `
      <div style="padding:14px;font-size:9px;color:#a5d6a7;border-bottom:1px solid rgba(255,255,255,0.05);">
        🍓 Choose a fruit to feed ${pet.icon} ${pet.name}
      </div>
    `;
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    fruits.forEach(f => {
      const rarityXp = { common:5, uncommon:12, rare:25, epic:50, legendary:150 };
      const xpGain   = Math.round((rarityXp[f.item.rarity] || 5) * (f.item.size || 1) * (f.item.value || 10) / 10);
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML = `
        <div class="s-icon">${f.item.icon}</div>
        <div class="s-name">${f.item.name}</div>
        <div class="s-price" style="color:#a5d6a7">+${xpGain} XP</div>
      `;
      el.onclick = () => feedPet(pet, f, xpGain);
      grid.appendChild(el);
    });

    const back = document.createElement('button');
    back.className = 'btn-red-sm';
    back.style.cssText = 'display:block;margin:12px auto;';
    back.textContent = '⬅ BACK';
    back.onclick = () => showPetOptions(pet);

    body.appendChild(grid);
    body.appendChild(back);
  }

  function feedPet(pet, fruitRef, xpGain) {
    // Remove fruit from inventory
    if (fruitRef.slot === 'hotbar') {
      Player.removeFromHotbar(fruitRef.idx, 1);
    } else {
      const item = Player.state.backpack[fruitRef.idx];
      if (!item) return;
      item.count = (item.count || 1) - 1;
      if (item.count <= 0) Player.state.backpack.splice(fruitRef.idx, 1);
    }

    pet.hunger = Math.min(100, (pet.hunger || 0) + 20);
    pet.xp     = (pet.xp || 0) + xpGain;

    // Level up check
    while (pet.xp >= xpNeeded(pet.level)) {
      pet.xp   -= xpNeeded(pet.level);
      pet.level += 1;
      // Slightly bigger on level up
      pet.size  = Math.round((pet.size + 0.05) * 100) / 100;
      UI.showNotif(`${pet.icon} ${pet.name} levelled up! Now Lv ${pet.level} 🎉`, 'success');
    }

    Player.save();
    UI.showNotif(`${pet.icon} Fed! +${xpGain} XP`, 'success');
    showPetOptions(pet);
  }

  function xpNeeded(level) {
    return Math.floor(100 * Math.pow(1.35, level - 1));
  }

  function sellPet(pet) {
    const sellPrices = { common:20, uncommon:60, rare:180, epic:400, legendary:1000 };
    const price = Math.round((sellPrices[pet.rarity] || 20) * (pet.size || 1));

    ConfirmDialog.show(
      `💰 Sell ${pet.icon} ${pet.name}?`,
      `You'll get 🪙 ${price} coins.\nThis is less than you paid!`,
      () => {
        Player.state.ownedPets = (Player.state.ownedPets || []).filter(p => p.uid !== pet.uid);
        Player.state.pets      = (Player.state.pets || []).filter(p => p.uid !== pet.uid);
        Player.addCoins(price);
        Player.save();
        UI.showNotif(`💰 Sold ${pet.name} for ${price} coins`, 'success');
        sellMode = false;
        close();
      }
    );
  }

  return { open, close, openHatch: openHatch, openSellMode, render };
})();

// Alias for external calls
window.PetManager = {
  open:         () => Pets.open(),
  close:        () => Pets.close(),
  openSellMode: () => Pets.openSellMode(),
};
