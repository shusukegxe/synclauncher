/* Sync — BrosLauncher web (GitHub Pages ready, sin build) */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const state = {
  server: 'djibouti-entirety.tun.ply.gg',
  repo: 'shusukegxe/modsitosde-miencraft-.v',
  branch: 'main',
  excludes: ['literalenchants-1.1.0.jar', '.gitattributes', 'README.md'],
  nick: localStorage.getItem('nick') || '',
  status: null,     // respuesta de mcsrvstat
  dir: null,        // File System handle de la carpeta AppSync
  needsPerm: null,  // handle guardado que pide permiso de nuevo
  mods: null,
  test: false,      // ?test=1 → simula server online y JUGAR no invoca mcq://
};

/* ---------- mini indexedDB para guardar el handle de carpeta ---------- */
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('sync', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const q = tx.objectStore('kv').get(k);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ---------- navegación ---------- */
function go(view) {
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
}

/* ---------- pixel art del hero: ahora es el gif de fondo, no se dibuja nada ---------- */

/* ---------- cabeza de skin (fallback 2D) ---------- */
function drawHead(canvas, nick) {
  const S = canvas.width, x = canvas.getContext('2d');
  x.imageSmoothingEnabled = false;
  const steve = () => {
    x.clearRect(0, 0, S, S);
    const u = S / 8;
    const C = (cx, cy, col) => { x.fillStyle = col; x.fillRect(cx * u, cy * u, u, u); };
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) C(i, j, '#b57862');
    for (let i = 0; i < 8; i++) { C(i, 0, '#3b2a1e'); C(i, 1, '#3b2a1e'); }
    C(0, 2, '#3b2a1e'); C(7, 2, '#3b2a1e');
    C(1, 3, '#ffffff'); C(2, 3, '#4a3fbd'); C(5, 3, '#4a3fbd'); C(6, 3, '#ffffff');
    C(3, 4, '#8f5f4c'); C(4, 4, '#8f5f4c');
    C(3, 5, '#6e4638'); C(4, 5, '#6e4638');
  };
  if (!nick) { steve(); return; }
  // cache-buster por carga de página: si subes una skin nueva, un F5 la pinta sin esperar la caché del navegador
  window.__skinBust = window.__skinBust || Date.now();
  const bust = '?t=' + window.__skinBust;
  // cadena de skins: primero ely.by (cuentas del server), luego Mojang via mc-heads (cuentas premium)
  const urls = [
    'https://skinsystem.ely.by/skins/' + encodeURIComponent(nick) + '.png' + bust,
    'https://mc-heads.net/skin/' + encodeURIComponent(nick),
  ];
  let ui = 0;
  const img = new Image();
  img.onload = () => {
    try {
      x.clearRect(0, 0, S, S);
      x.drawImage(img, 8, 8, 8, 8, 0, 0, S, S);   // cara
      x.drawImage(img, 40, 8, 8, 8, 0, 0, S, S);  // capa del sombrero
    } catch (e) { steve(); }
  };
  img.onerror = () => { ui++; if (ui < urls.length) img.src = urls[ui]; else steve(); };
  img.src = urls[0];
}

/* ---------- estado del server (mcsrvstat, gratis y con CORS) ---------- */
// fetch con timeout: la API a veces se cuelga y no debe dejar la página esperando
async function fetchTO(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 8000);
  try { return await fetch(url, Object.assign({}, opts || {}, { signal: c.signal })); }
  finally { clearTimeout(t); }
}

