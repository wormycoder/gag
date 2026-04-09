// world.js  –  Grow-a-Garden
// Three.js world with configurable quality settings for low/mid/high end devices.

window.World = (() => {

  let scene, camera, renderer, clock;

  const playerPos = new THREE.Vector3(0, 0, 18);
  let camYaw   = 0;
  let camPitch = 0;
  let velY     = 0;
  let grounded = true;

  const ZOOM_MIN  = 0;
  const ZOOM_MAX  = 9;
  const ZOOM_STEP = 1.2;
  let   zoomDist  = 5;
  let zoomTarget  = 5;

  const WORLD    = 60;
  const EYE_H    = 1.75;
  const GRAVITY  = -22;
  const JUMP_V   = 8;
  const MOVE_SPD = 7;

  const keys = {};
  let rmb = false;
  let frozenX = 0, frozenY = 0;
  let nearShack = null;
  const INTERACT_DIST = 5.5;
  const HARVEST_DIST  = 3.8;
  let playerGroup  = null;
  let viewModel    = null;
  let bodyYaw = 0;
  let _proxAccum = 0;

  // ── QUALITY PRESETS ───────────────────────────────────────
  const QUALITY = {
    low: {
      fps:        10,
      pixelRatio: 0.75,
      fog:        false,
      trees:      [[-26,-26],[26,26]],
      flowers:    4,
      clouds:     4,
      fenceStep:  24,
    },
    medium: {
      fps:        30,
      pixelRatio: 1.0,
      fog:        true,
      trees:      [[-26,-26],[26,-26],[-26,26],[26,26]],
      flowers:    8,
      clouds:     8,
      fenceStep:  16,
    },
    high: {
      fps:        60,
      pixelRatio: 1.5,
      fog:        true,
      trees:      [[-26,-26],[26,-26],[-26,26],[26,26],[-26,0],[26,0]],
      flowers:    16,
      clouds:     14,
      fenceStep:  8,
    },
  };

  // Default to medium until player picks
  let Q = QUALITY.medium;

  // ── QUALITY PICKER ────────────────────────────────────────
  // Shows a simple overlay before the game starts so player can pick quality.
  function showQualityPicker(onPick) {
    const overlay = document.createElement('div');
    overlay.id = 'qualityPicker';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(10,5,0,0.97);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:9999;font-family:'Press Start 2P',monospace;
    `;
    overlay.innerHTML = `
      <div style="font-size:13px;color:#ffd700;margin-bottom:8px;letter-spacing:2px">🌱 GROW-A-GARDEN</div>
      <div style="font-size:9px;color:#8d6e63;margin-bottom:32px;letter-spacing:1px">SELECT GRAPHICS QUALITY</div>
      <div style="display:flex;flex-direction:column;gap:14px;width:280px;">
        <button id="qLow" style="
          background:rgba(244,67,54,0.15);border:2px solid #f44336;color:#ef9a9a;
          padding:14px 20px;font-family:inherit;font-size:9px;cursor:pointer;
          border-radius:3px;letter-spacing:1px;text-align:left;line-height:2;
        ">🐢 LOW QUALITY<br><span style="font-size:7px;color:#8d6e63">10fps · Minimal scene · Old/slow devices</span></button>
        <button id="qMed" style="
          background:rgba(255,152,0,0.15);border:2px solid #ff9800;color:#ffcc80;
          padding:14px 20px;font-family:inherit;font-size:9px;cursor:pointer;
          border-radius:3px;letter-spacing:1px;text-align:left;line-height:2;
        ">🌿 MEDIUM QUALITY<br><span style="font-size:7px;color:#8d6e63">30fps · Balanced · Most devices</span></button>
        <button id="qHigh" style="
          background:rgba(76,175,80,0.15);border:2px solid #4caf50;color:#a5d6a7;
          padding:14px 20px;font-family:inherit;font-size:9px;cursor:pointer;
          border-radius:3px;letter-spacing:1px;text-align:left;line-height:2;
        ">🚀 HIGH QUALITY<br><span style="font-size:7px;color:#8d6e63">60fps · Full detail · Gaming PC / Mac</span></button>
      </div>
      <div style="font-size:7px;color:#5d4037;margin-top:24px;">You can change this by refreshing the page</div>
    `;
    document.body.appendChild(overlay);

    const pick = (level) => {
      Q = QUALITY[level];
      localStorage.setItem('gag_quality', level);
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); onPick(); }, 300);
    };

    document.getElementById('qLow').onclick  = () => pick('low');
    document.getElementById('qMed').onclick  = () => pick('medium');
    document.getElementById('qHigh').onclick = () => pick('high');
  }

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
    // Check for saved quality preference, otherwise show picker
    const saved = localStorage.getItem('gag_quality');
    if (saved && QUALITY[saved]) {
      Q = QUALITY[saved];
      buildWorld();
    } else {
      showQualityPicker(buildWorld);
    }
  }

  function buildWorld() {
    const canvas = document.getElementById('gameCanvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    if (Q.fog) scene.fog = new THREE.FogExp2(0x8ec8f0, 0.010);

    camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference:'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
    renderer.shadowMap.enabled = false;

    clock = new THREE.Clock();

    animate();

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
        console.log(`[World] ${name}: ${(performance.now()-t0).toFixed(1)}ms`);
        setTimeout(runNext, 0);
      } else {
        console.log('[World] init complete');
      }
    }
    runNext();

    window.addEventListener('resize', onResize);
  }

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

  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xfff0d0, 0.55));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.38));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.15);
    sun.position.set(30, 60, 25);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.22);
    fill.position.set(-30,15,-20);
    scene.add(fill);
  }

  function darken(hex, f) {
    return ( Math.round(((hex>>16)&0xff)*f)<<16 |
             Math.round(((hex>>8 )&0xff)*f)<<8  |
             Math.round(( hex     &0xff)*f) );
  }

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

  function bx(parent, w,h,d, color, pos) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w,h,d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(...pos);
    parent.add(m);
    return m;
  }

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

    draw('bold 28px monospace');
    const tex = new THREE.CanvasTexture(cv);

    if (document.fonts && document.fonts.load) {
      document.fonts.load('bold 28px "Press Start 2P"').then(() => {
        draw('bold 28px "Press Start 2P", monospace');
        tex.needsUpdate = true;
      }).catch(() => {});
    }

    return tex;
  }

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
    Q.trees.forEach(([x,z]) => {
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

  function buildFlowers() {
    const flowerMats = [0xff4081,0xffeb3b,0xff9800,0xe040fb,0x69f0ae,0xff5722,0x00e5ff,0xf48fb1]
      .map(c => new THREE.MeshLambertMaterial({ color: c }));
    const stemGeo   = new THREE.CylinderGeometry(0.025, 0.03, 0.35, 4);
    const petalGeo  = new THREE.SphereGeometry(0.12, 5, 4);
    const centreGeo = new THREE.SphereGeometry(0.055, 4, 3);

    for (let i = 0; i < Q.flowers; i++) {
      let fx, fz;
      do { fx=(Math.random()-0.5)*WORLD*1.6; fz=(Math.random()-0.5)*WORLD*1.6; }
      while (Math.abs(fx)<20 && Math.abs(fz-2)<14);

      scene.add(Object.assign(new THREE.Mesh(stemGeo, _MAT.stem), { position: { x:fx, y:0.17, z:fz } }));
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

  const clouds = [];
  function buildClouds() {
    for (let i=0; i<Q.clouds; i++) {
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
    for (let i = -WORLD; i <= WORLD; i += Q.fenceStep) {
      [[i,-half],[i,half],[-half,i],[half,i]].forEach(([x,z]) => {
        const post = new THREE.Mesh(postGeo, pMat);
        post.position.set(x, 0.5, z);
        scene.add(post);
      });
    }
  }

  function buildPlayerBody() {
    playerGroup = new THREE.Group();
    const sk  = c => new THREE.MeshLambertMaterial({ color:c });
    const mkB = (w,h,d,col,px,py,pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), sk(col));
      m.position.set(px,py,pz);
      playerGroup.add(m);
      return m;
    };
    mkB(0.6, 0.75,0.35, 0x1565c0,  0,1.22,0);
    mkB(0.52,0.52,0.52, 0xffcc9a,  0,1.82,0);
    mkB(0.54,0.18,0.54, 0x4e342e,  0,2.08,0);
    mkB(0.08,0.08,0.06, 0x111111, -0.12,1.84,0.27);
    mkB(0.08,0.08,0.06, 0x111111,  0.12,1.84,0.27);
    mkB(0.22,0.70,0.22, 0x1565c0, -0.42,1.14,0);
    mkB(0.22,0.70,0.22, 0x1565c0,  0.42,1.14,0);
    mkB(0.24,0.72,0.26, 0x33691e, -0.17,0.5, 0);
    mkB(0.24,0.72,0.26, 0x33691e,  0.17,0.5, 0);
    mkB(0.26,0.18,0.38, 0x3e2723, -0.17,0.09,0.06);
    mkB(0.26,0.18,0.38, 0x3e2723,  0.17,0.09,0.06);

    const bodyItemSlot = new THREE.Group();
    bodyItemSlot.name = 'bodyItemSlot';
    bodyItemSlot.position.set(0.52, 1.0, 0.22);
    playerGroup.add(bodyItemSlot);

    playerGroup.visible = false;
    scene.add(playerGroup);
  }

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

  let _vmSlot    = null;
  let _bodySlot  = null;
  let _lastHeldKey = null;
  function updateHeldItem() {
    if (!_vmSlot)   _vmSlot   = camera.getObjectByName('vmItemSlot');
    if (!_bodySlot) _bodySlot = playerGroup?.getObjectByName('bodyItemSlot');

    const slot = window.UI ? UI.currentSlot : 0;
    const item = Player?.state?.hotbar?.[slot];
    const key  = item ? `${slot}:${item.id}:${item.qty}` : `${slot}:null`;
    if (key === _lastHeldKey) return;
    _lastHeldKey = key;

    if (_vmSlot) {
      while (_vmSlot.children.length) _vmSlot.remove(_vmSlot.children[0]);
      const mesh = buildItemMesh(item);
      if (mesh) _vmSlot.add(mesh);
    }
    if (_bodySlot) {
      while (_bodySlot.children.length) _bodySlot.remove(_bodySlot.children[0]);
      const mesh = buildItemMesh(item);
      if (mesh) { mesh.scale.setScalar(1.4); _bodySlot.add(mesh); }
    }
  }

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

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) { rmb=true; frozenX=e.clientX; frozenY=e.clientY; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 2) rmb = false;
    });
    window.addEventListener('mousemove', e => {
      if (!rmb) return;
      const dx = e.clientX - frozenX;
      const dy = e.clientY - frozenY;
      frozenX = e.clientX; frozenY = e.clientY;
      camYaw   -= dx * 0.0032;
      camPitch -= dy * 0.0032;
      camPitch  = Math.max(-Math.PI*0.42, Math.min(Math.PI*0.42, camPitch));
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      if (window._anyModalOpen?.()) return;
      e.preventDefault();
      zoomTarget += e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomTarget  = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget));
    }, { passive: false });
  }

  // ── ANIMATION LOOP ────────────────────────────────────────
  let _npcT = 0;
  let _lastFrame = 0;
  function animate(now = 0) {
    requestAnimationFrame(animate);
    const TARGET_MS = 1000 / Q.fps;
    if (now - _lastFrame < TARGET_MS) return;
    _lastFrame = now;

    const dt = Math.min(clock.getDelta(), 0.05);

    if (Player?.state?.username && !window._anyModalOpen?.()) {
      updateMovement(dt);
      updateHeldItem();
    }

    zoomDist += (zoomTarget - zoomDist) * Math.min(dt * 12, 1);

    const isFirstPerson = zoomDist < 0.5;
    if (viewModel)   viewModel.visible   = isFirstPerson;
    if (playerGroup) playerGroup.visible = !isFirstPerson;

    SHACK_DEFS.forEach(def => {
      if (def.billboardPlane) def.billboardPlane.lookAt(camera.position);
    });

    _npcT += dt;
    SHACK_DEFS.forEach((def,i) => {
      if (def.npcHead) def.npcHead.position.y = 2.67 + Math.sin(_npcT*1.1+i*0.9)*0.055;
    });

    clouds.forEach(c => {
      c.position.x += c.userData.speed*dt;
      if (c.position.x > WORLD) c.position.x = -WORLD;
    });

    if (window.Garden) Garden.tick(dt);

    renderer.render(scene, camera);
  }

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

    if (keys['KeyW']) _move.addScaledVector(_fwd, 1);
    if (keys['KeyS']) _move.addScaledVector(_fwd,-1);
    if (keys['KeyA']) _move.addScaledVector(_rgt,-1);
    if (keys['KeyD']) _move.addScaledVector(_rgt, 1);
    const isMoving = _move.lengthSq() > 0;
    if (isMoving) _move.normalize().multiplyScalar(MOVE_SPD * dt);

    playerPos.add(_move);

    velY += GRAVITY * dt;
    playerPos.y += velY * dt;
    if (playerPos.y <= 0) { playerPos.y = 0; velY = 0; grounded = true; }

    const bound = WORLD - 1;
    playerPos.x = Math.max(-bound, Math.min(bound, playerPos.x));
    playerPos.z = Math.max(-bound, Math.min(bound, playerPos.z));

    if (isMoving && grounded) _walkT += dt * 8;

    if (!isFirstPerson && isMoving) {
      const moveYaw = Math.atan2(_move.x, _move.z);
      let diff = moveYaw - bodyYaw;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bodyYaw += diff * Math.min(dt * 14, 1);
    }

    if (playerGroup) {
      playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
      playerGroup.rotation.y = isFirstPerson ? camYaw + Math.PI : bodyYaw;
    }

    if (isFirstPerson) {
      const bobY = (isMoving && grounded) ? Math.sin(_walkT) * 0.05 : 0;
      camera.position.set(playerPos.x, playerPos.y + EYE_H + bobY, playerPos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = camYaw;
      camera.rotation.x = camPitch;
    } else {
      const pitch = Math.max(-Math.PI*0.35, Math.min(Math.PI*0.45, camPitch));
      const p = -pitch;
      const offsetX = Math.sin(camYaw) * Math.cos(p) * zoomDist;
      const offsetY = Math.sin(p) * zoomDist + EYE_H;
      const offsetZ = Math.cos(camYaw) * Math.cos(p) * zoomDist;

      _tCam.set(playerPos.x + offsetX, playerPos.y + offsetY, playerPos.z + offsetZ);
      camera.position.lerp(_tCam, Math.min(dt * 18, 1));

      _look.set(playerPos.x, playerPos.y + EYE_H * 0.65, playerPos.z);
      camera.lookAt(_look);
    }

    const zEl = document.getElementById('zoneLabel');
    if (zEl) {
      if (playerPos.z > 5)       zEl.textContent = 'GARDEN';
      else if (playerPos.z > -9) zEl.textContent = 'PATH';
      else                        zEl.textContent = 'MARKET';
    }

    _proxAccum += dt;
    if (_proxAccum >= 0.1) {
      _proxAccum = 0;
      checkShackProximity();
      if (window.Garden) Garden.checkHarvestProximity(playerPos);
    }
  }

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
