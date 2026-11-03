import { io } from 'socket.io-client';
import { MAPS, WORLD } from '../../shared/maps.js';

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

let key = store.get('gb_key');
if (!key) {
  key = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()) + '';
  store.set('gb_key', key);
}
$('name').value = store.get('gb_name') || '';

// Telegram WebApp Setup
const tg = window.Telegram?.WebApp;
const inTG = !!(tg && (tg.initData || tg.initDataUnsafe?.user));
let cfg = { title: 'Gang Beasts', telegramRequired: false, bot: '' };

fetch('/config')
  .then(r => r.json())
  .then(c => { cfg = c; })
  .catch(() => {});

if (inTG) {
  try { tg.ready(); } catch {}
  try { tg.expand(); } catch {}
  try { tg.disableVerticalSwipes?.(); } catch {}
  try {
    tg.setHeaderColor?.('#100a20');
    tg.setBackgroundColor?.('#100a20');
  } catch {}
  try {
    if (['android', 'ios'].includes(tg.platform)) tg.requestFullscreen?.();
  } catch {}

  const insets = () => {
    const a = tg.safeAreaInset?.top || 0, b = tg.contentSafeAreaInset?.top || 0;
    document.documentElement.style.setProperty('--tg-top', (a + b) + 'px');
  };
  insets();
  for (const e of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged']) {
    tg.onEvent?.(e, insets);
  }

  const u = tg.initDataUnsafe?.user;
  if (u) {
    const tgName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Beast';
    $('name').value = tgName;
    $('name').classList.add('hidden');
  }
}

// Sound Synthesizer (zero assets, works 100% offline via Web Audio API)
let soundEnabled = store.get('gb_sound') !== '0';
const soundBtn = $('sound-btn');
const updateSoundBtn = () => { if (soundBtn) soundBtn.textContent = soundEnabled ? '🔊' : '🔇'; };
updateSoundBtn();
soundBtn.onclick = () => {
  soundEnabled = !soundEnabled;
  store.set('gb_sound', soundEnabled ? '1' : '0');
  updateSoundBtn();
};

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'throw') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'ko') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'jump') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'win') {
      [261.6, 329.6, 392.0, 523.3].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const t = now + idx * 0.1;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }
  } catch {}
}

const socket = io();
let pid = null, room = null, snaps = [], fxs = [], comicPops = [], shake = 0, inMatch = false, result = null;

const myName = () => {
  const n = $('name').value.trim() || 'Beast' + Math.floor(10 + Math.random() * 89);
  store.set('gb_name', n);
  return n;
};

const say = t => { $('err').textContent = t || ''; };

const getStartParam = () => {
  const fromTgUnsafe = tg?.initDataUnsafe?.start_param;
  const fromSearch = new URLSearchParams(location.search).get('tgWebAppStartParam') || new URLSearchParams(location.search).get('startapp');
  return fromTgUnsafe || fromSearch || undefined;
};

const doHello = cb => {
  const sp = getStartParam();
  socket.emit('hello', {
    key,
    name: myName(),
    initData: inTG ? (tg.initData || undefined) : undefined,
    startParam: sp
  }, cb);
};

function hello() {
  doHello(r => {
    if (r?.ok === false) return say(r.error);
    if (r?.room) enterRoom(r.pid, r.room);
    else autoJoin();
  });
}

function autoJoin() {
  const c = new URLSearchParams(location.search).get('room');
  if (c && !room) socket.emit('join', { code: c }, ack);
}

socket.on('connect', hello);

const ack = r => {
  if (!r.ok) return say(r.error || 'Failed to enter lobby');
  say('');
  enterRoom(r.pid, r.room);
};

$('create').onclick = () => {
  doHello(() => socket.emit('create', { max: +$('size').value, map: $('map-select').value }, ack));
};

$('quick').onclick = () => {
  doHello(() => socket.emit('quick', {}, ack));
};

$('join').onclick = () => {
  const code = $('code').value.trim();
  if (!code) return say('Please enter a 5-letter room code');
  doHello(() => socket.emit('join', { code }, ack));
};