async function pollStatus() {
  if (state.test) {
    state.status = { online: true, players: { online: 3, max: 20, list: ['ShusukeGxE_', 'Bro', 'AmigaTest'] } };
    renderStatus();
    return;
  }
  try {
    const r = await fetchTO('https://api.mcsrvstat.us/3/' + state.server, { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    state.status = await r.json();
  } catch (e) {
    state.status = { online: false, err: true };
  }
  renderStatus();
}

function renderStatus() {
  const s = state.status;
  const online = !!(s && s.online);
  const pill = $('#statusPill');
  pill.textContent = s && s.err ? 'no se pudo verificar' : (online ? '● En línea' : '● Apagado');
  pill.className = 'pill ' + (online ? 'on' : (s && s.err ? '' : 'off'));

  const players = s && s.players ? s.players : null;
  $('#playersNow').textContent = online && players ? players.online + ' de ' + players.max + ' adentro' : '';
  $('#heroNick').textContent = state.nick ? 'jugando como: ' + state.nick : '';

  const dot = $('#onlineDot');
  dot.className = 'dot ' + (online ? 'on' : 'off');
  $('#onlineTxt').textContent = online && players ? players.online + ' en línea' : (online ? 'En línea' : 'Server apagado');

  renderSocial();
}

/* ---------- lanzar (protocolo mcq://) ---------- */
function launch(qp) {
  if (!state.nick) { openWizard(); return; }
  let u = 'mcq://play?nick=' + encodeURIComponent(state.nick);
  if (qp) u += '&qp=' + encodeURIComponent(qp);
  if (state.test) { toast('PRUEBA · abriría: ' + u); return; }
  location.href = u;
  toast('Abriendo Minecraft… si Windows pregunta, dale a Abrir');
}

/* ---------- carpeta local (File System Access) ---------- */
async function pickFolder() {
  if (!window.showDirectoryPicker) {
    toast('Tu navegador no soporta esto — usa Chrome o Edge'); return;
  }
  try {
    const h = await window.showDirectoryPicker({ mode: 'read' });
    state.dir = h; state.needsPerm = null;
    await idbSet('dir', h);
    await loadLocal();
    toast('Carpeta conectada ✓');
  } catch (e) { /* cancelado */ }
}

async function restoreFolder() {
  try {
    const h = await idbGet('dir');
    if (!h) return;
    if (h.queryPermission && await h.queryPermission({ mode: 'read' }) === 'granted') {
      state.dir = h;
      loadLocal();
    } else {
      state.needsPerm = h;
    }
  } catch (e) { }
}

async function ensurePerm() {
  if (state.dir) return state.dir;
  if (state.needsPerm && state.needsPerm.requestPermission) {
    const p = await state.needsPerm.requestPermission({ mode: 'read' });
    if (p === 'granted') { state.dir = state.needsPerm; return state.dir; }
  }
  return null;
}

async function loadLocal() {
  const d = state.dir;
  if (!d) return;
  $('#folderState').textContent = 'Conectada ✓ — carpeta: ' + d.name;

  const wEl = $('#worlds');
  wEl.innerHTML = '';
  $('#worldsNote').textContent = 'un jugador · clic para entrar';

  let saves = null;
  try { saves = await (await d.getDirectoryHandle('game')).getDirectoryHandle('saves'); } catch (e) { }
  if (!saves) { try { saves = await d.getDirectoryHandle('saves'); } catch (e) { } } // modo prueba: cualquier carpeta con saves/

  const worlds = [];
  if (saves) {
    for await (const [name, h] of saves.entries()) {
      if (h.kind === 'directory') worlds.push({ name, h });
    }
  }

  for (const w of worlds) {
    const el = document.createElement('div');
    el.className = 'card';
    try {
      const f = await (await w.h.getFileHandle('icon.png')).getFile();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      el.appendChild(img);
    } catch (e) {
      // mundo sin foto: mini pixel-art
      el.style.background = 'linear-gradient(160deg,#3d6f8f,#274357)';
    }
    const nm = document.createElement('div');
    nm.className = 'card-name'; nm.textContent = w.name;
    el.appendChild(nm);
    el.title = 'Jugar a "' + w.name + '"';
    el.onclick = async () => { if (await ensurePerm() || state.dir) launch('sp:' + w.name); };
    wEl.appendChild(el);
  }

  if (!worlds.length) {
    const info = document.createElement('div');
    info.className = 'card card-add';
    info.style.width = 'auto';
    info.innerHTML = '<span style="font-size:12.5px;padding:0 16px">Tus mundos aparecerán aquí cuando jueges</span>';
    info.onclick = () => launch(null);
    wEl.appendChild(info);
  }

  const plus = document.createElement('div');
  plus.className = 'card card-add';
  plus.textContent = '+'; plus.title = 'Cambiar carpeta';
  plus.onclick = pickFolder;
  wEl.appendChild(plus);

  // sesiones registradas por SyncApp
  try {
    const f = await d.getFileHandle('tiempo.json');
    const arr = JSON.parse(await (await f.getFile()).text());
    if (Array.isArray(arr)) {
      $('#statSes').textContent = arr.length;
      $('#pBar').style.width = Math.min(100, arr.length * 8) + '%';
    }
  } catch (e) { }
}

/* ---------- mods desde el repo (con cache local de 6h) ---------- */
function renderMods(jars) {
  state.mods = jars;
  $('#modsHead').textContent = jars.length + ' mods · se sincronizan solos cada vez que abres el juego';
  $('#statMods').textContent = jars.length;
  const list = $('#modsList');
  list.innerHTML = '';
  jars.forEach(f => {
    const row = document.createElement('div'); row.className = 'mod-row';
    const n = document.createElement('span'); n.textContent = f.name;
    const z = document.createElement('span'); z.className = 'sz'; z.textContent = Math.round(f.size / 1024) + ' KB';
    row.appendChild(n); row.appendChild(z);
    list.appendChild(row);
  });
}

async function loadMods() {
  const CK = 'modsCache', CT = 'modsCacheT';
  const cached = localStorage.getItem(CK), ts = +(localStorage.getItem(CT) || 0);
  if (cached) {
    try { renderMods(JSON.parse(cached)); } catch (e) { }
    if (Date.now() - ts < 6 * 3600e3) return;   // fresco: no llamar a GitHub
  }
  try {
    const r = await fetchTO('https://api.github.com/repos/' + state.repo + '/contents/?ref=' + state.branch);
    const j = await r.json();
    const jars = j.filter(f => f.name.endsWith('.jar') && !state.excludes.includes(f.name))
                  .map(f => ({ name: f.name, size: f.size }));
    localStorage.setItem(CK, JSON.stringify(jars));
    localStorage.setItem(CT, String(Date.now()));
    renderMods(jars);
  } catch (e) {
    if (!cached) $('#modsHead').textContent = 'No pude leer el repo de mods ahora mismo';
  }
}

/* ---------- social ---------- */
function friendCards() {
  const names = JSON.parse(localStorage.getItem('friends') || 'null') || ['EstebanGrp_', 'AngryWolfX'];
  const el = $('#friendsList');
  el.innerHTML = '';
  const online = state.status && state.status.online && state.status.players ? (state.status.players.list || []) : [];
  names.forEach(n => {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.background = 'linear-gradient(160deg,#2a3247,#1a2030)';
    const head = document.createElement('canvas');
    head.width = 128; head.height = 128;
    head.style.cssText = 'position:absolute;top:12px;left:12px;width:44px;height:44px;image-rendering:pixelated;border-radius:8px;border:1px solid #39415a';
    c.appendChild(head);
    drawHead(head, n);
    const nm = document.createElement('div');
    nm.className = 'card-name'; nm.textContent = n;
    c.appendChild(nm);
    const st = document.createElement('div');
    st.style.cssText = 'position:absolute;top:14px;right:10px;font-size:10.5px;font-weight:800;color:' + (online.includes(n) ? '#43d17c' : '#8b93a5');
    st.textContent = online.includes(n) ? 'ADENTRO' : 'FUERA';
    c.appendChild(st);
    el.appendChild(c);
  });
}

function renderSocial() {
  const box = $('#onlineList');
  box.innerHTML = '';
  const s = state.status;
  const online = s && s.online && s.players ? s.players : null;
  const list = online ? (online.list || []) : [];
  if (!s || !s.online) {
    const d = document.createElement('div');
    d.className = 'online-row';
    d.innerHTML = '<span class="who">Server apagado</span><span class="dim" style="font-size:12.5px">prende la PC del host y avisa a los bros</span>';
    box.appendChild(d);
  } else if (!list.length) {
    const d = document.createElement('div');
    d.className = 'online-row';
    d.innerHTML = '<span class="who">' + online.online + ' jugador(es) adentro</span><span class="dim" style="font-size:12.5px">el server no muestra nombres</span>';
    box.appendChild(d);
  } else {
    list.forEach(n => {
      const d = document.createElement('div');
      d.className = 'online-row';
      const head = document.createElement('canvas'); head.width = 64; head.height = 64;
      d.appendChild(head);
      drawHead(head, n);
      const w = document.createElement('span'); w.className = 'who'; w.textContent = n;
      const st = document.createElement('span'); st.className = 'st'; st.textContent = 'EN LINEA';
      d.appendChild(w); d.appendChild(st);
      box.appendChild(d);
    });
  }
  friendCards();
}

/* ---------- avisos del repo (opcional) ---------- */
async function loadAvisos() {
  try {
    const r = await fetchTO('https://raw.githubusercontent.com/' + state.repo + '/' + state.branch + '/avisos.json', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !j.texto) return;
    const a = $('#avisos');
    a.innerHTML = '';
    const b = document.createElement('b'); b.textContent = j.titulo || 'Aviso';
    a.appendChild(b);
    a.appendChild(document.createTextNode(' — ' + j.texto));
    $('#avisosWrap').hidden = false;
  } catch (e) { }
}

/* ---------- perfil ---------- */
function renderProfile() {
  $('#pNick').textContent = state.nick || 'sin nombre';
  $('#pTag').textContent = state.nick ? 'JUGADOR' : 'CONFIGURA TU NOMBRE';
  drawHead($('#skinHead'), state.nick);   // fallback 2D (visible solo si falla el 3D)
  loadSkin3D(state.nick);
  $('#heroNick').textContent = state.nick ? 'jugando como: ' + state.nick : '';
}

/* ---------- skin 3D (skinview3d, bundle UMD) ---------- */
let skinViewer = null;
let skin3dDead = false;   // si el script o WebGL fallan, nos quedamos con el 2D y no insistimos

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('no cargó ' + src));
    document.head.appendChild(s);
  });
}

