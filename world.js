// world.js  –  Grow-a-Garden
// Three.js world: terrain, shacks with floating name labels, 1st/3rd person,
// RMB look (cursor stays visible & frozen), scroll zoom, spherical 3rd-person camera.

window.World = (() => {

  let scene, camera, renderer, clock;

  // Player body position (separate from camera in 3rd person)
  const playerPos = new THREE.Vector3(0, 0, 18);
  let camYaw   = 0;
  let camPitch = 0;
  let velY     = 0;
  let grounded = true;

  // ── ZOOM / PERSPECTIVE ────────────────────────────────────
  // zoomDist: 0 = first person, >0 = third person distance behind player
  const ZOOM_MIN  = 0;    // first person
  const ZOOM_MAX  = 9;    // max pull-back
  const ZOOM_STEP = 1.2;  // per scroll tick
  let   zoomDist  = 5;    // start in third person

  // Smooth zoom lerp target
  let zoomTarget  = 5;

  const WORLD    = 60;
  const EYE_H    = 1.75;
  const GRAVITY  = -22;
  const JUMP_V   = 8;
  const MOVE_SPD = 7;

  const keys = {};
  let rmb = false;

  // Frozen cursor position (set when RMB goes down)
  let frozenX = 0, frozenY = 0;

  let nearShack = null;
  const INTERACT_DIST = 5.5;
  const HARVEST_DIST  = 3.8;

  let playerGroup  = null;
  let viewModel    = null;

  // Smooth body yaw (so character doesn't snap)
  let bodyYaw = 0;
  let _proxAccum = 0;

  // ── SHACK DEFS ────────────────────────────────────────────
  const SHACK_DEFS = [
    { id:'sell',     name:'Sell Shop',        hexColor:0xffd700, x:-18, npc:'sell',
      npcQuote:'"I pay top coin for your finest crops!"',     shirtColor:0xf9a825 },
    { id:'seed',     name:'Seed Shop',        hexColor:0x4caf50, x: -8, npc:'seed',
      npcQuote:'"Fresh seeds every day, just for you!"',      shirtColor:0x1b5e20 },
    { id:'gear',     name:'Gear Shop',        hexColor:0xff9800, x:  2, npc:'gear',
      npcQuote:'"The finest tools coins can buy!"',           shirtColor:0xe65100 },
    { id:'pet',      name:'Pet Shop',         hexColor:0xe91e63, x: 12, npc:'pet',
      npcQuote:'"Every egg is a new best friend!"',           shirtColor:0x880e4f },
    { id:'mutation', name:'Mutation Machine', hexColor:0x9c27b0, x: 22, npc:'mutation',
      npcQuote:'"Feed your pet to the machine... stronger!"', shirtColor:0x4a148c },
  ];

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    const canvas = document.getElementById('gameCanvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog        = new THREE.FogExp2(0x8ec8f0, 0.010);

    camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference:'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;

    clock = new THREE.Clock();

    // Start render loop immediately so browser doesn't think page is frozen
    animate();

    // Build scene in chunks across multiple frames to avoid blocking the main thread
    const steps = [
      ['buildTerrain',     buildTerrain],
      ['buildLighting',    buildLighting],
      ['buildShacks',      buildShacks],
      ['buildTrees',       buildTrees],
      ['buildFlowers',     buildFlowers],
      ['buildClouds',      buildClouds],
      ['buildPathAndFence',buildPathAndFence],
      ['buildPlayerBody',  buildPlayerBody],
      ['buildViewModel',   buildViewModel],
      ['setupControls',    () => setupControls(canvas)],
    ];
    let i = 0;
    function runNext() {
      if (i < steps.length) {
        const [name, fn] = steps[i++];
        const t0 = performance.now();
        fn();
        const ms = (performance.now() - t0).toFixed(1);
        console.log(`[World] ${name}: ${ms}ms`);
        setTimeout(runNext, 0);
      } else {
        console.log('[World] init complete');
      }
    }
    runNext();

    window.addEventListener('resize', onResize);
  }

  // ── TERRAIN ───────────────────────────────────────────────
  function buildTerrain() {
    const gGeo = new THREE.PlaneGeometry(WORLD*2, WORLD*2, 40, 40);
    const gp   = gGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getY(i);
      const dist = Math.sqrt(x*x + z*z) / WORLD;
      gp.setZ(i, (Math.random()-0.5)*0.06 + dist*0.35);
    }
    gGeo.computeVertexNormals();
    addMesh(new THREE.PlaneGeometry(WORLD*2, WORLD*2, 40, 40), 0x5aaa33,
      m => { m.rotation.x = -Math.PI/2; });
    scene.children[scene.children.length-1].geometry = gGeo;

    addMesh(new THREE.PlaneGeometry(36, 24), 0x7a5230,
      m => { m.rotation.x=-Math.PI/2; m.position.set(0,0.005,2); });

    for (let r = -4; r <= 4; r++) {
      addMesh(new THREE.PlaneGeometry(34, 0.4), 0x5d3e28,
        m => { m.rotation.x=-Math.PI/2; m.position.set(0,0.012,r*2.6+2); });
    }

    addMesh(new THREE.PlaneGeometry(WORLD*2-2, 6), 0xc0b8aa,
      m => { m.rotation.x=-Math.PI/2; m.position.set(0,0.007,-12.5); });

    addMesh(new THREE.PlaneGeometry(WORLD*2-2, 16), 0x9e9e9e,
      m => { m.rotation.x=-Math.PI/2; m.position.set(0,0.006,-24); });

    const plankMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    [
      [36.5,0.22, 0,   0.12,-11.95],
      [36.5,0.22, 0,   0.12, 14.05],
      [0.22,24.2,-18,  0.12,  1.05],
      [0.22,24.2, 18,  0.12,  1.05],
    ].forEach(([w,d,x,y,z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w,0.25,d), plankMat);
      b.position.set(x,y,z);
      scene.add(b);
    });
  }

  function addMesh(geo, color, fn) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    if (fn) fn(m);
    scene.add(m);
    return m;
  }

  // ── LIGHTING ──────────────────────────────────────────────
  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xfff0d0, 0.55));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.38));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.15);
    sun.position.set(30, 60, 25);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left   = -55;
    sun.shadow.camera.right  =  55;
    sun.shadow.camera.top    =  55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near   = 0.5;
    sun.shadow.camera.far    = 150;
    sun.shadow.bias          = -0.0003;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.22);
    fill.position.set(-30,15,-20);
    scene.add(fill);
  }

  // ── HELPER: darken a hex colour ───────────────────────────
  function darken(hex, f) {
    return ( Math.round(((hex>>16)&0xff)*f)<<16 |
             Math.round(((hex>>8 )&0xff)*f)<<8  |
             Math.round(( hex     &0xff)*f) );
  }

  // ── SHACKS ────────────────────────────────────────────────
  function buildShacks() {
    SHACK_DEFS.forEach(def => {
      const g  = new THREE.Group();
      g.userData = { shack: def };
      g.position.set(def.x, 0, -22);

      const c   = def.hexColor;
      const dk  = darken(c, 0.50);
      const dkk = darken(c, 0.38);
      const m   = col => new THREE.MeshLambertMaterial({ color: col });

      bx(g, 4.5,1.1,2.4, dk,   [0,0.55,0]);
      bx(g, 4.7,0.12,2.6, c,   [0,1.15,0]);
      bx(g, 4.5,0.4,0.08, dkk, [0,0.85,1.25]);
      bx(g, 4.5,3.2,0.22, dkk, [0,2.2,-1.1]);
      bx(g, 0.22,3.2,2.4, dkk, [-2.35,2.2,0]);
      bx(g, 0.22,3.2,2.4, dkk, [ 2.35,2.2,0]);
      bx(g, 5.0,0.14,2.8, darken(c,0.38), [0,3.65,-0.1]);

      const roofG = new THREE.CylinderGeometry(0.05, 3.4, 2.0, 4);
      const roof  = new THREE.Mesh(roofG, m(darken(c,0.40)));
      roof.position.set(0,4.6,-0.3); roof.rotation.y=Math.PI/4;
      g.add(roof);

      bx(g, 3.8,0.95,0.08, dkk,    [0,2.05,1.21]);
      bx(g, 3.6,0.75,0.12, 0xfff8e1,[0,2.05,1.26]);

      [-1.5, 0, 1.5].forEach(bx_ => {
        bx(g, 0.9,0.55,0.05, c, [bx_,3.4,1.0]);
        const penn = new THREE.Mesh(new THREE.ConeGeometry(0.32,0.44,3), m(c));
        penn.position.set(bx_,2.9,1.0); penn.rotation.z=Math.PI; g.add(penn);
      });

      bx(g, 0.72,0.95,0.46, def.shirtColor||dk, [0,1.88,0.38]);
      def.npcHead = bx(g, 0.58,0.58,0.58, 0xffcc9a, [0,2.67,0.38]);
      bx(g, 0.60,0.18,0.60, 0x5d3e28, [0,2.99,0.38]);
      bx(g, 0.09,0.09,0.06, 0x111111, [-0.13,2.67,0.68]);
      bx(g, 0.09,0.09,0.06, 0x111111, [ 0.13,2.67,0.68]);
      bx(g, 0.18,0.05,0.05, 0x8d4d2a, [0,2.53,0.68]);
      bx(g, 0.22,0.80,0.24, def.shirtColor||dk, [-0.44,1.48,0.38]);
      bx(g, 0.22,0.80,0.24, def.shirtColor||dk, [ 0.44,1.48,0.38]);
      bx(g, 0.22,0.24,0.24, 0xffcc9a, [-0.44,1.06,0.6]);
      bx(g, 0.22,0.24,0.24, 0xffcc9a, [ 0.44,1.06,0.6]);

      const hbr = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.09,10), m(darken(c,0.38)));
      hbr.position.set(0,2.97,0.38); g.add(hbr);
      const htp = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.50,10), m(darken(c,0.38)));
      htp.position.set(0,3.23,0.38); g.add(htp);
      const hbd = new THREE.Mesh(new THREE.CylinderGeometry(0.285,0.285,0.13,10), m(c));
      hbd.position.set(0,2.97,0.38); g.add(hbd);

      const tex   = makeTextTexture(def.name);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 0.85),
        new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false })
      );
      plane.position.set(0,6.3,0);
      plane.userData.billboard = true;
      g.add(plane);
      def.billboardPlane = plane;

      scene.add(g);
      def.group = g;
    });
  }

  // ── BOX HELPER ────────────────────────────────────────────
  function bx(parent, w,h,d, color, pos) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w,h,d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(...pos);
    parent.add(m);
    return m;
  }

  // ── CANVAS TEXT TEXTURE ───────────────────────────────────
  // Uses a safe fallback font first, then updates texture once
  // 'Press Start 2P' is confirmed loaded — avoids font-load freeze.
  function makeTextTexture(text) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');

    function draw(font) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(10,5,0,0.78)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(6, 6, 500, 116, 14);
      else ctx.rect(6, 6, 500, 116);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.75)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 6;
      ctx.strokeText(text, 256, 64);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(text, 256, 64);
    }

    // Draw immediately with a safe system font (no freeze)
    draw('bold 28px monospace');
    const tex = new THREE.CanvasTexture(cv);

    // Once the custom font loads, redraw and update texture (non-blocking)
    if (document.fonts && document.fonts.load) {
      document.fonts.load('bold 28px "Press Start 2P"').then(() => {
        draw('bold 28px "Press Start 2P", monospace');
        tex.needsUpdate = true;
      }).catch(() => {});
    }

    return tex;
  }

  // ── TREES ─────────────────────────────────────────────────
  const _MAT = {
    trunk:   new THREE.MeshLambertMaterial({ color: 0x5d3e28 }),
    leaf0:   new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
    leaf1:   new THREE.MeshLambertMaterial({ color: 0x388e3c }),
    leaf2:   new THREE.MeshLambertMaterial({ color: 0x43a047 }),
    stem:    new THREE.MeshLambertMaterial({ color: 0x66bb6a }),
    flowerY: new THREE.MeshLambertMaterial({ color: 0xfdd835 }),
  };
  const _LEAF_MATS = [_MAT.leaf0, _MAT.leaf1, _MAT.leaf2];

  function buildTrees() {
    [[-26,-26],[26,-26],[-26,26],[26,26],[-26,0],[26,0]]
    .forEach(([x,z]) => {
      const h = 3.5 + Math.random()*1.5;
      const trk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h, 6), _MAT.trunk);
      trk.position.set(x, h/2, z);
      scene.add(trk);
      for (let c = 0; c < 2; c++) {
        const r  = 2.0 + Math.random()*0.8;
        const ox = (Math.random()-0.5)*1.0, oz = (Math.random()-0.5)*1.0;
        const lf = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), _LEAF_MATS[c % 3]);
        lf.position.set(x+ox, h+1.5+c*0.7, z+oz);
        scene.add(lf);
      }
    });
  }

  // ── FLOWERS ───────────────────────────────────────────────
  function buildFlowers() {
    const flowerMats = [0xff4081,0xffeb3b,0xff9800,0xe040fb,0x69f0ae,0xff5722,0x00e5ff,0xf48fb1]
      .map(c => new THREE.MeshLambertMaterial({ color: c }));
    const stemGeo   = new THREE.CylinderGeometry(0.025, 0.03, 0.35, 4);
    const petalGeo  = new THREE.SphereGeometry(0.12, 5, 4);
    const centreGeo = new THREE.SphereGeometry(0.055, 4, 3);

    for (let i = 0; i < 16; i++) {
      let fx, fz;
      do { fx=(Math.random()-0.5)*WORLD*1.6; fz=(Math.random()-0.5)*WORLD*1.6; }
      while (Math.abs(fx)<20 && Math.abs(fz-2)<14);

      const stem = new THREE.Mesh(stemGeo, _MAT.stem);
      stem.position.set(fx, 0.17, fz);
      scene.add(stem);

      const petal = new THREE.Mesh(petalGeo, flowerMats[i % flowerMats.length]);
      petal.position.set(fx, 0.40, fz);
      scene.add(petal);

      const centre = new THREE.Mesh(centreGeo, _MAT.flowerY);
      centre.position.set(fx, 0.42, fz);
      scene.add(centre);
    }
  }

  // ── CLOUDS ────────────────────────────────────────────────
  const clouds = [];
  function buildClouds() {
    for (let i=0;i<14;i++) {
      const g = new THREE.Group();
      const n = 3+Math.floor(Math.random()*4);
      for (let p=0;p<n;p++) {
        const r = 1.8+Math.random()*1.5;
        const pf = new THREE.Mesh(
          new THREE.SphereGeometry(r,7,5),
          new THREE.MeshLambertMaterial({ color:0xffffff })
        );
        pf.position.set((p-n/2)*(r*1.1), Math.random()*0.8, 0);
        g.add(pf);
      }
      g.position.set((Math.random()-0.5)*WORLD*2, 20+Math.random()*10, (Math.random()-0.5)*WORLD*2);
      g.userData.speed = 0.25+Math.random()*0.55;
      scene.add(g); clouds.push(g);
    }
  }

  // ── PATH & FENCE ──────────────────────────────────────────
  function buildPathAndFence() {
    const fMat = new THREE.MeshLambertMaterial({ color: 0x6d4c41 });
    const pMat = new THREE.MeshLambertMaterial({ color: 0x5d3e28 });
    const half = WORLD - 0.5;

    [[0,0,-half,[0,0,0]],[0,0,half,[0,0,0]],[-half,0,0,[0,Math.PI/2,0]],[half,0,0,[0,Math.PI/2,0]]]
    .forEach(([x,y,z,rot]) => {
      [0.7, 0.35].forEach(ry => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(WORLD*2, 0.14, 0.22), fMat);
        rail.position.set(x, ry, z); rail.rotation.set(...rot); scene.add(rail);
      });
    });

    const postGeo = new THREE.BoxGeometry(0.22, 1.0, 0.22);
    for (let i = -WORLD; i <= WORLD; i += 8) {
      [[i,-half],[i,half],[-half,i],[half,i]].forEach(([x,z]) => {
        const post = new THREE.Mesh(postGeo, pMat);
        post.position.set(x, 0.5, z);
        scene.add(post);
      });
    }
  }

  // ── PLAYER BODY ───────────────────────────────────────────
  function buildPlayerBody() {
    playerGroup = new THREE.Group();

    const sk  = c => new THREE.MeshLambertMaterial({ color:c });
    const mkB = (w,h,d,col,px,py,pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), sk(col));
      m.position.set(px,py,pz);
      playerGroup.add(m);
      return m;
    };

    mkB(0.6, 0.75,0.35, 0x1565c0,  0,1.22,0);   // torso
    mkB(0.52,0.52,0.52, 0xffcc9a,  0,1.82,0);   // head
    mkB(0.54,0.18,0.54, 0x4e342e,  0,2.08,0);   // hair
    mkB(0.08,0.08,0.06, 0x111111, -0.12,1.84,0.27); // L eye
    mkB(0.08,0.08,0.06, 0x111111,  0.12,1.84,0.27); // R eye
    mkB(0.22,0.70,0.22, 0x1565c0, -0.42,1.14,0);  // L arm
    mkB(0.22,0.70,0.22, 0x1565c0,  0.42,1.14,0);  // R arm
    mkB(0.24,0.72,0.26, 0x33691e, -0.17,0.5, 0);  // L leg
    mkB(0.24,0.72,0.26, 0x33691e,  0.17,0.5, 0);  // R leg
    mkB(0.26,0.18,0.38, 0x3e2723, -0.17,0.09,0.06); // L shoe
    mkB(0.26,0.18,0.38, 0x3e2723,  0.17,0.09,0.06); // R shoe

    // ── Held item slot on the player body (visible in 3rd person) ──
    const bodyItemSlot = new THREE.Group();
    bodyItemSlot.name = 'bodyItemSlot';
    // Position in right hand area
    bodyItemSlot.position.set(0.52, 1.0, 0.22);
    playerGroup.add(bodyItemSlot);

    playerGroup.visible = false;
    scene.add(playerGroup);
  }

  // ── VIEW MODEL (1st-person arm) ───────────────────────────
  function buildViewModel() {
    viewModel = new THREE.Group();
    const sk  = new THREE.MeshLambertMaterial({ color:0xffcc9a });
    const sh  = new THREE.MeshLambertMaterial({ color:0x1565c0 });

    const ua = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.40,0.16), sh);
    ua.position.set(0.38,-0.35,-0.5); viewModel.add(ua);
    const la = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.35,0.14), sk);
    la.position.set(0.42,-0.58,-0.46); viewModel.add(la);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14), sk);
    hd.position.set(0.42,-0.73,-0.44); viewModel.add(hd);

    const is_ = new THREE.Group();
    is_.name = 'vmItemSlot';
    is_.position.set(0.38,-0.72,-0.55);
    viewModel.add(is_);

    camera.add(viewModel);
    scene.add(camera);
  }

  // ── BUILD HELD ITEM MESH ──────────────────────────────────
  // Used for both viewmodel (1st person) and body slot (3rd person)
  function buildItemMesh(item) {
    if (!item) return null;
    const lm = col => new THREE.MeshLambertMaterial({ color:col });
    const g = new THREE.Group();

    if (item.id === 'shovel') {
      const hnd = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.7,6), lm(0x8d6e63));
      hnd.position.set(0,0.18,0); hnd.rotation.x=0.3; g.add(hnd);
      const bld = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.22,0.04), lm(0x9e9e9e));
      bld.position.set(0,0.54,-0.02); g.add(bld);
    } else if (item.type === 'seed') {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.16,0.06), lm(0xfff9e6));
      bag.rotation.z=0.25; g.add(bag);
    } else if (item.type === 'fruit') {
      const sd  = DATA?.getSeedById?.(item.seedId);
      const col = sd?.color || 0xff4444;
      const fr  = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), lm(col));
      g.add(fr);
    } else if (item.type === 'tool') {
      const col = item.id==='watering_can'?0x1e88e5 :
                  item.id==='golden_can'  ?0xffd700 : 0x26c6da;
      const can = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.14,0.1), lm(col));
      g.add(can);
      const spt = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.18,6), lm(darken(col,0.7)));
      spt.rotation.z=Math.PI/2.8; spt.position.set(0.1,0.06,0); g.add(spt);
    } else if (item.type === 'egg') {
      const eg = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), lm(0xfff9e6));
      eg.scale.y=1.3; g.add(eg);
    }

    return g;
  }

  // ── UPDATE HELD ITEM ─────────────────────────────────────
  // Cached slot refs + only rebuild when item actually changes
  let _vmSlot    = null;
  let _bodySlot  = null;
  let _lastHeldKey = null;
  function updateHeldItem() {
    // Lazily cache the slot nodes (built after init)
    if (!_vmSlot)   _vmSlot   = camera.getObjectByName('vmItemSlot');
    if (!_bodySlot) _bodySlot = playerGroup?.getObjectByName('bodyItemSlot');

    const slot = window.UI ? UI.currentSlot : 0;
    const item = Player?.state?.hotbar?.[slot];
    const key  = item ? `${slot}:${item.id}:${item.qty}` : `${slot}:null`;
    if (key === _lastHeldKey) return;
    _lastHeldKey = key;

    // 1st-person viewmodel
    if (_vmSlot) {
      while (_vmSlot.children.length) _vmSlot.remove(_vmSlot.children[0]);
      const mesh = buildItemMesh(item);
      if (mesh) _vmSlot.add(mesh);
    }

    // 3rd-person body slot
    if (_bodySlot) {
      while (_bodySlot.children.length) _bodySlot.remove(_bodySlot.children[0]);
      const mesh = buildItemMesh(item);
      if (mesh) {
        mesh.scale.setScalar(1.4);
        _bodySlot.add(mesh);
      }
    }
  }

  // ── CONTROLS ──────────────────────────────────────────────
  function setupControls(canvas) {
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (document.activeElement?.tagName === 'INPUT') return;
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      if (window._anyModalOpen?.()) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (grounded) { velY=JUMP_V; grounded=false; }
      }
      if (e.code === 'KeyB') Backpack.toggle();
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5))-1;
        if (n>=0&&n<9) UI.selectHotbarSlot(n);
      }
      if (e.code==='KeyE') {
        if (nearShack) ShopModal.open(nearShack.userData.shack.npc, nearShack.userData.shack);
      }
    });

    window.addEventListener('keyup', e => { keys[e.code]=false; });

    // ── RMB: camera look — pure delta, NO pointer lock ────
    // requestPointerLock() causes a multi-second browser freeze/prompt.
    // Simple delta tracking: cursor stays visible, camera still turns.
    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        rmb     = true;
        frozenX = e.clientX;
        frozenY = e.clientY;
      }
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 2) { rmb = false; }
    });

    window.addEventListener('mousemove', e => {
      if (!rmb) return;
      const dx = e.clientX - frozenX;
      const dy = e.clientY - frozenY;
      frozenX  = e.clientX;
      frozenY  = e.clientY;
      camYaw   -= dx * 0.0032;
      camPitch -= dy * 0.0032;
      camPitch  = Math.max(-Math.PI * 0.42, Math.min(Math.PI * 0.42, camPitch));
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── SCROLL WHEEL: zoom in/out ──────────────────────────
    canvas.addEventListener('wheel', e => {
      if (window._anyModalOpen?.()) return;
      e.preventDefault();

      // Scroll down = zoom out (increase distance), scroll up = zoom in
      zoomTarget += e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomTarget  = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget));
    }, { passive: false });
  }

  // ── ANIMATION LOOP ────────────────────────────────────────
  let _npcT = 0;
  let _lastFrame = 0;