$('map-select').onchange = () => {
  if (room && room.phase === 'lobby') {
    socket.emit('set_map', $('map-select').value);
  }
};

$('ready').onclick = () => {
  const me = room?.players.find(p => p.pid === pid);
  socket.emit('ready', !me?.ready);
};

const leaveRoom = () => {
  socket.emit('leave');
  room = null;
  pid = null;
  inMatch = false;
  $('banner').classList.add('hidden');
  show('menu');
  history.replaceState(null, '', location.pathname);
};
$('leave').onclick = leaveRoom;
if (inTG && tg.BackButton) tg.BackButton.onClick(leaveRoom);

$('invite').onclick = async () => {
  if (!room) return;
  if (inTG && cfg.bot) {
    const link = `https://t.me/${cfg.bot}?startapp=r_${room.code}`;
    const text = '🥊 Join my Gang Beasts brawl! Tap to play:';
    return tg.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  }
  const url = `${location.origin}${location.pathname}?room=${room.code}`;
  try {
    await navigator.clipboard.writeText(url);
    $('invite').textContent = '✅ Copied to clipboard!';
  } catch {
    prompt('Share this link with your friends to join:', url);
  }
  setTimeout(() => { if ($('invite')) $('invite').textContent = '📢 Invite Group Members'; }, 2000);
};

function enterRoom(p, r) {
  pid = p;
  room = r;
  if (r.map) $('map-select').value = r.map;
  renderRoom();
}

socket.on('room', r => {
  if (room && r.code === room.code) {
    room = r;
    if (r.map && $('map-select').value !== r.map) $('map-select').value = r.map;
    renderRoom();
  }
});

function show(s) {
  if (inTG && tg.BackButton) {
    if (s === 'menu') tg.BackButton.hide();
    else tg.BackButton.show();
  }
  for (const id of ['menu', 'room']) $(id).classList.toggle('hidden', id !== s);
  const play = (s === 'play');
  $('hud').classList.toggle('hidden', !play);
  $('touch').classList.toggle('hidden', !(play && isTouch));
}

function renderRoom() {
  if (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'results') {
    if (!inMatch) {
      inMatch = true;
      snaps = [];
      result = null;
    }
    show('play');
    return;
  }
  inMatch = false;
  $('banner').classList.add('hidden');
  show('room');
  $('rcode').textContent = room.code;

  $('plist').innerHTML = room.players.map(p => {
    const isMe = p.pid === pid;
    const statusClass = !p.connected ? 'dc' : p.ready ? 'ready' : 'wait';
    const statusText = !p.connected ? 'OFFLINE' : p.ready ? 'READY' : 'WAITING';
    return `<div class="pc">
      <span class="dot" style="background:${p.color};color:${p.color}"></span>
      <span>${esc(p.name)}${isMe ? ' <small style="color:#4dd2ff">(you)</small>' : ''}</span>
      <span class="st ${statusClass}">${statusText}</span>
    </div>`;
  }).join('') + `<div class="hint">${room.players.length}/${room.max} beasts in lobby · need at least 2 ready to fight</div>`;

  const me = room.players.find(p => p.pid === pid);
  $('ready').textContent = me?.ready ? 'UNREADY' : 'READY UP';
  if (me?.ready) {
    $('ready').style.background = 'linear-gradient(135deg, #ffd23f, #f39c12)';
  } else {
    $('ready').style.background = '';
  }
}

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

socket.on('snap', s => {
  snaps.push({ t: performance.now(), s });
  if (snaps.length > 30) snaps.shift();
});