async function setupSkin3D() {
  if (skinViewer || skin3dDead) return skinViewer;
  try {
    if (!window.skinview3d) await loadScript('https://cdn.jsdelivr.net/npm/skinview3d@3.4.2/bundles/skinview3d.bundle.js');
    const sv = window.skinview3d;
    const canvas = document.createElement('canvas');
    $('#skinView').appendChild(canvas);
    skinViewer = new sv.SkinViewer({ canvas, renderPaused: false });
    skinViewer.setSize(250, 300);
    skinViewer.zoom = 1.35;
    skinViewer.autoRotate = true;
    skinViewer.autoRotateSpeed = 1.1;
    skinViewer.animation = new sv.WalkingAnimation();
    skinViewer.animation.speed = 0.55;
    skinViewer.fov = 42;
  } catch (e) {
    skin3dDead = true;
    try { window.__skin3dErr = String(e); } catch (_) { }
  }
  return skinViewer;
}

async function loadSkin3D(nick) {
  const viewer = await setupSkin3D();
  if (!viewer) {
    // sin 3D: mostramos la cabeza 2D y fuera caja negra
    $('#skinView').style.display = 'none';
    $('#skinHead').hidden = false;
    return;
  }
  window.__skinBust = window.__skinBust || Date.now();
  const bust3 = '?t=' + window.__skinBust;
  const urls = nick ? [
    'https://skinsystem.ely.by/skins/' + encodeURIComponent(nick) + '.png' + bust3,
    'https://wsrv.nl/?url=' + encodeURIComponent('skinsystem.ely.by/skins/' + nick + '.png'),
    'https://mc-heads.net/skin/' + encodeURIComponent(nick),
    'https://wsrv.nl/?url=' + encodeURIComponent('mc-heads.net/skin/' + nick),
  ] : [];
  for (const u of urls) {
    try {
      await viewer.loadSkin(u);
      $('#skinHead').hidden = true;
      $('#skinView').style.display = 'block';
      return;
    } catch (e) { /* siguiente intento */ }
  }
  // sin skin personalizada (nick sin cuenta ely): cabeza 2D
  $('#skinView').style.display = 'none';
  $('#skinHead').hidden = false;
}

