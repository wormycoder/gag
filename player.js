// player.js  –  Grow-a-Garden
// Player state, inventory management, and Firebase save/load.

window.Player = (() => {

  // ── STATE ─────────────────────────────────────────────────
  const state = {
    username:  null,
    isAdmin:   false,
    coins:     0,       // earned from selling
    gems:      0,       // earned passively over time
    hotbar:    Array(9).fill(null),  // each slot: null | ItemStack
    backpack:  [],                   // ItemStack[]
    garden:    {},                   // plantId -> PlantData
    pets:      [],                   // PetInstance[] (max 8 in garden)
    ownedPets: [],                   // All pet instances owned
    sprinklers:{ a: false, b: false }, // active sprinkler types
    wateringBoost: 1,                // grow speed multiplier
    wateringUntil: 0,                // timestamp when boost expires
    lastSave:  0,
  };

  // ── ADMIN ACCOUNTS (hardcoded) ────────────────────────────
  const ADMINS = { cucumber:'cucumber', admin:'admin123' };

  // ── ITEM STACK HELPERS ────────────────────────────────────
  function makeStack(type, id, icon, name, extra = {}) {
    return { type, id, icon, name, count: 1, ...extra };
  }

  // Add item to hotbar first, overflow to backpack
  function addItem(item) {
    // Stack into existing hotbar slot of same id
    for (let i = 0; i < 9; i++) {
      const s = state.hotbar[i];
      if (s && s.id === item.id && s.type === item.type &&
          s.type !== 'fruit' && s.type !== 'pet') {
        s.count = (s.count || 1) + (item.count || 1);
        refreshHotbar();
        return;
      }
    }
    // Empty hotbar slot
    for (let i = 0; i < 9; i++) {
      if (!state.hotbar[i]) {
        state.hotbar[i] = { ...item, count: item.count || 1 };
        refreshHotbar();
        return;
      }
    }
    // Overflow to backpack
    const ex = state.backpack.find(b => b.id === item.id && b.type === item.type && b.type !== 'fruit');
    if (ex) { ex.count = (ex.count || 1) + (item.count || 1); }
    else     { state.backpack.push({ ...item, count: item.count || 1 }); }
    UI.showNotif('Hotbar full — item went to backpack!', 'admin');
  }

  function removeFromHotbar(slot, count = 1) {
    const s = state.hotbar[slot];
    if (!s) return false;
    if ((s.count || 1) <= count) { state.hotbar[slot] = null; }
    else { s.count -= count; }
    refreshHotbar();
    return true;
  }

  function refreshHotbar() {
    if (window.UI) UI.renderHotbar();
  }

  // ── SAVE ─────────────────────────────────────────────────
  async function save() {
    if (!state.username) return;
    const data = {
      coins:     state.coins,
      gems:      state.gems,
      hotbar:    state.hotbar,
      backpack:  state.backpack,
      garden:    state.garden,
      ownedPets: state.ownedPets,
      pets:      state.pets,
      sprinklers:state.sprinklers,
      wateringUntil: state.wateringUntil,
      lastSeen:  Date.now(),
      online:    true
    };
    try {
      await DB.update(DB.ref(`gag/players/${state.username}`), data);
    } catch(e) { console.warn('Save failed:', e); }
    state.lastSave = Date.now();
  }

  // ── LOAD ─────────────────────────────────────────────────
  async function load(username) {
    const snap = await DB.get(DB.ref(`gag/players/${username}`));
    return snap.exists() ? snap.val() : null;
  }

  // ── INIT ──────────────────────────────────────────────────
  async function init(username, isAdmin, savedData) {
    state.username = username;
    state.isAdmin  = isAdmin;

    if (savedData) {
      state.coins      = savedData.coins      || 0;
      state.gems       = savedData.gems       || 0;
      state.hotbar     = savedData.hotbar     || Array(9).fill(null);
      state.backpack   = savedData.backpack   || [];
      state.garden     = savedData.garden     || {};
      state.ownedPets  = savedData.ownedPets  || [];
      state.pets       = savedData.pets       || [];
      state.sprinklers = savedData.sprinklers || { a:false, b:false };
      state.wateringUntil = savedData.wateringUntil || 0;
    }

    // Always make sure slot 0 has the shovel
    if (!state.hotbar[0] || state.hotbar[0]?.id !== 'shovel') {
      state.hotbar[0] = makeStack('tool', 'shovel', '🪣', 'Shovel', { count:1 });
    }

    // Start passive gem timer
    startGemTimer();

    // Start watering boost checker
    setInterval(checkWateringBoost, 5000);

    // Auto-save every 30 seconds
    setInterval(save, 30000);

    return state;
  }

  // ── GEM TIMER ─────────────────────────────────────────────
  let gemInterval = null;
  function startGemTimer() {
    if (gemInterval) clearInterval(gemInterval);
    gemInterval = setInterval(async () => {
      state.gems += 1;
      const el = document.getElementById('gemsVal');
      if (el) el.textContent = state.gems;
    }, 15000); // +1 gem every 15 seconds of playing
  }

  // ── WATERING BOOST ────────────────────────────────────────
  function checkWateringBoost() {
    if (state.wateringUntil > Date.now()) {
      // boost still active — no change needed
    } else if (state.wateringBoost !== 1) {
      state.wateringBoost = 1;
      UI.showNotif('🪣 Watering boost ended', '');
    }
  }

  function applyWateringCan(gearItem) {
    const effect = DATA.getGearById(gearItem.id)?.effect;
    if (!effect) return;
    state.wateringBoost = effect.mult;
    state.wateringUntil = Date.now() + effect.duration * 1000;
    UI.showNotif(`${gearItem.icon} Growth speed ×${effect.mult} for ${effect.duration}s!`, 'success');
  }

  function applySprinkler(gearItem) {
    const gd = DATA.getGearById(gearItem.id);
    if (!gd) return;
    // Sprinklers don't stack same type
    if (gd.id === 'sprinkler_a') {
      if (state.sprinklers.a) { UI.showNotif('Basic Sprinkler already active!', 'error'); return; }
      state.sprinklers.a = true;
      UI.showNotif('💧 Basic Sprinkler placed! Fruit will be 25% bigger.', 'success');
    } else if (gd.id === 'sprinkler_b') {
      if (state.sprinklers.b) { UI.showNotif('Premium Sprinkler already active!', 'error'); return; }
      state.sprinklers.b = true;
      UI.showNotif('🌊 Premium Sprinkler placed! Fruit will be 60% bigger.', 'success');
    }
  }

  function getSizeMult() {
    let m = 1;
    if (state.sprinklers.a) m *= 1.25;
    if (state.sprinklers.b) m *= 1.6;
    return m;
  }

  function getSpeedMult() {
    return state.wateringUntil > Date.now() ? state.wateringBoost : 1;
  }

  // ── COINS ─────────────────────────────────────────────────
  function addCoins(n) {
    state.coins += n;
    const el = document.getElementById('coinsVal');
    if (el) el.textContent = state.coins;
  }
  function spendCoins(n) {
    if (state.coins < n) return false;
    state.coins -= n;
    const el = document.getElementById('coinsVal');
    if (el) el.textContent = state.coins;
    return true;
  }
  function addGems(n) {
    state.gems += n;
    const el = document.getElementById('gemsVal');
    if (el) el.textContent = state.gems;
  }
  function spendGems(n) {
    if (state.gems < n) return false;
    state.gems -= n;
    const el = document.getElementById('gemsVal');
    if (el) el.textContent = state.gems;
    return true;
  }

  // ── PET HELPERS ───────────────────────────────────────────
  function addPetToOwned(petInstance) {
    state.ownedPets.push(petInstance);
  }

  function getActivePets() {
    return state.pets.filter(p => p.inGarden);
  }

  return {
    get state() { return state; },
    ADMINS,
    makeStack,
    addItem,
    removeFromHotbar,
    save, load, init,
    addCoins, spendCoins,
    addGems, spendGems,
    applyWateringCan,
    applySprinkler,
    getSizeMult,
    getSpeedMult,
    addPetToOwned,
    getActivePets,
    refreshHotbar,
  };
})();
