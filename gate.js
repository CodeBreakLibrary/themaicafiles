/* gate.js — front-end password gate for the archive, with an F1 car intro.
 *
 * It keeps casual visitors out. It is NOT real security: the page source and the
 * repo are still readable by anyone who looks. Don't put anything here you'd
 * be upset to have read.
 *
 * This file has to be committed: the live site can only check a password against
 * a file that is actually deployed, and a gitignored file never is. In easy mode
 * the password sits here in plain text; in the safer mode only a salted hash does.
 *
 * The cars are the pictures in the cars/ folder, moved with GSAP (gsap.min.js,
 * same folder as this file). If GSAP or the pictures don't load, the gate still works.
 */
(function () {
  'use strict';

  // ================= EDIT HERE =================
  // EASY: type the password between the quotes, save, commit, push.
  //   var GATE = { password: 'your password here' };
  // Anyone who opens this file can read it, so it only keeps casual visitors out.
  //
  // A BIT SAFER: open make-hash.html, type a password, and paste the line it
  // gives you over the next line instead. Then the password isn't readable here.
  var GATE = { password: '' };

  // The cars, in the order they drive in (up to 8). Top-down pictures, nose pointing UP,
  // transparent background. Add or remove files here.
  // The easter egg: tap the checkered flag on the login box (EGG.taps times, quickly) and a menu opens.
  // The menu shows the text below. Fill in the key she'll need (the Vigenere decoding is up to her).
  // If she finds the menu first, the normal unlock gets a little surprise (cars spin out, confetti).
  var EGG = {
    title: 'Woah, you found it',
    cipher: 'fdbhmyud',          // shown in the menu; leave '' to hide this line
    key: '',                     // <-- type the key here
    note: '',                    // optional extra line, e.g. a nudge
    taps: 5,                     // <-- how many taps on the checkered flag it takes
    within: 2.5                  // ...and how many seconds she has to do them in (the count restarts after that)
  };
  var CARS = ['cars/car1.webp', 'cars/car2.webp', 'cars/car3.webp', 'cars/car4.webp', 'cars/car5.webp'];
  // 3D CARS. Put one .glb file per car in the folder cars3d/ and list them here, same order as CARS.
  // Each car is drawn ONCE from its file (top-down) into a picture, one car at a time, then the 3D data
  // is thrown away. A car with no file, or whose file fails, uses its picture from CARS instead.
  // All empty = pictures only.
  var MODELS = ['cars3d/car1.glb', 'cars3d/car2.glb', 'cars3d/car3.glb', 'cars3d/car4.glb', 'cars3d/car5.glb'];
  // If a car comes out facing the wrong way, add degrees here (180 = nose was at the bottom; 90 or 270 = sideways).
  var MODEL_TURN = [0, 0, 0, 0, 0];
  var RENDER_LENGTH = 720;      // picture size in pixels along the car (bigger = sharper, a bit slower)
  var MODEL_WAIT = 90000;       // ms to wait for one file before using its picture instead
  var THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';   // where three.js comes from (or put your own folder here)
  // =============================================

  // true  = remember her on this device after she gets it right (no password box next time).
  // false = ask every single visit.
  var REMEMBER = false;

  var KEY = 'archive-gate-ok';
  var root = document.documentElement;
  var thisScript = document.currentScript;   // only available while this file first runs

  // what we remember on her device; changes whenever the password changes
  function token() {
    if (GATE.password) {
      var h = 5381, p = GATE.password;
      for (var i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) | 0;
      return 'p' + (h >>> 0).toString(16);
    }
    return GATE.hash || '';
  }
  function remembered() {
    try { var t = token(); return !!t && localStorage.getItem(KEY) === t; } catch (e) { return false; }
  }
  async function check(pw) {
    if (GATE.password) return pw === GATE.password;
    return (await derive(pw)) === GATE.hash;
  }

  // already unlocked on this device (and the password hasn't changed since): no cars, no gate
  if (REMEMBER && remembered()) return;
  if (!REMEMBER) { try { localStorage.removeItem(KEY); } catch (e) {} }   // forget anyone remembered by an older version

  // hide the page right away so nothing flashes before the prompt appears
  root.classList.add('gated');

  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var base = ((thisScript && thisScript.src) || '').replace(/[^\/]*$/, '');

  // ---------- load GSAP (same folder first, then a CDN) ----------
  var gs = window.gsap || null;
  var gsapDone = !!gs;
  if (!gs) {
    var urls = [base + 'gsap.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js'];
    (function next() {
      var u = urls.shift();
      if (!u) { gsapDone = true; maybeIntro(); return; }
      var s = document.createElement('script');
      s.src = u; s.async = true;
      s.onload = function () { gs = window.gsap || null; if (gs) { gsapDone = true; maybeIntro(); } else next(); };
      s.onerror = function () { s.remove(); next(); };
      document.head.appendChild(s);
    })();
  }

  var style = document.createElement('style');
  style.textContent = `
    html.gated body{ visibility:hidden; }
    #gate{
      position:fixed; inset:0; z-index:2147483000; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(20px + env(safe-area-inset-bottom,0px));
      color:#C9CCD3; font-family:'Barlow',sans-serif;
      opacity:1; transition:opacity 250ms cubic-bezier(.23,1,.32,1);
    }
    #gate.out{ opacity:0; pointer-events:none; }

    /* the red floor: faint tiles + a darker rim */
    #gate .g-bg{
      position:absolute; inset:0;
      background:
        linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px) 0 0/72px 72px,
        linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px) 0 0/72px 72px,
        radial-gradient(ellipse at 50% 42%, #D3161F 0%, #A80F17 62%, #7D0A10 100%);
    }

    /* wrapper only moves; the picture inside is what turns. The filters sit on the wrapper, so the
       light always comes from the top-left no matter which way a car faces. */
    #gate .g-car{
      position:absolute; left:0; top:0; z-index:1;
      visibility:hidden; pointer-events:none;
      will-change:transform;
      /* a solid edge (the car's thickness) stepping down-right, then a soft cast shadow on the floor */
      filter:
        drop-shadow(1.5px 1.5px 0 #231a19) drop-shadow(1.5px 1.5px 0 #1d1514) drop-shadow(1.5px 1.5px 0 #171110)
        drop-shadow(1.5px 1.5px 0 #120d0c) drop-shadow(1.5px 1.5px 0 #0e0a0a)
        drop-shadow(10px 14px 12px rgba(40,0,0,.55));
    }
    #gate .g-load{ position:absolute; left:50%; bottom:max(18px,env(safe-area-inset-bottom)); transform:translateX(-50%); z-index:3; width:min(260px,70%); text-align:center; color:#fff; font:12px/1.4 system-ui,sans-serif; letter-spacing:.04em; text-shadow:0 1px 2px rgba(0,0,0,.6); pointer-events:none; transition:opacity .4s; }
    #gate .g-load i{ display:block; height:4px; margin-top:6px; border-radius:2px; background:rgba(255,255,255,.28); overflow:hidden; }
    #gate .g-load b{ display:block; height:100%; width:0; background:#fff; transition:width .4s; }
    #gate .g-car img{ display:block; max-width:none; user-select:none; -webkit-user-drag:none; }

    #gate .g-card{
      position:relative; z-index:2; width:min(100%,380px); text-align:center;
      background:#0B0C0E; border:1px solid #2A2E36; padding:22px 22px 20px;
      box-shadow:0 18px 50px rgba(0,0,0,.45);
    }
    #gate .g-flag{
      height:12px; margin-bottom:22px; border:1px solid #2A2E36;
      background:conic-gradient(#F3F3F1 25%, #0B0C0E 0 50%, #F3F3F1 0 75%, #0B0C0E 0) 0 0/12px 12px;
    }
    #gate h1{
      margin:0; font-family:'Barlow Condensed',sans-serif; font-weight:500;
      font-size:clamp(38px,11vw,54px); line-height:1; letter-spacing:.06em; text-transform:uppercase; color:#F3F3F1;
    }
    #gate h1 em{ font-style:normal; color:#E4262B; }
    #gate .g-sub{ margin:12px 0 20px; font-size:17px; line-height:1.5; color:#8C929C; }
    #gate form{ display:flex; gap:8px; }
    #gate input{
      flex:1; min-width:0; font:inherit; font-size:16px; /* 16px stops iOS zooming on focus */
      color:#F3F3F1; background:#0D0E11; border:1px solid #2A2E36; padding:10px 12px; border-radius:0;
    }
    #gate input:focus-visible{ outline:2px solid #E4262B; outline-offset:1px; }
    #gate button{
      min-height:44px; padding:0 18px; border:1px solid #E4262B; border-radius:0;
      background:#E4262B; color:#F3F3F1; cursor:pointer;
      font-family:'Barlow Condensed',sans-serif; font-weight:500; font-size:18px; letter-spacing:.04em;
      touch-action:manipulation;
      transition:transform 160ms cubic-bezier(.23,1,.32,1), background 160ms ease;
    }
    #gate button:active{ transform:scale(.97); }
    #gate button:disabled{ opacity:.5; cursor:default; }
    #gate button:focus-visible{ outline:2px solid #fff; outline-offset:3px; }
    #gate .g-msg{ min-height:22px; margin:12px 0 0; font-size:15px; line-height:1.5; color:#FF9B9E; }
    #gate .g-msg.info{ color:#8C929C; }
    #gate .g-flag{ position:relative; }
    #gate .g-flag::after{ content:''; position:absolute; inset:-14px 0; }          /* bigger tap area for the hidden trigger */
    #gate .g-egg{
      position:absolute; inset:0; z-index:5; display:flex; align-items:center; justify-content:center; padding:20px;
      background:rgba(0,0,0,.55); animation:g-fade 200ms cubic-bezier(.23,1,.32,1);
    }
    #gate .g-egg .g-pop{
      width:min(100%,340px); padding:22px; text-align:center; background:#0B0C0E; border:1px solid #E8C84A;
      box-shadow:0 18px 50px rgba(0,0,0,.6); animation:g-pop 260ms cubic-bezier(.23,1,.32,1);
    }
    #gate .g-egg h2{ margin:0 0 14px; font-family:'Barlow Condensed',sans-serif; font-weight:500; font-size:34px; letter-spacing:.05em; text-transform:uppercase; color:#E8C84A; }
    #gate .g-egg dl{ margin:0 0 16px; display:grid; grid-template-columns:auto 1fr; gap:8px 12px; text-align:left; align-items:baseline; }
    #gate .g-egg dt{ font-size:14px; letter-spacing:.08em; text-transform:uppercase; color:#8C929C; }
    #gate .g-egg dd{ margin:0; font:600 18px/1.4 ui-monospace,Menlo,Consolas,monospace; color:#F3F3F1; word-break:break-all; user-select:all; }
    #gate .g-egg p{ margin:0 0 16px; font-size:16px; line-height:1.5; color:#C9CCD3; }
    #gate .g-egg button{ width:100%; }
    @keyframes g-fade{ from{ opacity:0; } }
    @keyframes g-pop{ from{ opacity:0; transform:scale(.95); } }
    #gate .g-bit{ position:absolute; left:0; top:0; z-index:6; pointer-events:none; }
    #gate .g-card.nope{ animation:g-shake 300ms cubic-bezier(.23,1,.32,1); }
    @keyframes g-shake{ 25%{ transform:translateX(-6px); } 75%{ transform:translateX(6px); } }
    @media (hover:hover) and (pointer:fine){ #gate button:not(:disabled):hover{ background:#F23A3F; } }

    @media (prefers-reduced-motion:reduce){
      #gate{ transition:none; }
      #gate .g-card.nope{ animation:none; }
      #gate button:active{ transform:none; }
    }
  `;
  document.head.appendChild(style);

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  async function derive(pw) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(GATE.salt), iterations: GATE.iter, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  }

  // ---------- parking spots ----------
  // heading = which way the car faces while driving in (0 = up the screen, 90 = right, 180 = down, 270 = left).
  // Cars always enter from the nearest edge and park by it. Filled in this order, so 5 cars use the first 5.
  var SPOTS = [
    { id: 'tl', heading: 152 }, { id: 'tr', heading: 208 },
    { id: 'br', heading: 330 }, { id: 'bl', heading: 28 },
    { id: 'tm', heading: 172 }, { id: 'bm', heading: 12 },
    { id: 'ml', heading: 72 },  { id: 'mr', heading: 288 }
  ];

  // ---------- the overlay ----------
  var built = false, introDone = false, busy = false, parked = false, eggFound = false;
  var el, bg, card, cars = [];       // cars: { img, spot, w, h, px, py, sx, sy, D, loaded }

  function build() {
    var configured = !!(GATE.password || (GATE.hash && GATE.salt));
    el = document.createElement('div');
    el.id = 'gate';
    el.innerHTML =
      '<div class="g-bg"></div>'
      + '<div class="g-card" role="dialog" aria-modal="true" aria-labelledby="g-t">'
      +   '<div class="g-flag" aria-hidden="true"></div>'
      +   '<h1 id="g-t">The <em>archive</em></h1>'
      +   '<p class="g-sub">' + (configured ? 'enter the password to come in.' : 'no password set yet.') + '</p>'
      +   (configured
            ? '<form><input type="password" name="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="password" aria-label="Password" required>'
              + '<button type="submit">Unlock</button></form>'
            : '')
      +   '<p class="g-msg" role="alert"></p>'
      + '</div>';
    // on <html>, not <body>, so it stays visible while the body is hidden
    root.appendChild(el);

    bg = el.querySelector('.g-bg');
    card = el.querySelector('.g-card');

    // the cars: pictures first; a car with a 3D file gets its picture drawn from that file instead (one at a time)
    var pending = 0, total = 0, bar = null, barFill = null, barTxt = null, jobs = [];
    CARS.slice(0, SPOTS.length).forEach(function (src, i) {
      var img = new Image(), box = document.createElement('div');
      box.className = 'g-car'; img.alt = ''; img.draggable = false;
      box.setAttribute('aria-hidden', 'true');
      box.appendChild(img);
      var c = { img: img, box: box, spot: SPOTS[i], loaded: false };
      pending++;
      img.onload = function () { c.loaded = true; done(); };
      img.onerror = function () { box.remove(); done(); };
      el.insertBefore(box, card);
      cars.push(c);
      if (MODELS[i]) jobs.push({ c: c, n: i + 1, model: base + MODELS[i], turn: MODEL_TURN[i] || 0, pic: base + src });
      else img.src = base + src;
    });
    total = pending;
    function done() {
      pending--;
      if (bar) { barFill.style.width = ((total - pending) / total * 100) + '%'; barTxt.textContent = 'loading cars ' + (total - pending) + '/' + total; }
      if (pending === 0) {
        if (bar) { var b = bar; bar = null; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 450); }
        cars = cars.filter(function (c) { return c.loaded; }); built = true; maybeIntro();
      }
    }
    if (jobs.length) {
      bar = document.createElement('div'); bar.className = 'g-load';
      bar.innerHTML = '<span>loading cars 0/' + total + '</span><i><b></b></i>';
      barTxt = bar.firstChild; barFill = bar.querySelector('b'); el.appendChild(bar);
      var seq = Promise.resolve();
      jobs.forEach(function (j) {
        seq = seq.then(function () {
          var t0 = Date.now();
          return withTimeout(render3d(j.model, j.turn), MODEL_WAIT).then(
            function (url) { blobs.push(url); note('car ' + j.n + ' 3D ready in ' + Math.round((Date.now() - t0) / 100) / 10 + 's'); j.c.img.src = url; },
            function (e) { note('car ' + j.n + ' -> picture. ' + (e && e.message ? e.message : e)); j.c.img.src = j.pic; });
        });
      });
      seq.then(function () { if (g3) g3.then(free3d, function () {}); });
    }
    if (!pending) { built = true; }

    var msg = el.querySelector('.g-msg');

    // easter egg: five quick taps on the checkered flag open the menu
    var taps = 0, tapTimer = 0;
    el.querySelector('.g-flag').addEventListener('click', function () {
      if (busy || el.querySelector('.g-egg')) return;
      taps++; clearTimeout(tapTimer); tapTimer = setTimeout(function () { taps = 0; }, EGG.within * 1000);
      if (taps < EGG.taps) return;
      taps = 0; eggFound = true;
      function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      var egg = document.createElement('div');
      egg.className = 'g-egg';
      egg.innerHTML = '<div class="g-pop" role="dialog" aria-modal="true" aria-labelledby="g-egg-t">'
        + '<h2 id="g-egg-t">' + esc(EGG.title) + '</h2>'
        + '<dl>' + (EGG.cipher ? '<dt>Code</dt><dd>' + esc(EGG.cipher) + '</dd>' : '')
        + '<dt>Key</dt><dd>' + esc(EGG.key || '(not set yet)') + '</dd></dl>'
        + (EGG.note ? '<p>' + esc(EGG.note) + '</p>' : '')
        + '<button type="button">Got it</button></div>';
      el.appendChild(egg);
      var ok = egg.querySelector('button');
      function close() { egg.remove(); document.removeEventListener('keydown', onKey); var i = el.querySelector('input'); if (i) i.focus(); }
      function onKey(ev) { if (ev.key === 'Escape') close(); }
      ok.addEventListener('click', close); document.addEventListener('keydown', onKey);
      ok.focus();
    });

    if (!configured) {
      msg.classList.add('info');
      msg.textContent = 'Type a password into gate.js (see the notes at the top of that file).';
      return;
    }
    if (!GATE.password && !(window.crypto && crypto.subtle)) {
      msg.textContent = 'This page has to be opened over https to check the password.';
      return;
    }

    var form = el.querySelector('form');
    var input = el.querySelector('input');
    var btn = el.querySelector('button');
    input.focus();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (busy || !input.value) return;
      btn.disabled = true;
      msg.textContent = '';
      var ok = false;
      try { ok = await check(input.value); }
      catch (err) { msg.textContent = "Couldn't check the password in this browser."; btn.disabled = false; return; }
      if (ok) { unlock(input, btn, eggFound); return; }
      await new Promise(function (r) { setTimeout(r, 500); });   // slows down guessing
      msg.textContent = 'Not quite. Try again.';
      card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope');
      input.value = '';
      input.focus();
      btn.disabled = false;
    });
  }

  // ---------- layout: where each car parks, and where it starts from ----------
  // ---- 3D: draw a .glb once into a picture (three.js is fetched only when a car has a file) ----
  var g3 = null, blobs = [];
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timed out after ' + ms / 1000 + 's')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); });
  }
  function note(t) {   // add #debug to the page address to see these on screen
    try { console.warn('[gate3d] ' + t); } catch (e) {}
    if (location.hash !== '#debug') return;
    var d = document.getElementById('g3d-debug');
    if (!d) { d = document.createElement('div'); d.id = 'g3d-debug'; d.style.cssText = 'position:fixed;left:4px;right:4px;top:4px;z-index:99999;background:rgba(0,0,0,.8);color:#fff;font:11px/1.35 monospace;padding:6px;pointer-events:none;white-space:pre-wrap'; document.body.appendChild(d); }
    d.textContent += t + '\n';
  }
  function load3d() {
    if (g3) return g3;
    g3 = new Promise(function (res, rej) {
      var imp; try { imp = new Function('u', 'return import(u)'); } catch (e) { rej(new Error('this browser cannot load 3D')); return; }
      var B = THREE_BASE, J = B + 'examples/jsm/';
      var im = document.createElement('script'); im.type = 'importmap';
      im.textContent = JSON.stringify({ imports: { three: B + 'build/three.module.min.js' } });
      document.head.appendChild(im);
      Promise.all([imp(B + 'build/three.module.min.js'), imp(J + 'loaders/GLTFLoader.js'), imp(J + 'loaders/DRACOLoader.js'),
                   imp(J + 'libs/meshopt_decoder.module.js'), imp(J + 'environments/RoomEnvironment.js')]).then(function (m) {
        var T = m[0], loader = new m[1].GLTFLoader(), dr = new m[2].DRACOLoader();
        dr.setDecoderPath(J + 'libs/draco/gltf/'); loader.setDRACOLoader(dr); loader.setMeshoptDecoder(m[3].MeshoptDecoder);
        var rd = new T.WebGLRenderer({ alpha: true, antialias: true });         // throws if WebGL is unavailable
        rd.setClearColor(0x000000, 0); rd.toneMapping = T.ACESFilmicToneMapping;
        var pm = new T.PMREMGenerator(rd), env = pm.fromScene(new m[4].RoomEnvironment(), 0.04);
        res({ T: T, loader: loader, rd: rd, pm: pm, env: env, dr: dr });
      }).catch(function (e) { rej(new Error('three.js did not load: ' + (e && e.message ? e.message : e))); });
    });
    return g3;
  }
  function free3d(g) { try { g.env.dispose(); g.pm.dispose(); g.dr.dispose(); g.rd.dispose(); g.rd.forceContextLoss(); } catch (e) {} }
  function render3d(url, turn) {
    return load3d().then(function (g) {
      var T = g.T;
      return g.loader.loadAsync(url).then(function (gltf) {
        var model = gltf.scene, pivot = new T.Group(), scene = new T.Scene();
        try {
          pivot.add(model); scene.add(pivot); scene.environment = g.env.texture;
          var sz = new T.Box3().setFromObject(model).getSize(new T.Vector3());
          pivot.rotation.y = sz.x > sz.z ? Math.PI / 2 : Math.PI;       // glTF is Y-up and faces +Z: turn the car so its nose points up the screen
          pivot.rotation.y += turn * Math.PI / 180;
          pivot.updateMatrixWorld(true);
          var bx = new T.Box3().setFromObject(pivot); pivot.position.sub(bx.getCenter(new T.Vector3()));
          pivot.updateMatrixWorld(true); bx.setFromObject(pivot); bx.getSize(sz);
          var sun = new T.DirectionalLight(0xffffff, 2.4); sun.position.set(-sz.z, sz.z * 2, -sz.z); scene.add(sun);   // light from the top-left
          var hw = sz.x / 2 * 1.03, hh = sz.z / 2 * 1.03;
          var cam = new T.OrthographicCamera(-hw, hw, hh, -hh, 0.01, sz.z * 10 + sz.y * 4);
          cam.up.set(0, 0, -1); cam.position.set(0, bx.max.y + sz.z, 0); cam.lookAt(0, 0, 0);
          var H = RENDER_LENGTH, W = Math.max(64, Math.round(H * hw / hh));
          g.rd.setPixelRatio(1); g.rd.setSize(W, H, false); g.rd.render(scene, cam);
          return new Promise(function (res, rej) {
            g.rd.domElement.toBlob(function (b) { b ? res(URL.createObjectURL(b)) : rej(new Error('could not make the picture')); }, 'image/png');
          });
        } finally {
          model.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();
            [].concat(o.material || []).forEach(function (mt) { for (var k in mt) { if (mt[k] && mt[k].isTexture) mt[k].dispose(); } mt.dispose(); });
          });
        }
      });
    });
  }

  function layout() {
    var W = el.clientWidth, H = el.clientHeight;
    var h = Math.max(150, Math.min(H * 0.36, W * 0.58, 330));   // car length on screen
    var m = Math.max(6, W * 0.015);                             // gap to the screen edge
    var narrow = W < 600;
    cars.forEach(function (c) {
      var w = h * c.img.naturalWidth / c.img.naturalHeight;
      c.w = w; c.h = h;
      c.img.style.width = w + 'px'; c.img.style.height = h + 'px';
      c.box.style.width = w + 'px'; c.box.style.height = h + 'px';
      var a = c.spot.heading * Math.PI / 180, sn = Math.sin(a), cs = Math.cos(a);
      var hw = (w * Math.abs(cs) + h * Math.abs(sn)) / 2;       // half-size of the turned car's bounding box
      var hh = (w * Math.abs(sn) + h * Math.abs(cs)) / 2;
      var inset = narrow ? H * 0.11 : 0;                         // middle cars sit a little in, so they clear the corner cars
      var cx, cy;
      switch (c.spot.id) {
        case 'tl': cx = m + hw;     cy = m + hh;     break;
        case 'tr': cx = W - m - hw; cy = m + hh;     break;
        case 'bl': cx = m + hw;     cy = H - m - hh; break;
        case 'br': cx = W - m - hw; cy = H - m - hh; break;
        case 'tm': cx = W / 2;      cy = m + hh + inset;     break;
        case 'bm': cx = W / 2;      cy = H - m - hh - inset; break;
        case 'ml': cx = m + hw;     cy = H / 2;      break;
        default:   cx = W - m - hw; cy = H / 2;
      }
      c.px = cx - w / 2; c.py = cy - h / 2;                      // parked top-left of the (unrotated) box
      // start/end: straight back along the way the car faces, until it is fully off-screen
      var vx = sn, vy = -cs, r = Math.sqrt(w * w + h * h) / 2 + 8, t = 1e9;
      if (vx > 0.01)  t = Math.min(t, (cx + r) / vx);            // backing toward the left edge
      if (vx < -0.01) t = Math.min(t, (W - cx + r) / -vx);
      if (vy > 0.01)  t = Math.min(t, (cy + r) / vy);            // backing toward the top edge
      if (vy < -0.01) t = Math.min(t, (H - cy + r) / -vy);
      c.D = t;
      c.sx = c.px - vx * t; c.sy = c.py - vy * t;
    });
  }
  function put(c, x, y) {
    if (gs) { gs.set(c.box, { x: x, y: y }); gs.set(c.img, { rotation: c.spot.heading, transformOrigin: '50% 50%' }); }
    else { c.box.style.transform = 'translate(' + x + 'px,' + y + 'px)'; c.img.style.transform = 'rotate(' + c.spot.heading + 'deg)'; }
  }
  function showParked() { cars.forEach(function (c) { put(c, c.px, c.py); c.box.style.visibility = 'visible'; }); parked = true; }

  // ---------- drive in ----------
  function maybeIntro() {
    if (!built || !gsapDone || introDone || busy || !el.isConnected) return;
    introDone = true;
    if (!cars.length) return;
    layout();
    addEventListener('resize', function () {
      if (!parked || busy || !el.isConnected) return;
      layout(); cars.forEach(function (c) { put(c, c.px, c.py); });
    });
    if (!gs || reduce) { showParked(); return; }       // no GSAP / reduced motion: already parked

    var tl = gs.timeline({ delay: 0.5, onComplete: function () { parked = true; } });   // empty page first, then they arrive
    cars.forEach(function (c, i) {
      var T = 0.85 + c.D / 1500;                        // a longer drive takes a little longer
      gs.set(c.img, { rotation: c.spot.heading, transformOrigin: '50% 50%' });
      tl.fromTo(c.box, { x: c.sx, y: c.sy, autoAlpha: 1 },
                       { x: c.px, y: c.py, duration: T, ease: 'power3.out' }, i * 0.5);
    });
  }

  // ---------- correct password: reverse out, reveal the archive ----------
  function restartLights() {
    // replay the archive's own race start now that she can see it
    try {
      var g = document.getElementById('gantry');
      if (!g) return;
      if (typeof seqRunning !== 'undefined' && seqRunning) g.click();   // stop a half-run sequence first
      g.click();
    } catch (e) {}
  }
  function cleanup() { if (el) el.remove(); style.remove(); blobs.forEach(function (u) { URL.revokeObjectURL(u); }); }

  // the surprise for anyone who found the egg: cars spin out, confetti, a message, then the normal way in
  function celebrate(done) {
    var eg = el.querySelector('.g-egg'); if (eg) eg.remove();
    el.querySelector('.g-sub').textContent = 'you found it. lights out, Maica.';
    el.querySelector('.g-msg').textContent = '';
    if (!gs || reduce || !cars.length) { setTimeout(done, 1300); return; }
    cars.forEach(function (c, i) {
      gs.to(c.img, { rotation: '+=' + (i % 2 ? -720 : 720), duration: 1.4, ease: 'power3.inOut', delay: i * 0.07 });
    });
    var box = card.getBoundingClientRect(), colors = ['#E4262B', '#F3F3F1', '#E8C84A', '#0B0C0E', '#F3F3F1'];
    for (var k = 0; k < 90; k++) {
      var b = document.createElement('i');
      b.className = 'g-bit';
      b.style.cssText = 'width:' + (6 + Math.random() * 6) + 'px;height:' + (10 + Math.random() * 8) + 'px;background:' + colors[k % colors.length];
      el.appendChild(b);
      var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
      gs.fromTo(b, { x: box.left + box.width / 2, y: box.top + box.height / 2, rotation: Math.random() * 360, autoAlpha: 1 }, {
        x: '+=' + Math.cos(a) * d, y: '+=' + (Math.sin(a) * d - 60), rotation: '+=' + (Math.random() * 720 - 360),
        duration: 0.7, ease: 'power2.out',
        onComplete: function (bit) { gs.to(bit, { y: '+=' + (200 + Math.random() * 200), autoAlpha: 0, duration: 0.9, ease: 'power1.in', onComplete: function () { bit.remove(); } }); },
        onCompleteParams: [b]
      });
    }
    setTimeout(done, 1800);
  }

  function unlock(input, btn, special) {
    busy = true;
    if (REMEMBER) { try { localStorage.setItem(KEY, token()); } catch (e) {} }
    input.disabled = true; btn.disabled = true;
    card.classList.remove('nope');
    if (special) celebrate(leave); else leave();
  }

  function leave() {

    if (!gs || reduce || !cars.length) {            // no GSAP, reduced motion, or no cars: a plain fade
      el.classList.add('out');
      root.classList.remove('gated');
      setTimeout(function () { cleanup(); restartLights(); }, 300);
      return;
    }

    gs.killTweensOf(cars.map(function (c) { return c.box; }));   // in case she's quick and the cars are still arriving
    layout();
    var n = cars.length;
    var tl = gs.timeline({ onComplete: cleanup });
    tl.to(card, { autoAlpha: 0, y: -10, duration: 0.25, ease: 'power2.out' }, 0);
    cars.slice().reverse().forEach(function (c, k) {   // last to park is first to leave
      var T = 0.6 + c.D / 1600;
      tl.to(c.box, { x: c.sx, y: c.sy, duration: T, ease: 'power2.in' }, 0.1 + k * 0.14);
    });
    var end = 0.1 + (n - 1) * 0.14 + 0.6 + 0.5;
    tl.add(function () { root.classList.remove('gated'); }, Math.max(0.5, end - 0.9));        // page now sits under the floor
    tl.to(bg, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' }, Math.max(0.5, end - 0.9));
    tl.add(restartLights, '>-0.3');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
