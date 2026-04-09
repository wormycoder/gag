// data.js  –  Grow-a-Garden
// All static game data: seeds, gear, eggs, pets, mutations, events.

window.DATA = (() => {

  // ── RARITY CONFIG ────────────────────────────────────────
  const RARITY_COLORS = {
    common:    '#9e9e9e',
    uncommon:  '#66bb6a',
    rare:      '#42a5f5',
    epic:      '#ab47bc',
    legendary: '#ffa726',
    mythic:    '#ff1744'
  };

  // ── SEEDS ─────────────────────────────────────────────────
  // growTime in seconds (real time). baseValue in coins.
  // sizeRange: [min, max] multiplier on the 3D model scale.
  const SEEDS = [
    {
      id:'carrot', name:'Carrot', icon:'🥕',
      rarity:'common', growTime:60, baseValue:22,
      buyPrice:20, color:0xff7043,
      sizeRange:[0.8, 1.4],
      description:'A classic veggie. Fast growing!'
    },
    {
      id:'tomato', name:'Tomato', icon:'🍅',
      rarity:'common', growTime:90, baseValue:18,
      buyPrice:30, color:0xf44336,
      sizeRange:[0.8, 1.3],
      description:'Juicy red tomatoes. Very popular.'
    },
    {
      id:'strawberry', name:'Strawberry', icon:'🍓',
      rarity:'uncommon', growTime:180, baseValue:35,
      buyPrice:65, color:0xe91e63,
      sizeRange:[0.7, 1.5],
      description:'Sweet strawberries grow in clusters.'
    },
    {
      id:'watermelon', name:'Watermelon', icon:'🍉',
      rarity:'uncommon', growTime:300, baseValue:55,
      buyPrice:90, color:0x4caf50,
      sizeRange:[1.0, 2.0],
      description:'A big, refreshing summer fruit.'
    },
    {
      id:'pumpkin', name:'Pumpkin', icon:'🎃',
      rarity:'uncommon', growTime:360, baseValue:65,
      buyPrice:110, color:0xff9800,
      sizeRange:[0.9, 1.8],
      description:'Grows large. Great for autumn.'
    },
    {
      id:'sunflower', name:'Sunflower', icon:'🌻',
      rarity:'rare', growTime:600, baseValue:110,
      buyPrice:200, color:0xffc107,
      sizeRange:[1.2, 2.2],
      description:'Tall and majestic. Rare blooms.'
    },
    {
      id:'blueberry', name:'Blueberry', icon:'🫐',
      rarity:'rare', growTime:720, baseValue:140,
      buyPrice:260, color:0x3f51b5,
      sizeRange:[0.6, 1.2],
      description:'Small but packed with value.'
    },
    {
      id:'mango', name:'Mango', icon:'🥭',
      rarity:'epic', growTime:1200, baseValue:250,
      buyPrice:500, color:0xff8f00,
      sizeRange:[1.0, 1.8],
      description:'Tropical treasure. Takes patience.'
    },
    {
      id:'dragonfruit', name:'Dragon Fruit', icon:'🐉',
      rarity:'epic', growTime:1800, baseValue:420,
      buyPrice:800, color:0xe91e63,
      sizeRange:[1.0, 1.6],
      description:'Exotic and vibrant. Worth the wait.'
    },
    {
      id:'golden_apple', name:'Golden Apple', icon:'🍎',
      rarity:'legendary', growTime:5400, baseValue:1200,
      buyPrice:2500, color:0xffd700,
      sizeRange:[1.0, 1.5],
      description:'A legendary fruit. Unimaginable value.'
    }
  ];

  // ── GEAR ──────────────────────────────────────────────────
  const GEAR = [
    {
      id:'watering_can', name:'Watering Can', icon:'🪣',
      desc:'Speeds growth ×2 for 60 seconds',
      price:80, type:'tool', stackable: true,
      effect:{ type:'speed', mult:2, duration:60 }
    },
    {
      id:'golden_can', name:'Golden Watering Can', icon:'✨',
      desc:'Speeds growth ×4 for 60 seconds',
      price:350, type:'tool', stackable: true,
      effect:{ type:'speed', mult:4, duration:60 }
    },
    {
      id:'sprinkler_a', name:'Basic Sprinkler', icon:'💧',
      desc:'Fruit grows 25% bigger while active',
      price:280, type:'sprinkler', stackable: false,
      effect:{ type:'size', mult:1.25 }
    },
    {
      id:'sprinkler_b', name:'Premium Sprinkler', icon:'🌊',
      desc:'Fruit grows 60% bigger while active',
      price:650, type:'sprinkler', stackable: false,
      effect:{ type:'size', mult:1.6 }
    }
  ];

  // ── MUTATIONS ─────────────────────────────────────────────
  const MUTATIONS = [
    { id:'rainbow',   name:'Rainbow',   icon:'🌈', valueMult:2.0,  colorTint:0xffffff, description:'Prismatic fruit, sells for 2× value' },
    { id:'golden',    name:'Golden',    icon:'✨',  valueMult:3.0,  colorTint:0xffd700, description:'Gold-touched fruit, sells for 3× value' },
    { id:'giant',     name:'Giant',     icon:'🏔️', valueMult:2.5,  scaleMult:1.8,      description:'Enormous fruit, sells for 2.5× value' },
    { id:'midnight',  name:'Midnight',  icon:'🌙',  valueMult:1.8,  colorTint:0x311b92, description:'Dark fruit, sells for 1.8× value' },
    { id:'fiery',     name:'Fiery',     icon:'🔥',  valueMult:2.2,  colorTint:0xff3d00, description:'Blazing fruit, sells for 2.2× value' },
    { id:'frosty',    name:'Frosty',    icon:'❄️',  valueMult:1.9,  colorTint:0x80d8ff, description:'Ice-kissed fruit, sells for 1.9× value' },
    { id:'cosmic',    name:'Cosmic',    icon:'🌌',  valueMult:4.0,  colorTint:0x1a237e, description:'Otherworldly fruit, sells for 4× value' },
    { id:'chocolate', name:'Chocolate', icon:'🍫',  valueMult:1.6,  colorTint:0x3e2723, description:'Sweet brown fruit, sells for 1.6× value' },
  ];

  // ── PET EGGS ──────────────────────────────────────────────
  const PET_EGGS = [
    {
      id:'common_egg', name:'Common Egg', icon:'🥚',
      price:120, rarityBorder:'#9e9e9e',
      description:'A humble egg. Who could be inside?',
      pets:[
        { id:'bunny',   name:'Bunny',   icon:'🐰', rarity:'common',    chance:35, ability:'Finds carrots faster' },
        { id:'chick',   name:'Chick',   icon:'🐤', rarity:'common',    chance:30, ability:'Boosts seed germination' },
        { id:'turtle',  name:'Turtle',  icon:'🐢', rarity:'uncommon',  chance:18, ability:'Protects plants from withering' },
        { id:'fox',     name:'Fox',     icon:'🦊', rarity:'rare',      chance:11, ability:'Sniffs out rare mutations' },
        { id:'owl',     name:'Owl',     icon:'🦉', rarity:'epic',      chance:5,  ability:'Doubles gem earn rate' },
        { id:'unicorn', name:'Unicorn', icon:'🦄', rarity:'legendary', chance:1,  ability:'Chance to duplicate harvest' }
      ]
    },
    {
      id:'rare_egg', name:'Rare Egg', icon:'🍳',
      price:600, rarityBorder:'#42a5f5',
      description:'Vibrating with energy. Something special awaits.',
      pets:[
        { id:'cat',    name:'Cat',    icon:'🐱', rarity:'common',    chance:30, ability:'Randomly waters nearby plants' },
        { id:'dog',    name:'Dog',    icon:'🐶', rarity:'common',    chance:28, ability:'Fetches fallen fruit' },
        { id:'panda',  name:'Panda',  icon:'🐼', rarity:'uncommon',  chance:22, ability:'Boosts bamboo-type growth' },
        { id:'tiger',  name:'Tiger',  icon:'🐯', rarity:'rare',      chance:13, ability:'Scares away withering' },
        { id:'dragon', name:'Dragon', icon:'🐲', rarity:'epic',      chance:6,  ability:'Applies fiery mutation boost' },
        { id:'phoenix',name:'Phoenix',icon:'🔥', rarity:'legendary', chance:1,  ability:'Revives harvested plants instantly' }
      ]
    },
    {
      id:'legendary_egg', name:'Legendary Egg', icon:'✨',
      price:2500, rarityBorder:'#ffa726',
      description:'Radiates mythical energy. Incredible rarity inside.',
      pets:[
        { id:'bee',      name:'Bee',      icon:'🐝', rarity:'uncommon',  chance:28, ability:'Pollinates all nearby plants' },
        { id:'dolphin',  name:'Dolphin',  icon:'🐬', rarity:'uncommon',  chance:24, ability:'Fills watering can passively' },
        { id:'wolf',     name:'Wolf',     icon:'🐺', rarity:'rare',      chance:20, ability:'Howls to speed growth at night' },
        { id:'elephant', name:'Elephant', icon:'🐘', rarity:'epic',      chance:15, ability:'Massive size boosts to fruit' },
        { id:'spirit',   name:'Spirit',   icon:'👻', rarity:'epic',      chance:12, ability:'Phases through garden enhancing all' },
        { id:'cosmic',   name:'Cosmic',   icon:'🌌', rarity:'legendary', chance:1,  ability:'Applies cosmic mutation to all fruit' }
      ]
    }
  ];

  // ── EVENTS ────────────────────────────────────────────────
  const EVENTS = [
    {
      id:'rainbow_rain', name:'Rainbow Rain',
      icon:'🌈', mutation:'rainbow',
      description:'All fruit has a chance to get Rainbow mutation (+2× value)',
      mutationChance: 0.35, duration: 180
    },
    {
      id:'golden_hour', name:'Golden Hour',
      icon:'✨', mutation:'golden',
      description:'All fruit has a chance to get Golden mutation (+3× value)',
      mutationChance: 0.2, duration: 120
    },
    {
      id:'midnight_bloom', name:'Midnight Bloom',
      icon:'🌙', mutation:'midnight',
      description:'All fruit has a chance to get Midnight mutation (+1.8× value)',
      mutationChance: 0.4, duration: 200
    },
    {
      id:'fire_festival', name:'Fire Festival',
      icon:'🔥', mutation:'fiery',
      description:'All fruit has a chance to get Fiery mutation (+2.2× value)',
      mutationChance: 0.3, duration: 150
    },
    {
      id:'frost_wave', name:'Frost Wave',
      icon:'❄️', mutation:'frosty',
      description:'All fruit has a chance to get Frosty mutation (+1.9× value)',
      mutationChance: 0.35, duration: 160
    },
    {
      id:'cosmic_storm', name:'Cosmic Storm',
      icon:'🌌', mutation:'cosmic',
      description:'Rare cosmic mutation infects all ripening fruit (+4× value)',
      mutationChance: 0.1, duration: 90
    }
  ];

  // ── GEM SHOP ITEMS ────────────────────────────────────────
  const GEM_ITEMS = [
    {
      id:'gem_seed_pack_basic', name:'Basic Seed Pack', icon:'🎁',
      gemPrice:5, type:'seed_pack',
      description:'Contains 1-3 random seeds (Common–Uncommon)',
      pool:['carrot','tomato','strawberry','watermelon','pumpkin']
    },
    {
      id:'gem_seed_pack_rare', name:'Rare Seed Pack', icon:'💎',
      gemPrice:20, type:'seed_pack',
      description:'Contains 1-3 random seeds (Rare–Epic)',
      pool:['sunflower','blueberry','mango','dragonfruit']
    },
    {
      id:'gem_exclusive_egg', name:'Crystal Egg', icon:'🔮',
      gemPrice:50, type:'pet_egg',
      description:'Exclusive gem-only egg. Legendary chance: 3%!',
      pets:[
        { id:'crystal_bunny', name:'Crystal Bunny', icon:'🐰', rarity:'rare',      chance:40, ability:'Crystallizes fruit for +1.5× value' },
        { id:'neon_fox',      name:'Neon Fox',      icon:'🦊', rarity:'rare',      chance:30, ability:'Highlights all hidden mutations' },
        { id:'void_owl',      name:'Void Owl',      icon:'🦉', rarity:'epic',      chance:17, ability:'Triples gem earn rate' },
        { id:'starlight_wolf',name:'Starlight Wolf',icon:'🐺', rarity:'epic',      chance:10, ability:'Speeds night-time growth 3×' },
        { id:'rainbow_dragon',name:'Rainbow Dragon',icon:'🐲', rarity:'legendary', chance:3,  ability:'Applies rainbow mutation permanently' }
      ]
    },
    {
      id:'gem_watering_can_x3', name:'Watering Can ×3', icon:'🪣',
      gemPrice:8, type:'item_bundle',
      description:'Three watering cans at a gem discount!',
      gives:[{ id:'watering_can', count:3 }]
    }
  ];

  // ── LOAD ADMIN-ADDED CONTENT FROM FIREBASE ───────────────
  // Called once at boot. Merges any admin-created seeds/gear/eggs
  // into the live arrays so all shops see them immediately.
  async function loadAdminContent() {
    try {
      const snap = await DB.get(DB.ref('gag/admin_content'));
      if (!snap.exists()) return;
      const data = snap.val();

      // Seeds
      if (data.seeds) {
        Object.values(data.seeds).forEach(seed => {
          if (!SEEDS.find(s => s.id === seed.id)) SEEDS.push(seed);
        });
      }
      // Gear
      if (data.gear) {
        Object.values(data.gear).forEach(gear => {
          if (!GEAR.find(g => g.id === gear.id)) GEAR.push(gear);
        });
      }
      // Eggs
      if (data.eggs) {
        Object.values(data.eggs).forEach(egg => {
          if (!PET_EGGS.find(e => e.id === egg.id)) PET_EGGS.push(egg);
        });
      }
    } catch(e) {
      console.warn('Could not load admin content:', e);
    }
  }

  return {
    SEEDS, GEAR, MUTATIONS, PET_EGGS, EVENTS, GEM_ITEMS,
    RARITY_COLORS,
    loadAdminContent,
    getSeedById:     (id) => SEEDS.find(s => s.id === id),
    getGearById:     (id) => GEAR.find(g => g.id === id),
    getMutationById: (id) => MUTATIONS.find(m => m.id === id),
    getEggById:      (id) => PET_EGGS.find(e => e.id === id),
    getGemItemById:  (id) => GEM_ITEMS.find(i => i.id === id),
    getEventById:    (id) => EVENTS.find(e => e.id === id),
    rarityColor:     (r)  => RARITY_COLORS[r] || '#fff',
  };
})();