socket.on('result', r => {
  result = r;
  if (r.winner === pid) {
    playSound('win');
    try { tg?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
  }
});

socket.on('fx', f => {
  const isKO = f.k === 'ko';
  const isThrow = f.k === 'throw';
  shake = Math.max(shake, isKO ? 18 : Math.min(14, f.p));

  if (isKO) {
    playSound('ko');
    try { tg?.HapticFeedback?.impactOccurred?.('heavy'); } catch {}
    comicPops.push({ x: f.x, y: f.y - 30, text: 'K.O.!', l: 1, c: '#ff3366', sc: 1.6 });
  } else if (isThrow) {
    playSound('throw');
    try { tg?.HapticFeedback?.impactOccurred?.('medium'); } catch {}
    comicPops.push({ x: f.x, y: f.y - 20, text: 'YEET!', l: 1, c: '#ffd23f', sc: 1.3 });
  } else {
    playSound('hit');
    try { tg?.HapticFeedback?.impactOccurred?.('medium'); } catch {}
    const words = ['POW!', 'BAM!', 'WHACK!', 'SMACK!'];
    const word = words[Math.floor(Math.random() * words.length)];
    comicPops.push({ x: f.x, y: f.y - 15, text: word, l: 1, c: '#4dd2ff', sc: 1.1 });
  }

  const n = isKO ? 32 : 12;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28;
    const v = 2 + Math.random() * (isKO ? 10 : 6);
    fxs.push({
      x: f.x,
      y: f.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2.5,
      l: 1,
      c: isKO ? '#ff3366' : (Math.random() > 0.5 ? '#ffd23f' : '#ffffff')
    });
  }
});

// Controls & Inputs
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const keys = new Set();
const tin = { x: 0, j: 0, j2: 0, p: 0, g: 0 };
const KB = {
  KeyA: 'l', ArrowLeft: 'l',
  KeyD: 'r', ArrowRight: 'r',
  Space: 'j', KeyW: 'j', ArrowUp: 'j',
  KeyJ: 'p', KeyZ: 'p',
  KeyK: 'g', KeyX: 'g', ShiftLeft: 'g', ShiftRight: 'g'
};

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (KB[e.code]) {
    keys.add(KB[e.code]);
    if (KB[e.code] === 'j') playSound('jump');
    e.preventDefault();
  }
});

addEventListener('keyup', e => {
  if (KB[e.code]) keys.delete(KB[e.code]);
});

addEventListener('blur', () => keys.clear());

const canvas = $('game');
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) keys.add('p');
  if (e.button === 2) keys.add('g');
});
addEventListener('mouseup', e => {
  keys.delete(e.button === 2 ? 'g' : 'p');
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Touch Buttons
document.querySelectorAll('#btns button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    tin[k] = 1;
    b.classList.add('on');
    if (k === 'j') playSound('jump');
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    b.addEventListener(ev, () => {
      tin[k] = 0;
      b.classList.remove('on');
    });
  }
});

// Virtual Joystick
const stick = $('stick'), knob = $('knob');
let sid = null;
const mv = e => {
  e.preventDefault();
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const d = Math.hypot(dx, dy), m = 52;
  if (d > m) {
    dx *= m / d;
    dy *= m / d;
  }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  tin.x = Math.abs(dx) > 10 ? dx / m : 0;
  if (dy < -36 && !tin.j2) {
    tin.j2 = 1;
    playSound('jump');
  } else if (dy >= -25) {
    tin.j2 = 0;
  }
};

stick.addEventListener('pointerdown', e => {
  sid = e.pointerId;
  try { stick.setPointerCapture(sid); } catch {}
  mv(e);
});
stick.addEventListener('pointermove', e => {
  if (e.pointerId === sid) mv(e);
});
const endStick = () => {
  sid = null;
  tin.x = 0;
  tin.j2 = 0;
  knob.style.transform = '';
};
stick.addEventListener('pointerup', endStick);
stick.addEventListener('pointercancel', endStick);

