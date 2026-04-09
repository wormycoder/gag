// garden.js  –  Grow-a-Garden
// Planting, growth stages, harvesting with E / hold-E, mutations.

window.Garden = (() => {

  // ── PLANT DATA ────────────────────────────────────────────
  // Keyed by plantId (string). Stored in Player.state.garden.
  // Each plant: { id, seedId, plantedAt, size, mutations[], done }

  const plants3D = {}; // plantId -> { group, stage, labelMesh }
  const PLANT_SPACING = 2.4;

  // Garden grid: z from -7 to +11, x from -15 to +15
  // Plants are placed freely (not on a fixed grid), size varies.
  // We track bounding circles to prevent overlap.

  let holdingEDown = false;
  let holdEElapsed = 0;
  const HOLD_E_INTERVAL = 0.35; // seconds between auto-harvests

  // ── PLANT A SEED ──────────────────────────────────────────
  function trySeedPlant(worldX, worldZ) {
    const slot = UI.currentSlot;
    const item = Player.state.hotbar[slot];
    if (!item || item.type !== 'seed') {
      UI.showNotif('Select a seed from hotbar first!', 'error');
      return;
    }

    // Check within garden bounds
    if (worldX < -15 || worldX > 15 || worldZ < -7 || worldZ > 11) {
      UI.showNotif('Plant inside the garden!', 'error');
      return;
    }

    // Check overlap with existing plants
    const seedData = DATA.getSeedById(item.id);
    if (!seedData) return;

    const baseRadius = getSeedRadius(seedData);
    for (const [pid, pd] of Object.entries(Player.state.garden)) {
      const dx = worldX - pd.x;
      const dz = worldZ - pd.z;
      const minDist = baseRadius + getSeedRadius(DATA.getSeedById(pd.seedId) || {}) + 0.3;
      if (Math.sqrt(dx*dx + dz*dz) < minDist) {
        UI.showNotif('Too close to another plant!', 'error');
        return;
      }
    }

    // Random size within range
    const [smin, smax] = seedData.sizeRange || [0.8, 1.4];
    const size = smin + Math.random() * (smax - smin);

    const plantId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const plant = {
      id:       plantId,
      seedId:   item.id,
      x:        worldX,
      z:        worldZ,
      size:     size,
      plantedAt:Date.now(),
      mutations: [],
      done:     false,
      harvested: false,
    };

    Player.state.garden[plantId] = plant;
    Player.removeFromHotbar(slot, 1);
    spawnPlant3D(plantId, plant);
    Player.save();
    UI.showNotif(`${item.icon} Planted ${item.name}!`, 'success');
  }

  // ── SPAWN 3D PLANT ────────────────────────────────────────
  function spawnPlant3D(plantId, plant) {
    if (plants3D[plantId]) return; // already spawned

    const seedData = DATA.getSeedById(plant.seedId);
    if (!seedData) return;

    const group = new THREE.Group();
    group.position.set(plant.x, 0, plant.z);
    group.userData = { plantId, clickable: true };

    // We build stage 0 geometry immediately; tick() will upgrade
    const stage = getGrowthStage(plant);
    buildPlantGeometry(group, seedData, stage, plant.size, plant.mutations);

    World.scene.add(group);
    plants3D[plantId] = { group, stage, seedData };
  }

  // ── PLANT GEOMETRY ────────────────────────────────────────
  // Shared material cache — keyed by hex color string, avoids creating new
  // MeshLambertMaterial instances on every geometry rebuild.
  const _matCache = new Map();
  function getMat(color) {
    const key = color.toString(16);
    if (!_matCache.has(key)) _matCache.set(key, new THREE.MeshLambertMaterial({ color }));
    return _matCache.get(key);
  }

  // Dispose all geometries (and non-cached materials) in a group before clearing it
  function disposeGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      // Only dispose materials that aren't in the shared cache
      if (child.material && !_matCache.has(child.material.color?.getHex?.().toString(16))) {
        child.material.dispose();
      }
      group.remove(child);
    }
  }

  function buildPlantGeometry(group, seedData, stage, size, mutations) {
    // Dispose old meshes properly to prevent GPU memory leak
    disposeGroup(group);

    const col  = getMutationColor(seedData.color, mutations);
    const mat  = getMat(col);
    const stm  = getMat(0x558b2f);
    const s    = size * (0.25 + stage * 0.25); // scale by stage 0-3

    if (stage === 0) {
      // Seedling: tiny mound
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 6, 4), stm);
      seed.position.y = 0.08 * s;
      group.add(seed);
    } else if (stage === 1) {
      // Sprout: small stem + leaf
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4 * s), stm);
      stem.position.y = 0.2 * s;
      group.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 5, 4), stm);
      leaf.position.set(0.1, 0.45 * s, 0);
      group.add(leaf);
    } else if (stage === 2) {
      // Half-grown: stem + small fruit bud
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7 * s), stm);
      stem.position.y = 0.35 * s;
      group.add(stem);
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 7, 6), mat);
      bud.position.y = 0.8 * s;
      group.add(bud);
    } else {
      // Fully grown: full fruit on stem
      const stemH = 0.9 * s;
      const stem  = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, stemH), stm);
      stem.position.y = stemH / 2;
      group.add(stem);

      // Fruit shape varies by seed
      let fruitGeo;
      if (seedData.id === 'carrot') {
        fruitGeo = new THREE.ConeGeometry(0.25 * s, 0.7 * s, 6);
      } else if (seedData.id === 'watermelon' || seedData.id === 'pumpkin') {
        fruitGeo = new THREE.SphereGeometry(0.55 * s, 8, 6);
      } else if (seedData.id === 'sunflower') {
        fruitGeo = new THREE.CylinderGeometry(0.35 * s, 0.35 * s, 0.1 * s, 12);
        const petalMat = getMat(0xffd600);
        for (let i = 0; i < 8; i++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 5, 4), petalMat);
          const angle = (i / 8) * Math.PI * 2;
          petal.position.set(Math.cos(angle) * 0.45 * s, stemH + 0.05, Math.sin(angle) * 0.45 * s);
          group.add(petal);
        }
      } else {
        fruitGeo = new THREE.SphereGeometry(0.3 * s, 8, 7);
      }

      const fruit = new THREE.Mesh(fruitGeo, mat);
      fruit.position.y = stemH + 0.3 * s;
      fruit.castShadow = true;
      group.add(fruit);

      // Wiggle if done and not harvested
      fruit.userData.wiggle = true;
    }
  }

  // ── TICK ──────────────────────────────────────────────────
  let _tickAccum = 0;        // accumulator for plant-state checks (runs at 4 Hz, not 60)
  let _wiggleT   = 0;        // separate wiggle timer so animation stays smooth
  const PLANT_CHECK_HZ = 4;  // how many times per second to re-evaluate plant stages

  function tick(dt) {
    const now = Date.now();
    _wiggleT += dt;

    // Hold-E mass harvest (still every frame for responsiveness)
    if (holdingEDown) {
      holdEElapsed += dt;
      if (holdEElapsed >= HOLD_E_INTERVAL) {
        holdEElapsed = 0;
        harvestNearest();
      }
    }

    // Wiggle done plants every frame (cheap, no geometry rebuild)
    const garden = Player.state.garden;
    for (const [plantId, plant] of Object.entries(garden)) {
      if (plant.harvested || !plant.done) continue;
      const p3 = plants3D[plantId];
      if (!p3 || p3.group.children.length === 0) continue;
      const last = p3.group.children[p3.group.children.length - 1];
      if (last.userData.wiggle) {
        last.rotation.z = Math.sin(_wiggleT * 3 + (plant.x || 0)) * 0.12;
      }
    }

    // Plant stage checks throttled to PLANT_CHECK_HZ
    _tickAccum += dt;
    if (_tickAccum < 1 / PLANT_CHECK_HZ) return;
    _tickAccum = 0;

    for (const [plantId, plant] of Object.entries(garden)) {
      if (plant.harvested) continue;

      const seedData = DATA.getSeedById(plant.seedId);
      if (!seedData) continue;

      const speedMult = Player.getSpeedMult();
      const elapsed   = (now - plant.plantedAt) / 1000 * speedMult;
      const progress  = Math.min(elapsed / seedData.growTime, 1.0);
      const newStage  = Math.floor(progress * 4); // 0,1,2,3
      const isDone    = progress >= 1.0;

      if (!plant.done && isDone) {
        plant.done = true;
        applyEventMutations(plant);
      }

      const p3 = plants3D[plantId];
      if (!p3) {
        spawnPlant3D(plantId, plant);
        continue;
      }

      // Only rebuild geometry when stage actually changes
      if (p3.stage !== newStage) {
        p3.stage = newStage;
        buildPlantGeometry(p3.group, seedData, newStage, plant.size, plant.mutations);
      }
    }
  }

  // ── EVENT MUTATIONS ───────────────────────────────────────
  function applyEventMutations(plant) {
    const activeEvents = Events.getActive();
    activeEvents.forEach(ev => {
      if (Math.random() < ev.mutationChance) {
        const mut = DATA.getMutationById(ev.mutation);
        if (mut && !plant.mutations.includes(mut.id)) {
          plant.mutations.push(mut.id);
          const p3 = plants3D[plant.id];
          if (p3) {
            const sd = DATA.getSeedById(plant.seedId);
            buildPlantGeometry(p3.group, sd, 3, plant.size, plant.mutations);
          }
        }
      }
    });
  }

  // ── HARVEST ───────────────────────────────────────────────
  function checkHarvestProximity(camPos) {
    // camPos is actually playerPos from world.js
    let found = false;
    for (const [plantId, plant] of Object.entries(Player.state.garden)) {
      if (!plant.done || plant.harvested) continue;
      const dx = camPos.x - plant.x;
      const dz = camPos.z - plant.z;
      if (dx*dx + dz*dz < World.HARVEST_DIST * World.HARVEST_DIST) {
        found = true;
        break;
      }
    }
    const el = document.getElementById('harvestPrompt');
    if (found) {
      el.textContent = '[E] Harvest  |  [Hold E] Mass harvest';
      el.classList.remove('prompt-hidden');
    } else {
      el.classList.add('prompt-hidden');
    }
  }

  function harvestNearest() {
    const pos = World.playerPos || World.camera?.position;
    if (!pos) return;
    // Sort ready plants by distance to player
    const ready = Object.values(Player.state.garden)
      .filter(p => p.done && !p.harvested)
      .map(p => {
        const dx = pos.x - p.x, dz = pos.z - p.z;
        return { plant: p, dist: dx*dx + dz*dz };
      })
      .filter(o => o.dist < World.HARVEST_DIST * World.HARVEST_DIST * 4)
      .sort((a, b) => a.dist - b.dist);

    if (ready.length === 0) return;
    harvestPlant(ready[0].plant.id);
  }

  function harvestPlant(plantId) {
    const plant = Player.state.garden[plantId];
    if (!plant || !plant.done || plant.harvested) return;

    const seedData = DATA.getSeedById(plant.seedId);
    if (!seedData) return;

    // Calculate value
    let value = seedData.baseValue;
    const sizeMult = Player.getSizeMult() * plant.size;
    value = Math.round(value * sizeMult);

    // Apply mutations
    plant.mutations.forEach(mutId => {
      const mut = DATA.getMutationById(mutId);
      if (mut) value = Math.round(value * mut.valueMult);
    });

    // Build the fruit item stack
    const mutNames = plant.mutations.map(m => DATA.getMutationById(m)?.name).filter(Boolean);
    const mutIcon  = plant.mutations.length > 0
      ? (DATA.getMutationById(plant.mutations[0])?.icon || '') : '';
    const displayName = mutNames.length > 0
      ? mutNames.join('+') + ' ' + seedData.name : seedData.name;

    const fruitItem = Player.makeStack('fruit', seedData.id, seedData.icon + mutIcon, displayName, {
      value,
      seedId:    seedData.id,
      mutations: plant.mutations,
      size:      Math.round(plant.size * 100) / 100,
      rarity:    seedData.rarity,
    });

    Player.addItem(fruitItem);

    // Remove 3D
    const p3 = plants3D[plantId];
    if (p3) {
      World.scene.remove(p3.group);
      delete plants3D[plantId];
    }

    // Mark as harvested and delete
    delete Player.state.garden[plantId];
    Player.save();

    UI.showNotif(`${seedData.icon} Harvested ${displayName}! (⭐ ${value} coins)`, 'success');
  }

  // ── SHOVEL / DELETE ───────────────────────────────────────
  function tryDigPlant(worldX, worldZ) {
    let nearest = null, nearDist = Infinity;
    for (const [pid, plant] of Object.entries(Player.state.garden)) {
      const dx = worldX - plant.x, dz = worldZ - plant.z;
      const d  = dx*dx + dz*dz;
      if (d < nearDist && d < 4) { nearest = pid; nearDist = d; }
    }
    if (!nearest) return;
    const plant    = Player.state.garden[nearest];
    const seedData = DATA.getSeedById(plant.seedId);
    const isRare   = ['rare','epic','legendary'].includes(seedData?.rarity);

    if (isRare) {
      ConfirmDialog.show(
        `⚠️ Remove ${seedData?.icon || '?'} ${seedData?.name}?`,
        `This is a ${seedData?.rarity} plant! Are you sure you want to remove it?`,
        () => removePlant(nearest)
      );
    } else {
      removePlant(nearest);
    }
  }

  function removePlant(plantId) {
    const p3 = plants3D[plantId];
    if (p3) { World.scene.remove(p3.group); delete plants3D[plantId]; }
    delete Player.state.garden[plantId];
    Player.save();
    UI.showNotif('🪣 Plant removed', '');
  }

  // ── HELPERS ───────────────────────────────────────────────
  function getGrowthStage(plant) {
    const seedData = DATA.getSeedById(plant.seedId);
    if (!seedData) return 0;
    const elapsed  = (Date.now() - plant.plantedAt) / 1000;
    const progress = Math.min(elapsed / seedData.growTime, 1.0);
    return Math.floor(progress * 4);
  }

  function getSeedRadius(seedData) {
    if (!seedData) return 0.6;
    const s = (seedData.sizeRange?.[1] || 1.4);
    return s * 0.5;
  }

  function getMutationColor(baseColor, mutations) {
    if (!mutations || mutations.length === 0) return baseColor;
    const firstMut = DATA.getMutationById(mutations[0]);
    if (firstMut?.colorTint) return firstMut.colorTint;
    return baseColor;
  }

  // ── RAYCAST CLICK (left click in world) ───────────────────
  function onWorldClick(event) {
    if (window._anyModalOpen?.()) return;
    if (event.button !== 0) return;

    const slot = UI.currentSlot;
    const item = Player.state.hotbar[slot];
    if (!item) return;

    // Raycast against ground plane using the camera
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, World.camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target      = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, target)) return;

    if (item.type === 'seed') {
      trySeedPlant(target.x, target.z);
    } else if (item.type === 'tool' && item.id === 'shovel') {
      tryDigPlant(target.x, target.z);
    } else if (item.type === 'tool' && (item.id === 'watering_can' || item.id === 'golden_can')) {
      useWateringCan(slot, item);
    } else if (item.type === 'tool' && item.id.startsWith('sprinkler')) {
      useSprinkler(slot, item);
    } else if (item.type === 'fruit') {
      UI.showNotif('Open the Sell Shop to sell fruit', '');
    }
  }

  function useWateringCan(slot, item) {
    Player.applyWateringCan(item);
    Player.removeFromHotbar(slot, 1);
    Player.save();
  }

  function useSprinkler(slot, item) {
    Player.applySprinkler(item);
    Player.removeFromHotbar(slot, 1);
    Player.save();
  }

  // ── HOLD E ────────────────────────────────────────────────
  function setHoldE(down) {
    holdingEDown = down;
    if (!down) holdEElapsed = 0;
    else {
      // Single E press also triggers one harvest immediately
      harvestNearest();
    }
  }

  // Load existing plants from saved state
  function loadExisting() {
    const garden = Player.state.garden;
    const entries = Object.entries(garden);
    if (entries.length === 0) return;
    let i = 0;
    function spawnNext() {
      if (i < entries.length) {
        const [plantId, plant] = entries[i++];
        spawnPlant3D(plantId, plant);
        setTimeout(spawnNext, 0);
      }
    }
    spawnNext();
  }

  // ── SELL ALL FRUIT ────────────────────────────────────────
  function sellFruit(mode, specificSlot = null) {
    let totalCoins = 0;

    if (mode === 'held') {
      const slot = specificSlot !== null ? specificSlot : UI.currentSlot;
      const item = Player.state.hotbar[slot];
      if (!item || item.type !== 'fruit') {
        UI.showNotif('Hold a fruit in your active slot!', 'error'); return;
      }
      totalCoins = item.value * (item.count || 1);
      Player.removeFromHotbar(slot, item.count || 1);
      UI.showNotif(`💰 Sold ${item.icon} for ${totalCoins} coins!`, 'success');
    } else if (mode === 'all') {
      // Hotbar fruit
      Player.state.hotbar = Player.state.hotbar.map(s => {
        if (s && s.type === 'fruit') { totalCoins += s.value * (s.count || 1); return null; }
        return s;
      });
      // Backpack fruit
      Player.state.backpack = Player.state.backpack.filter(s => {
        if (s.type === 'fruit') { totalCoins += s.value * (s.count || 1); return false; }
        return true;
      });
      if (totalCoins === 0) { UI.showNotif('No fruit to sell!', 'error'); return; }
      UI.showNotif(`💰 Sold all fruit for ${totalCoins} coins!`, 'success');
    }

    Player.addCoins(totalCoins);
    UI.renderHotbar();
    Player.save();
  }

  function checkHeldFruitPrice() {
    const item = Player.state.hotbar[UI.currentSlot];
    if (!item || item.type !== 'fruit') {
      UI.showNotif('Hold a fruit to check its price', 'error'); return;
    }
    const mutNames = (item.mutations || []).map(m => DATA.getMutationById(m)?.name).filter(Boolean).join(', ');
    UI.showNotif(`${item.icon} ${item.name} = ${item.value} coins each${mutNames ? ' (' + mutNames + ')' : ''}`, 'success');
  }

  return {
    tick,
    loadExisting,
    checkHarvestProximity,
    onWorldClick,
    setHoldE,
    harvestNearest,
    harvestPlant,
    sellFruit,
    checkHeldFruitPrice,
  };
})();