function animate(now = 0) {
  requestAnimationFrame(animate);
  if (now - _lastFrame < 16) return; // cap at ~60fps
  _lastFrame = now;
    const dt = Math.min(clock.getDelta(), 0.05);

    if (Player?.state?.username && !window._anyModalOpen?.()) {
      updateMovement(dt);
      updateHeldItem();
    }

    // Smooth zoom lerp
    zoomDist += (zoomTarget - zoomDist) * Math.min(dt * 12, 1);

    // Show/hide viewmodel based on zoom
    const isFirstPerson = zoomDist < 0.5;
    if (viewModel)   viewModel.visible   = isFirstPerson;
    if (playerGroup) playerGroup.visible = !isFirstPerson;

    // Billboard shop names always face camera (cached refs)
    SHACK_DEFS.forEach(def => {
      if (def.billboardPlane) def.billboardPlane.lookAt(camera.position);
    });

    // NPC bob (cached head refs)
    _npcT += dt;
    SHACK_DEFS.forEach((def,i) => {
      if (def.npcHead) {
        def.npcHead.position.y = 2.67 + Math.sin(_npcT*1.1+i*0.9)*0.055;
      }
    });

    // Clouds
    clouds.forEach(c => {
      c.position.x += c.userData.speed*dt;
      if (c.position.x > WORLD) c.position.x = -WORLD;
    });

    if (window.Garden) Garden.tick(dt);

    renderer.render(scene, camera);
  }

  // ── MOVEMENT ──────────────────────────────────────────────
  // Pre-allocated vectors — avoids creating garbage every frame
  const _fwd  = new THREE.Vector3();
  const _rgt  = new THREE.Vector3();
  const _move = new THREE.Vector3();
  const _tCam = new THREE.Vector3();
  const _look = new THREE.Vector3();
  let _walkT = 0;
  function updateMovement(dt) {
    const isFirstPerson = zoomDist < 0.5;

    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    _rgt.set( Math.cos(camYaw), 0, -Math.sin(camYaw));
    _move.set(0, 0, 0);
    const fwd = _fwd, rgt = _rgt, move = _move;

    if (keys['KeyW']) move.addScaledVector(fwd, 1);
    if (keys['KeyS']) move.addScaledVector(fwd,-1);
    if (keys['KeyA']) move.addScaledVector(rgt,-1);
    if (keys['KeyD']) move.addScaledVector(rgt, 1);
    const isMoving = move.lengthSq() > 0;
    if (isMoving) move.normalize().multiplyScalar(MOVE_SPD * dt);

    playerPos.add(move);

    // Gravity + jump
    velY += GRAVITY * dt;
    playerPos.y += velY * dt;
    if (playerPos.y <= 0) { playerPos.y = 0; velY = 0; grounded = true; }

    const bound = WORLD - 1;
    playerPos.x = Math.max(-bound, Math.min(bound, playerPos.x));
    playerPos.z = Math.max(-bound, Math.min(bound, playerPos.z));

    // Walking bob accumulator
    if (isMoving && grounded) _walkT += dt * 8;

    // ── Body facing: smoothly rotate toward movement direction ──
    if (!isFirstPerson && isMoving) {
      // Target yaw = direction of movement (based on camera yaw + input)
      const moveYaw = Math.atan2(move.x, move.z);
      // Smooth rotation toward target
      let diff = moveYaw - bodyYaw;
      // Wrap to [-PI, PI]
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bodyYaw += diff * Math.min(dt * 14, 1);
    }

    if (playerGroup) {
      playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
      playerGroup.rotation.y = isFirstPerson ? camYaw + Math.PI : bodyYaw;
    }

    // ── CAMERA POSITIONING ────────────────────────────────
    if (isFirstPerson) {
      // First person
      const bobY = (isMoving && grounded) ? Math.sin(_walkT) * 0.05 : 0;
      camera.position.set(playerPos.x, playerPos.y + EYE_H + bobY, playerPos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = camYaw;
      camera.rotation.x = camPitch;
    } else {
      // ── Spherical 3rd-person camera ──────────────────────
      // camYaw and camPitch give full spherical orbit around player
      // Clamp pitch so camera doesn't go below ground or flip over top
      const pitch = Math.max(-Math.PI * 0.35, Math.min(Math.PI * 0.45, camPitch));

      // Offset from player in spherical coords.
      // Negate pitch so mouse-up raises camera (corrects 3rd-person inversion).
      const p      = -pitch;
      const offsetX =  Math.sin(camYaw) * Math.cos(p) * zoomDist;
      const offsetY =  Math.sin(p)                    * zoomDist + EYE_H;
      const offsetZ =  Math.cos(camYaw) * Math.cos(p) * zoomDist;

      _tCam.set(playerPos.x + offsetX, playerPos.y + offsetY, playerPos.z + offsetZ);
      camera.position.lerp(_tCam, Math.min(dt * 18, 1));

      _look.set(playerPos.x, playerPos.y + EYE_H * 0.65, playerPos.z);
      camera.lookAt(_look);
    }

    // Zone label
    const zEl = document.getElementById('zoneLabel');
    if (zEl) {
      if (playerPos.z > 5)       zEl.textContent = 'GARDEN';
      else if (playerPos.z > -9) zEl.textContent = 'PATH';
      else                        zEl.textContent = 'MARKET';
    }

    // Proximity checks throttled to 10Hz - no need to run every frame
    _proxAccum += dt;
    if (_proxAccum >= 0.1) {
      _proxAccum = 0;
      checkShackProximity();
      if (window.Garden) Garden.checkHarvestProximity(playerPos);
    }
  }

  // ── SHACK PROXIMITY ───────────────────────────────────────
  function checkShackProximity() {
    nearShack = null;
    const ip = document.getElementById('interactPrompt');
    for (const def of SHACK_DEFS) {
      if (!def.group) continue;
      const dx = playerPos.x - def.group.position.x;
      const dz = playerPos.z - def.group.position.z;
      if (dx*dx + dz*dz < INTERACT_DIST*INTERACT_DIST) {
        nearShack = def.group;
        if (ip) { ip.textContent=`[E]  ${def.name}`; ip.classList.remove('prompt-hidden'); }
        return;
      }
    }
    if (ip) ip.classList.add('prompt-hidden');
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  // Kept for any external callers but no longer needed internally
  function togglePerspective() {
    if (zoomDist < 0.5) {
      zoomTarget = 5;
      if (window.UI) UI.showNotif('Third Person (scroll to zoom)', '');
    } else {
      zoomTarget = 0;
      if (window.UI) UI.showNotif('First Person', '');
    }
  }

  return {
    init,
    get scene()     { return scene; },
    get camera()    { return camera; },
    get renderer()  { return renderer; },
    get nearShack() { return nearShack; },
    get playerPos() { return playerPos; },
    SHACK_DEFS, HARVEST_DIST,
    togglePerspective,
  };
})();