// Client input sender loop (30 Hz)
let lastSent = '', lastSendT = 0;
setInterval(() => {
  if (!inMatch) return;
  const x = Math.max(-1, Math.min(1, (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + tin.x));
  const cur = {
    x: Math.round(x * 20) / 20,
    j: keys.has('j') || tin.j || tin.j2 ? 1 : 0,
    p: keys.has('p') || tin.p ? 1 : 0,
    g: keys.has('g') || tin.g ? 1 : 0
  };
  const s = JSON.stringify(cur);
  const now = performance.now();
  if (s !== lastSent || now - lastSendT > 200) {
    socket.emit('input', cur);
    lastSent = s;
    lastSendT = now;
  }
}, 1000 / 30);

// Rendering Engine
const ctx = canvas.getContext('2d');
let sc = 1, ox = 0, oy = 0;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  sc = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h);
  ox = (canvas.width - WORLD.w * sc) / 2;
  oy = (canvas.height - WORLD.h * sc) / 2;
}
addEventListener('resize', resize);
resize();

function interp() {
  if (!snaps.length) return null;
  const rt = performance.now() - 100;
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) {
    if (snaps[i - 1].t <= rt) {
      a = snaps[i - 1];
      b = snaps[i];
      break;
    }
  }
  const k = a === b ? 1 : Math.max(0, Math.min(1.2, (rt - a.t) / (b.t - a.t)));
  const out = b.s.p.map(pb => {
    const pa = a.s.p.find(q => q.i === pb.i);
    if (!pa || !pa.al || !pb.al) return pb;
    const L = (u, v) => u + (v - u) * k;
    return {
      ...pb,
      x: L(pa.x, pb.x),
      y: L(pa.y, pb.y),
      a: L(pa.a, pb.a),
      hx: L(pa.hx, pb.hx),
      hy: L(pa.hy, pb.hy)
    };
  });
  return { ...b.s, p: out };
}

const rr = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

// Map & Background Rendering
function drawBg(theme, now) {
  if (theme === 'arena') {
    // Wrestling ring arena
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, '#0a0d1a');
    g.addColorStop(0.7, '#1b2238');
    g.addColorStop(1, '#0b0f1d');
    ctx.fillStyle = g;
    ctx.fillRect(-500, -300, WORLD.w + 1000, WORLD.h + 800);

    // Stadium spotlights
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (const sx of [200, 640, 1080]) {
      const lg = ctx.createRadialGradient(sx, 40, 20, sx, 450, 400);
      lg.addColorStop(0, '#ffffff');
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(sx, 300, 350, 0, 6.28);
      ctx.fill();
    }
    ctx.restore();

    // Crowd silhouettes
    ctx.fillStyle = '#060810';
    for (let i = 0; i < 50; i++) {
      const cx = (i * 28) - 40;
      const cy = 600 + Math.sin(i * 1.5 + now / 400) * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, 6.28);
      ctx.fill();
    }
  } else if (theme === 'industrial') {
    // Meat factory furnace
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, '#1a100d');
    g.addColorStop(0.65, '#2e1913');
    g.addColorStop(1, '#ff4400');
    ctx.fillStyle = g;
    ctx.fillRect(-500, -300, WORLD.w + 1000, WORLD.h + 800);

    // Hazard furnace glowing pit below
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(now / 200) * 0.1;
    ctx.fillStyle = '#ff3700';
    ctx.fillRect(480, 600, 320, 180);
    ctx.restore();

    // Pipes & girders
    ctx.fillStyle = '#1f1614';
    ctx.fillRect(100, 0, 40, 720);
    ctx.fillRect(1140, 0, 40, 720);
    ctx.fillRect(0, 200, 1280, 28);
  } else if (theme === 'highway') {
    // Highway trucks night skyline
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, '#060a17');
    g.addColorStop(0.7, '#141d33');
    g.addColorStop(1, '#1b233a');
    ctx.fillStyle = g;
    ctx.fillRect(-500, -300, WORLD.w + 1000, WORLD.h + 800);

    // Speed lines on highway road
    ctx.fillStyle = '#ffcc00';
    const offset = (now * 1.2) % 180;
    for (let x = -200 + offset; x < WORLD.w + 400; x += 180) {
      ctx.fillRect(x, 650, 80, 8);
    }
  } else {
    // Rooftop rumble (default city skyline)
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, '#150c2e');
    g.addColorStop(1, '#471c66');
    ctx.fillStyle = g;
    ctx.fillRect(-500, -300, WORLD.w + 1000, WORLD.h + 800);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 331) % WORLD.w, (i * 97) % 360, 2, 2);
    }

    // Skyline buildings
    for (let i = 0; i < 15; i++) {
      const h = 130 + (i * 53) % 210, x = i * 95 - 20;
      ctx.fillStyle = '#0f0724';
      ctx.fillRect(x, 720 - h, 80, h + 200);
      ctx.fillStyle = i % 3 ? '#4dd2ff44' : '#ff4d6d44';
      for (let w = 0; w < 6; w++) {
        ctx.fillRect(x + 10 + (w % 3) * 22, 720 - h + 14 + Math.floor(w / 3) * 28, 12, 14);
      }
    }
  }
}