/* ---------- wizard ---------- */
function openWizard() {
  $('#wizard').hidden = false;
  $('#wiz1').hidden = false; $('#wiz2').hidden = true;
  $('#wizNick').value = state.nick || '';
}
function validNick(n) { return /^[A-Za-z0-9_]{3,16}$/.test(n); }

/* ---------- init ---------- */
function init() {
  state.test = new URLSearchParams(location.search).has('test');
  if (state.test) $('#testBadge').hidden = false;

  $$('.nav-item').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#pillFriends').onclick = () => go('social');
  $('#onlinePill').onclick = () => pollStatus();
  $('#btnPlay').onclick = () => launch(null);
  $('#recheck').onclick = () => { pollStatus(); toast('Verificando server…'); };

  $('#serverAddr').textContent = state.server;

  $('#nickSave').onclick = () => {
    const n = $('#nickInput').value.trim();
    if (!validNick(n)) { toast('3 a 16 letras/números, sin espacios'); return; }
    state.nick = n; localStorage.setItem('nick', n);
    renderProfile();
    toast('Guardado ✓ — hola, ' + n);
  };

  $('#folderPick').onclick = pickFolder;

  $('#wizNext').onclick = () => {
    const n = $('#wizNick').value.trim();
    if (!validNick(n)) {
      $('#wizNickNote').textContent = 'Ese nombre no vale: 3 a 16 letras o números, sin espacios.';
      return;
    }
    state.nick = n; localStorage.setItem('nick', n);
    renderProfile();
    $('#wiz1').hidden = true; $('#wiz2').hidden = false;
  };
  $('#wizDone').onclick = () => {
    localStorage.setItem('wizDone', '1');
    $('#wizard').hidden = true;
    toast('¡Todo listo! Dale a JUGAR cuando quieras');
  };
  $('#wizNick').addEventListener('keydown', e => { if (e.key === 'Enter') $('#wizNext').click(); });

  $('#nickInput').value = state.nick;

  // (el hero ahora usa el gif de fondo, no hay canvas que dibujar)
  renderProfile();
  restoreFolder();
  loadMods();
  loadAvisos();
  pollStatus();
  // placeholder de mundos cuando aún no hay carpeta conectada
  function worldsPlaceholder() {
    if (state.dir) return;
    const wEl = $('#worlds');
    if (wEl.children.length) return;
    const info = document.createElement('div');
    info.className = 'card card-add';
    info.style.width = 'auto';
    info.innerHTML = '<span style="font-size:12.5px;padding:0 16px">Conecta tu carpeta para ver tus mundos</span>';
    info.onclick = pickFolder;
    wEl.appendChild(info);
  }
  worldsPlaceholder();
  setInterval(() => { if (document.visibilityState === 'visible') pollStatus(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollStatus();
  });

  if (!localStorage.getItem('wizDone')) openWizard();
}

document.addEventListener('DOMContentLoaded', init);