function drawMap(m) {
  for (const s of m.platforms) {
    // Drop shadow
    ctx.fillStyle = '#00000066';
    rr(s.x - s.w / 2 + 5, s.y - s.h / 2 + 8, s.w, s.h, 8);
    ctx.fill();

    // Main platform body
    ctx.fillStyle = s.color || '#332650';
    rr(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 8);
    ctx.fill();

    // Top neon lip
    ctx.fillStyle = s.topColor || '#ff4d6d';
    rr(s.x - s.w / 2, s.y - s.h / 2, s.w, 6, 4);
    ctx.fill();
  }
}

// Gang Beasts Jelly Character Drawing
function drawPlayer(p, meta, now) {
  const c = meta.color;
  const f = p.fc;
  const stun = p.f & 1;
  const grab = p.f & 2;
  const punch = p.f & 4;

  // Ground shadow
  ctx.fillStyle = '#0000004d';
  ctx.beginPath();
  ctx.ellipse(p.x, Math.min(p.y + 76, 700), 24, 7, 0, 0, 6.28);
  ctx.fill();

  // Torso / Jelly Body
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);

  // Jelly legs (wobbly stubby legs)
  ctx.strokeStyle = c;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  const legWobble = stun ? Math.sin(now / 50) * 12 : 0;
  ctx.beginPath();
  ctx.moveTo(-9, 22);
  ctx.lineTo(-9 + legWobble, 39);
  ctx.moveTo(9, 22);
  ctx.lineTo(9 - legWobble, 39);
  ctx.stroke();

  // Jelly feet
  ctx.fillStyle = '#11111166';
  ctx.beginPath();
  ctx.arc(-9 + legWobble, 39, 6, 0, 6.28);
  ctx.arc(9 - legWobble, 39, 6, 0, 6.28);
  ctx.fill();

  // Jelly Body pill
  ctx.fillStyle = c;
  rr(-20, -28, 40, 56, 16);
  ctx.fill();

  // Doughy belly highlight
  ctx.fillStyle = '#ffffff2f';
  rr(-12, -20, 12, 38, 7);
  ctx.fill();

  // Jelly Arms (noodles that reach, punch, or lift above head!)
  let reach = punch ? 44 : grab ? 34 : 14;
  let ay = grab ? -20 : punch ? -10 : 8; // When grabbing, arms lift overhead!

  ctx.strokeStyle = c;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(f * 14, -12);
  ctx.lineTo(f * reach, ay);
  ctx.moveTo(-f * 14, -12);
  ctx.lineTo(-f * (grab ? reach : 16) + (stun ? legWobble : 0), stun ? -28 : (grab ? ay : 8));
  ctx.stroke();

  // Hands
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(f * reach, ay, 8, 0, 6.28);
  ctx.arc(-f * (grab ? reach : 16), grab ? ay : 8, 7, 0, 6.28);
  ctx.fill();

  ctx.restore();

  // Jelly Head
  ctx.save();
  ctx.translate(p.hx, p.hy);
  ctx.rotate(p.a * 0.7);

  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, 6.28);
  ctx.fill();

  // Doughy highlight on head
  ctx.fillStyle = '#ffffff35';
  ctx.beginPath();
  ctx.arc(-6, -8, 8, 0, 6.28);
  ctx.fill();

  // Googly cartoon eyes
  for (const ex of [-8, 8]) {
    // Sclera (White)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + f * 2, -3, stun ? 6.5 : 5.8, 0, 6.28);
    ctx.fill();

    // Pupil
    if (stun) {
      // Dizzy 'X' eyes when stunned / KO'd
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex + f * 2 - 3, -6);
      ctx.lineTo(ex + f * 2 + 3, 0);
      ctx.moveTo(ex + f * 2 + 3, -6);
      ctx.lineTo(ex + f * 2 - 3, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex + f * 4.2, -3, 2.7, 0, 6.28);
      ctx.fill();
    }
  }

  // Mouth
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (stun) {
    ctx.arc(0, 10, 4.5, 0, 6.28); // Open stunned 'O' mouth
  } else if (punch) {
    ctx.arc(f * 4, 8, 6, 0, Math.PI); // Fierce punch grin
  } else {
    ctx.arc(0, 6, 6, 0.15 * Math.PI, 0.85 * Math.PI); // Derpy smile
  }
  ctx.stroke();

  ctx.restore();

  // Name Tag
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText(meta.name, p.hx, p.hy - 32);
  ctx.shadowBlur = 0;
}

// Main Animation & Render Loop
function frame(now) {
  requestAnimationFrame(frame);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const m = MAPS[room?.map || 'rooftop'] || MAPS.rooftop;

  // Screen shake
  shake *= 0.88;
  const sx = (Math.random() - 0.5) * shake * sc;
  const sy = (Math.random() - 0.5) * shake * sc;

  ctx.setTransform(sc, 0, 0, sc, ox + sx, oy + sy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD.w, WORLD.h);
  ctx.clip();

  // Background & Platforms
  drawBg(m.theme, now);
  drawMap(m);

  // Interpolated Players
  const s = inMatch ? interp() : null;
  if (s) {
    for (const p of s.p) {
      if (p.al) {
        const meta = room?.players.find(q => q.pid === p.i);
        if (meta) drawPlayer(p, meta, now);
      }
    }

    // In-game HUD
    const hudContainer = $('hud-players');
    if (hudContainer && room) {
      hudContainer.innerHTML = s.p.map(p => {
        const meta = room.players.find(q => q.pid === p.i) || {};
        const isMe = p.i === pid;
        return `<div class="hp ${p.al ? '' : 'dead'}" style="--c:${meta.color || '#fff'}">
          <span class="pname">${esc(meta.name || 'Beast')}${isMe ? ' ★' : ''}</span>
          <div class="dmg">${p.al ? p.d + '%' : 'KO'}</div>
          <div class="bar"><i style="width:${p.al ? p.s : 0}%"></i></div>
        </div>`;
      }).join('');
    }

    // Banner
    const b = $('banner');
    if (s.ph === 'countdown') {
      b.textContent = s.cd || 'FIGHT!';
      b.classList.remove('hidden');
    } else if (s.ph === 'results' && result) {
      b.textContent = result.winner === pid ? '🏆 YOU WIN!' : result.name ? result.name + ' wins!' : 'Draw!';
      b.classList.remove('hidden');
    } else {
      b.classList.add('hidden');
    }
  }

  // Combat comic pops (POW, BAM, YEET, KO)
  for (const pop of comicPops) {
    ctx.save();
    ctx.font = `900 ${Math.round(24 * pop.sc)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = pop.c;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.globalAlpha = Math.max(0, pop.l);
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
    pop.y -= 0.6;
    pop.l -= 0.025;
  }
  comicPops = comicPops.filter(p => p.l > 0);

  // Particles
  for (const f of fxs) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy += 0.28;
    f.l -= 0.03;
    ctx.globalAlpha = Math.max(0, f.l);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x - 3, f.y - 3, 7, 7);
  }
  ctx.globalAlpha = 1;
  fxs = fxs.filter(f => f.l > 0);

  ctx.restore();
}

requestAnimationFrame(frame);
