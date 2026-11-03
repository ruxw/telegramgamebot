import { io } from 'socket.io-client';
import { MAPS, WORLD } from '../../shared/maps.js';
import { GAME_MODES, COSMETICS, TITLES, IN_GAME_COLLECTIBLES, calcLevel } from '../../shared/modes.js';

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

// User Profile Customization Data
let playerProfile = {
  name: 'RuXi',
  username: '@ruxi',
  title: 'Street Brawler',
  xp: 2450,
  trophies: 185,
  gamesPlayed: 128,
  wins: 74,
  kos: 96,
  equipped: {
    skin: '#8a4fff',
    headwear: 'crown',
    face: 'cool',
    outfit: 'none',
    neck: 'none',
    hands: 'none',
    pose: 'flex'
  }
};

let selectedMode = 'classic';
let selectedCategory = 'headwear';

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
    tg.setHeaderColor?.('#0b0914');
    tg.setBackgroundColor?.('#0b0914');
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
    playerProfile.name = tgName;
    playerProfile.username = u.username ? '@' + u.username : '';
    playerProfile.id = u.id;
    playerProfile.pfpUrl = u.photo_url || (u.id ? `/api/pfp/${u.id}` : null);
  }
}

// Fetch & Display Telegram Profile Photo
function loadTelegramPFP() {
  const pfpImg = $('profile-pfp-img');
  const pfpFallback = $('profile-pfp-fallback');
  if (pfpFallback) {
    pfpFallback.textContent = (playerProfile.name || 'R').charAt(0).toUpperCase();
  }
  if (!playerProfile.pfpUrl || !pfpImg) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    pfpImg.src = playerProfile.pfpUrl;
    pfpImg.classList.remove('hidden');
    if (pfpFallback) pfpFallback.classList.add('hidden');
  };
  img.onerror = () => {
    if (pfpFallback) pfpFallback.classList.remove('hidden');
    pfpImg.classList.add('hidden');
  };
  img.src = playerProfile.pfpUrl;
}

// Sound Synthesizer
let soundEnabled = store.get('gb_sound') !== '0';
const soundBtns = [$('sound-btn'), $('ingame-sound-btn')];
const updateSoundBtns = () => {
  soundBtns.forEach(b => { if (b) b.textContent = soundEnabled ? '🔊' : '🔇'; });
};
updateSoundBtns();
soundBtns.forEach(b => {
  if (!b) return;
  b.onclick = () => {
    soundEnabled = !soundEnabled;
    store.set('gb_sound', soundEnabled ? '1' : '0');
    updateSoundBtns();
  };
});

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
    }
  } catch {}
}

const socket = io({ reconnection: true, reconnectionDelay: 500 });
let pid = null, room = null, snaps = [], fxs = [], comicPops = [], shake = 0, inMatch = false, isSpectator = false, result = null;

const say = t => { if ($('err')) $('err').textContent = t || ''; };

const getStartParam = () => {
  const fromTgUnsafe = tg?.initDataUnsafe?.start_param;
  const fromSearch = new URLSearchParams(location.search).get('tgWebAppStartParam') || new URLSearchParams(location.search).get('startapp');
  return fromTgUnsafe || fromSearch || undefined;
};

const doHello = cb => {
  const sp = getStartParam();
  socket.emit('hello', {
    key,
    name: playerProfile.name,
    skin: playerProfile.equipped.skin,
    hat: playerProfile.equipped.headwear,
    face: playerProfile.equipped.face,
    outfit: playerProfile.equipped.outfit,
    pose: playerProfile.equipped.pose,
    initData: inTG ? (tg.initData || undefined) : undefined,
    startParam: sp
  }, r => {
    if (r?.profile) {
      playerProfile = { ...playerProfile, ...r.profile };
      updateProfileUI();
    }
    if (r?.isSpectator) {
      isSpectator = true;
      $('hud-spectator-tag').classList.remove('hidden');
      enterRoom(null, r.room);
    }
    cb?.(r);
  });
};

function hello() {
  doHello(r => {
    if (r?.ok === false) return say(r.error);
    if (r?.room && !isSpectator) enterRoom(r.pid, r.room);
  });
}

socket.on('connect', hello);

// Main Navigation Tabs
document.querySelectorAll('#bottom-tabs .tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#bottom-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = $(btn.dataset.tab);
    if (target) target.classList.add('active');
  };
});

// Build 10 Game Modes Grid
function renderGameModes() {
  const container = $('modes-grid');
  if (!container) return;
  container.innerHTML = Object.values(GAME_MODES).map(m => {
    const isSelected = m.id === selectedMode;
    return `<div class="mode-card-item ${isSelected ? 'selected' : ''}" data-mode="${m.id}">
      <span class="mode-card-icon">${m.icon}</span>
      <span class="mode-card-name">${esc(m.name)}</span>
      <span class="mode-card-sub">${m.minPlayers}-${m.maxPlayers} Fighters</span>
    </div>`;
  }).join('');

  container.querySelectorAll('.mode-card-item').forEach(card => {
    card.onclick = () => {
      container.querySelectorAll('.mode-card-item').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMode = card.dataset.mode;
      const m = GAME_MODES[selectedMode];
      if (m) {
        $('selected-mode-badge').textContent = `${m.icon} ${m.name.toUpperCase()}`;
        $('brawl-hero-title').textContent = m.name;
        $('selected-mode-desc').textContent = m.desc;
        if ($('create-mode-select')) $('create-mode-select').value = m.id;
      }
    };
  });
}
renderGameModes();

// Profile UI Updater (Matches Mockup)
function updateProfileUI() {
  loadTelegramPFP();
  if ($('profile-display-name')) $('profile-display-name').textContent = playerProfile.name;
  if ($('profile-username')) $('profile-username').textContent = playerProfile.username || '@' + playerProfile.name.toLowerCase().replace(/\s/g, '');
  if ($('profile-title-text')) $('profile-title-text').textContent = playerProfile.title || 'Street Brawler';
  if ($('trophy-count')) $('trophy-count').textContent = playerProfile.trophies || 185;
  if ($('stat-brawls')) $('stat-brawls').textContent = playerProfile.gamesPlayed || 128;
  if ($('stat-wins')) $('stat-wins').textContent = playerProfile.wins || 74;
  if ($('stat-kos')) $('stat-kos').textContent = playerProfile.kos || 96;

  const rate = playerProfile.gamesPlayed > 0 ? Math.round((playerProfile.wins / playerProfile.gamesPlayed) * 100) : 58;
  if ($('stat-winrate')) $('stat-winrate').textContent = rate + '%';

  const prog = calcLevel(playerProfile.xp || 2450);
  if ($('profile-level-text')) $('profile-level-text').textContent = `Level ${prog.level}`;
  if ($('profile-xp-text')) $('profile-xp-text').textContent = `${prog.currentXP.toLocaleString()} / ${prog.nextXP.toLocaleString()} XP`;
  if ($('profile-xp-fill')) $('profile-xp-fill').style.width = prog.progress + '%';

  renderLeaderboards('classic');
}
updateProfileUI();

// Customise Avatar Modal Interactions
$('open-customise-btn').onclick = () => {
  $('customise-screen').classList.remove('hidden');
  renderCustomiseCategory(selectedCategory);
};

$('close-customise-btn').onclick = () => {
  $('customise-screen').classList.add('hidden');
};

document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.onclick = () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedCategory = pill.dataset.cat;
    renderCustomiseCategory(selectedCategory);
  };
});

function getCosmeticsForCat(cat) {
  const map = {
    skin: 'skins',
    skins: 'skins',
    outfit: 'outfits',
    outfits: 'outfits',
    pose: 'poses',
    poses: 'poses'
  };
  const key = map[cat] || cat;
  return COSMETICS[key] || [];
}

function renderCustomiseCategory(cat) {
  const grid = $('customise-items-grid');
  if (!grid) return;

  const items = getCosmeticsForCat(cat);
  const currentKey = (cat === 'pose' || cat === 'poses') ? 'pose' : (cat === 'skin' || cat === 'skins') ? 'skin' : (cat === 'outfit' || cat === 'outfits') ? 'outfit' : cat;
  const currentEquipped = playerProfile.equipped[currentKey] || (currentKey === 'skin' ? '#8a4fff' : 'none');

  grid.innerHTML = items.map(item => {
    const isSelected = (item.id === currentEquipped);
    const isSkin = (cat === 'skin' || cat === 'skins');
    const iconHtml = isSkin
      ? `<span class="slot-color-circle" style="background:${item.id};width:28px;height:28px;border-radius:50%;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></span>`
      : `<span class="slot-icon">${item.icon || '✨'}</span>`;

    return `<div class="cust-item-slot ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-cat="${cat}">
      ${isSelected ? '<span class="check-badge">✓</span>' : ''}
      ${iconHtml}
      <span class="slot-name">${esc(item.name)}</span>
    </div>`;
  }).join('');

  grid.querySelectorAll('.cust-item-slot').forEach(slot => {
    slot.onclick = () => {
      const id = slot.dataset.id;
      playerProfile.equipped[currentKey] = id;
      renderCustomiseCategory(cat);
      updateEquippedChips();
    };
  });

  updateEquippedChips();
}

function updateEquippedChips() {
  const row = $('equipped-tags-row');
  if (!row) return;
  const eq = playerProfile.equipped;
  const activeTags = [];
  if (eq.headwear && eq.headwear !== 'none') activeTags.push({ label: 'Headwear', val: eq.headwear, icon: '👑', cat: 'headwear' });
  if (eq.face && eq.face !== 'normal') activeTags.push({ label: 'Face', val: eq.face, icon: '😎', cat: 'face' });
  if (eq.outfit && eq.outfit !== 'none') activeTags.push({ label: 'Outfit', val: eq.outfit, icon: '👕', cat: 'outfit' });
  if (eq.neck && eq.neck !== 'none') activeTags.push({ label: 'Neck', val: eq.neck, icon: '⛓️', cat: 'neck' });
  if (eq.hands && eq.hands !== 'none') activeTags.push({ label: 'Hands', val: eq.hands, icon: '🥊', cat: 'hands' });

  row.innerHTML = activeTags.map(t => {
    return `<div class="eq-tag">
      <span>${t.icon} ${t.label}</span>
      <span class="rm-btn" data-cat="${t.cat}">✕</span>
    </div>`;
  }).join('');

  row.querySelectorAll('.rm-btn').forEach(btn => {
    btn.onclick = () => {
      const cat = btn.dataset.cat;
      playerProfile.equipped[cat] = cat === 'face' ? 'normal' : 'none';
      renderCustomiseCategory(selectedCategory);
      updateEquippedChips();
    };
  });

  if ($('equipped-chip')) $('equipped-chip').textContent = `Equipped ${activeTags.length}/2`;
}

$('btn-customise-reset').onclick = () => {
  playerProfile.equipped = {
    skin: '#8a4fff',
    headwear: 'none',
    face: 'normal',
    outfit: 'none',
    neck: 'none',
    hands: 'none',
    pose: 'stand'
  };
  renderCustomiseCategory(selectedCategory);
  updateEquippedChips();
};

$('btn-customise-save').onclick = () => {
  socket.emit('update_custom', playerProfile.equipped);
  $('customise-screen').classList.add('hidden');
  updateProfileUI();
};

// Mode Leaderboards (No Fake Data)
function renderLeaderboards(mode = 'classic') {
  const list = $('leaderboard-list');
  if (!list) return;

  fetch(`/api/leaderboard/${mode}`)
    .then(r => r.json())
    .then(d => {
      const lb = d.leaderboard && Array.isArray(d.leaderboard) ? d.leaderboard : [];

      if (lb.length === 0) {
        list.innerHTML = `<div class="clean-empty-state">
          <span class="empty-icon">🥊</span>
          <h4>No Brawlers Ranked Yet</h4>
          <p>Win a brawl in <b>${esc(mode.toUpperCase())}</b> to claim the #1 spot on the leaderboard!</p>
        </div>`;
        return;
      }

      const medals = ['🥇', '🥈', '🥉'];
      list.innerHTML = lb.map((e, i) => {
        const isMe = e.name === playerProfile.name;
        return `<div class="clean-rank-row ${isMe ? 'you-row' : ''}">
          <span class="clean-rank-pos">${medals[i] || '#' + (i + 1)}</span>
          <span class="clean-rank-dot" style="background:${e.color || '#8a4fff'}"></span>
          <span class="clean-rank-name">${esc(e.name)}${isMe ? ' ★' : ''}</span>
          <span class="clean-rank-score">${e.score || 0} pts</span>
        </div>`;
      }).join('');
    })
    .catch(() => {
      list.innerHTML = `<div class="clean-empty-state">
        <span class="empty-icon">⚠️</span>
        <h4>Leaderboard Offline</h4>
        <p>Could not load leaderboard data. Please check back soon.</p>
      </div>`;
    });
}

document.querySelectorAll('.rank-tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.rank-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLeaderboards(btn.dataset.mode);
  };
});

// Room & Match Interactions
const ack = r => {
  if (!r.ok) return say(r.error || 'Failed to enter lobby');
  say('');
  enterRoom(r.pid, r.room);
};

$('quick').onclick = () => {
  doHello(() => socket.emit('quick', { mode: selectedMode }, ack));
};

$('create').onclick = () => {
  const map = $('create-map').value;
  const mode = $('create-mode-select').value;
  doHello(() => socket.emit('create', { max: 4, map, mode }, ack));
};

$('join').onclick = () => {
  const code = $('code').value.trim();
  if (!code) return say('Please enter room code');
  doHello(() => socket.emit('join', { code }, ack));
};

$('add-ai-btn').onclick = () => {
  socket.emit('fill_ai', { difficulty: 'advanced', archetype: 'aggressive' });
};

$('ready').onclick = () => {
  const me = room?.players.find(p => p.pid === pid);
  socket.emit('ready', !me?.ready);
};

$('leave').onclick = () => {
  socket.emit('leave');
  room = null;
  pid = null;
  inMatch = false;
  isSpectator = false;
  $('hud-spectator-tag').classList.add('hidden');
  show('hub');
};

$('invite').onclick = async () => {
  if (!room) return;
  const link = `https://t.me/${cfg.bot}?startapp=r_${room.code}`;
  const text = `🥊 Join my ${room.modeName || 'Gang Beasts'} brawl! Tap to play:`;
  if (inTG && tg.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  } else {
    navigator.clipboard?.writeText(link);
    $('invite').textContent = '✅ Copied!';
    setTimeout(() => { if ($('invite')) $('invite').textContent = '📢 Share'; }, 2000);
  }
};

function enterRoom(p, r) {
  pid = p;
  room = r;
  renderRoom();
}

socket.on('room', r => {
  if (room && r.code === room.code) {
    room = r;
    renderRoom();
  }
});

function show(s) {
  const isHub = (s === 'hub');
  const isRoom = (s === 'room');
  const isPlay = (s === 'play');

  $('hub').classList.toggle('hidden', !isHub);
  $('room').classList.toggle('hidden', !isRoom);
  $('bottom-tabs').classList.toggle('hidden', !isHub);
  $('top-nav').classList.toggle('hidden', isPlay);
  $('hud').classList.toggle('hidden', !isPlay);
  $('touch').classList.toggle('hidden', !(isPlay && isTouch && !isSpectator));
}

function renderRoom() {
  if (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'results') {
    if (!inMatch) {
      inMatch = true;
      snaps = [];
      result = null;
      if (!isSpectator) {
        playerProfile.gamesPlayed++;
        updateProfileUI();
      }
    }
    show('play');
    return;
  }
  inMatch = false;
  show('room');
  $('rcode').textContent = room.code;
  $('room-mode-label').textContent = room.modeName?.toUpperCase() || 'CLASSIC BRAWL';

  $('plist').innerHTML = room.players.map(p => {
    const isMe = p.pid === pid;
    const isAway = p.minimized;
    const statusClass = !p.connected ? 'dc' : isAway ? 'away' : p.ready ? 'ready' : 'wait';
    const statusText = !p.connected ? 'OFFLINE' : isAway ? 'AWAY' : p.ready ? 'READY' : 'WAITING';

    return `<div class="pc-slot">
      <div style="display:flex;align-items:center;">
        <span class="slot-dot" style="background:${p.color};"></span>
        <span>${esc(p.name)}${isMe ? ' <small style="color:var(--accent-purple-light)">(you)</small>' : ''}</span>
      </div>
      <span class="slot-status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');

  const me = room.players.find(p => p.pid === pid);
  $('ready').textContent = me?.ready ? 'UNREADY' : 'READY UP';
  $('ready').className = me?.ready ? 'btn-ghost-dark ready-btn' : 'btn-success ready-btn';
}

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

socket.on('snap', s => {
  snaps.push({ t: performance.now(), s });
  if (snaps.length > 30) snaps.shift();
  if (s.sp !== undefined && $('spec-count')) {
    $('spec-count').textContent = s.sp;
  }
});

socket.on('result', r => {
  result = r;
  if (r.winner === pid && !isSpectator) {
    playSound('hit');
    playerProfile.wins++;
    playerProfile.xp += 150;
    updateProfileUI();
  }
});

socket.on('fx', f => {
  shake = Math.max(shake, f.k === 'ko' ? 18 : 8);
  if (f.k === 'ko') {
    playSound('ko');
    comicPops.push({ x: f.x, y: f.y - 30, text: 'K.O.!', l: 1, c: '#ff3b30', sc: 1.8 });
  } else {
    playSound('hit');
    comicPops.push({ x: f.x, y: f.y - 15, text: 'POW!', l: 1, c: '#a97aff', sc: 1.2 });
  }
});

socket.on('powerup_collect', d => {
  const pwrNames = { speed: '⚡ SPEED!', shield: '🛡️ SHIELD!', mega: '💥 MEGA PUNCH!', bomb: '💣 BOOM!' };
  comicPops.push({ x: 640, y: 320, text: pwrNames[d.type] || '⚡ POWERUP!', l: 1.4, c: '#ffd23f', sc: 1.35 });
  playSound('hit');
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
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || isSpectator) return;
  if (KB[e.code]) {
    keys.add(KB[e.code]);
    if (KB[e.code] === 'j') playSound('jump');
    e.preventDefault();
  }
});

addEventListener('keyup', e => {
  if (KB[e.code]) keys.delete(KB[e.code]);
});

const canvas = $('game');
canvas.addEventListener('mousedown', e => {
  if (isSpectator) return;
  if (e.button === 0) keys.add('p');
  if (e.button === 2) keys.add('g');
});
addEventListener('mouseup', e => {
  keys.delete(e.button === 2 ? 'g' : 'p');
});

// Touch Buttons
document.querySelectorAll('#btns button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => {
    if (isSpectator) return;
    e.preventDefault();
    tin[k] = 1;
    if (k === 'j') playSound('jump');
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    b.addEventListener(ev, () => { tin[k] = 0; });
  }
});

// Virtual Joystick
const stick = $('stick'), knob = $('knob');
let sid = null;
const mv = e => {
  if (isSpectator) return;
  e.preventDefault();
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const d = Math.hypot(dx, dy), m = 50;
  if (d > m) { dx *= m / d; dy *= m / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  tin.x = Math.abs(dx) > 10 ? dx / m : 0;
  if (dy < -32 && !tin.j2) {
    tin.j2 = 1;
    playSound('jump');
  } else if (dy >= -20) {
    tin.j2 = 0;
  }
};

stick.addEventListener('pointerdown', e => {
  if (isSpectator) return;
  sid = e.pointerId;
  stick.setPointerCapture?.(sid);
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
setInterval(() => {
  if (!inMatch || isSpectator) return;
  const x = Math.max(-1, Math.min(1, (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + tin.x));
  const cur = {
    x: Math.round(x * 20) / 20,
    j: keys.has('j') || tin.j || tin.j2 ? 1 : 0,
    p: keys.has('p') || tin.p ? 1 : 0,
    g: keys.has('g') || tin.g ? 1 : 0
  };
  socket.emit('input', cur);
}, 1000 / 30);

// Rendering Engine (3D Gang Beasts Characters & Smooth Stages)
const ctx = canvas.getContext('2d');
let dpr = 1;
let camX = 640, camY = 480, camZoom = 0.8;

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
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

// Pedestal Avatar Drawer (3D Aesthetic Matching Mockup)
function drawPedestalAvatar(c, now, custom, pose = 'stand') {
  if (!c || c.offsetParent === null) return;
  const actx = c.getContext('2d');
  actx.clearRect(0, 0, c.width, c.height);

  const cx = c.width / 2;
  const cy = c.height / 2 + 10;
  const wobble = Math.sin(now / 260) * 3;
  const skin = custom.skin || '#8a4fff';

  // Soft purple glow aura behind character
  const aura = actx.createRadialGradient(cx, cy - 20, 20, cx, cy - 20, 80);
  aura.addColorStop(0, 'rgba(138, 79, 255, 0.45)');
  aura.addColorStop(1, 'transparent');
  actx.fillStyle = aura;
  actx.beginPath();
  actx.arc(cx, cy - 20, 80, 0, 6.28);
  actx.fill();

  // 3D Shadow on Pedestal
  actx.fillStyle = 'rgba(0,0,0,0.45)';
  actx.beginPath();
  actx.ellipse(cx, cy + 62, 38, 10, 0, 0, 6.28);
  actx.fill();

  // Legs
  actx.strokeStyle = skin;
  actx.lineWidth = 15;
  actx.lineCap = 'round';
  actx.beginPath();
  actx.moveTo(cx - 14, cy + 20);
  actx.lineTo(cx - 16, cy + 54);
  actx.moveTo(cx + 14, cy + 20);
  actx.lineTo(cx + 16, cy + 54);
  actx.stroke();

  // Torso (Smooth 3D Doughy Body)
  actx.fillStyle = skin;
  actx.beginPath();
  actx.roundRect(cx - 32, cy - 20 + wobble, 64, 60, 26);
  actx.fill();

  // Outfit rendering
  if (custom.outfit && custom.outfit !== 'none') {
    actx.fillStyle = custom.outfit === 'tuxedo' ? '#111' : custom.outfit === 'boxer' ? '#ff3b30' : custom.outfit === 'ninja' ? '#1a1a24' : '#ffd23f';
    actx.beginPath();
    actx.roundRect(cx - 30, cy - 8 + wobble, 60, 42, 14);
    actx.fill();
  }

  // Torso Highlight
  actx.fillStyle = 'rgba(255,255,255,0.22)';
  actx.beginPath();
  actx.roundRect(cx - 18, cy - 10 + wobble, 18, 38, 12);
  actx.fill();

  // Arms & Pose
  actx.strokeStyle = skin;
  actx.lineWidth = 14;
  actx.lineCap = 'round';
  actx.beginPath();
  if (pose === 'flex') {
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 44, cy - 22 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 42, cy + 18 + wobble);
  } else if (pose === 'victory') {
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 44, cy - 36 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 44, cy - 36 + wobble);
  } else if (pose === 'double_flex') {
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 42, cy - 24 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 42, cy - 24 + wobble);
  } else if (pose === 'boxing') {
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 36, cy - 14 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 46, cy - 10 + wobble);
  } else if (pose === 'dab') {
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 46, cy - 28 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 40, cy - 20 + wobble);
  } else {
    // Confident standing
    actx.moveTo(cx - 24, cy - 6 + wobble);
    actx.lineTo(cx - 44, cy + 18 + wobble);
    actx.moveTo(cx + 24, cy - 6 + wobble);
    actx.lineTo(cx + 44, cy + 18 + wobble);
  }
  actx.stroke();

  // Head
  const headY = cy - 42 + wobble;
  actx.fillStyle = skin;
  actx.beginPath();
  actx.arc(cx, headY, 32, 0, 6.28);
  actx.fill();

  // Head Highlight
  actx.fillStyle = 'rgba(255,255,255,0.25)';
  actx.beginPath();
  actx.arc(cx - 10, headY - 12, 11, 0, 6.28);
  actx.fill();

  // Face Expression (Cool Shades from mockup as default)
  const face = custom.face || 'cool';
  if (face === 'cool' || custom.headwear === 'shades') {
    actx.fillStyle = '#111116';
    actx.beginPath();
    actx.roundRect(cx - 22, headY - 8, 20, 14, 4);
    actx.roundRect(cx + 2, headY - 8, 20, 14, 4);
    actx.fillRect(cx - 4, headY - 4, 8, 4);
    actx.fill();
    actx.fillStyle = 'rgba(255,255,255,0.4)';
    actx.fillRect(cx - 18, headY - 6, 6, 3);
    actx.fillRect(cx + 6, headY - 6, 6, 3);
  } else if (face === 'angry') {
    for (const ex of [-10, 10]) {
      actx.fillStyle = '#fff';
      actx.beginPath();
      actx.arc(cx + ex, headY - 4, 7, 0, 6.28);
      actx.fill();
      actx.fillStyle = '#111';
      actx.beginPath();
      actx.arc(cx + ex, headY - 4, 3, 0, 6.28);
      actx.fill();
    }
    // Angry angled brows
    actx.strokeStyle = '#111';
    actx.lineWidth = 3;
    actx.beginPath();
    actx.moveTo(cx - 16, headY - 12); actx.lineTo(cx - 4, headY - 8);
    actx.moveTo(cx + 16, headY - 12); actx.lineTo(cx + 4, headY - 8);
    actx.stroke();
  } else if (face === 'sleepy') {
    actx.strokeStyle = '#111';
    actx.lineWidth = 3;
    actx.beginPath();
    actx.moveTo(cx - 16, headY - 4); actx.lineTo(cx - 6, headY - 4);
    actx.moveTo(cx + 6, headY - 4); actx.lineTo(cx + 16, headY - 4);
    actx.stroke();
  } else {
    // Googly eyes
    for (const ex of [-10, 10]) {
      actx.fillStyle = '#fff';
      actx.beginPath();
      actx.arc(cx + ex, headY - 4, 7, 0, 6.28);
      actx.fill();
      actx.fillStyle = '#111';
      actx.beginPath();
      actx.arc(cx + ex, headY - 4, 3, 0, 6.28);
      actx.fill();
    }
  }

  // Headwear
  const hw = custom.headwear;
  if (hw === 'crown') {
    actx.fillStyle = '#ffd23f';
    actx.strokeStyle = '#c89e00';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(cx - 20, headY - 24);
    actx.lineTo(cx - 22, headY - 44);
    actx.lineTo(cx - 10, headY - 34);
    actx.lineTo(cx, headY - 48);
    actx.lineTo(cx + 10, headY - 34);
    actx.lineTo(cx + 22, headY - 44);
    actx.lineTo(cx + 20, headY - 24);
    actx.closePath();
    actx.fill();
    actx.stroke();
  } else if (hw === 'cowboy') {
    actx.fillStyle = '#8b5a2b';
    actx.beginPath();
    actx.ellipse(cx, headY - 26, 36, 10, 0, 0, 6.28);
    actx.fill();
    actx.beginPath();
    actx.roundRect(cx - 18, headY - 46, 36, 24, 8);
    actx.fill();
  } else if (hw === 'tophat') {
    actx.fillStyle = '#1a1a24';
    actx.beginPath();
    actx.ellipse(cx, headY - 26, 32, 8, 0, 0, 6.28);
    actx.fill();
    actx.fillRect(cx - 16, headY - 56, 32, 32);
    actx.fillStyle = '#ff3b30';
    actx.fillRect(cx - 16, headY - 32, 32, 6);
  } else if (hw === 'viking') {
    actx.fillStyle = '#888';
    actx.beginPath();
    actx.arc(cx, headY - 24, 22, Math.PI, 0);
    actx.fill();
    // Horns
    actx.fillStyle = '#ffd23f';
    actx.beginPath();
    actx.moveTo(cx - 20, headY - 26); actx.lineTo(cx - 32, headY - 44); actx.lineTo(cx - 14, headY - 32);
    actx.moveTo(cx + 20, headY - 26); actx.lineTo(cx + 32, headY - 44); actx.lineTo(cx + 14, headY - 32);
    actx.fill();
  } else if (hw === 'halo') {
    actx.strokeStyle = '#ffd23f';
    actx.lineWidth = 5;
    actx.beginPath();
    actx.ellipse(cx, headY - 44, 24, 8, 0, 0, 6.28);
    actx.stroke();
  } else if (hw === 'headphones') {
    actx.strokeStyle = '#fff';
    actx.lineWidth = 4;
    actx.beginPath();
    actx.arc(cx, headY, 34, Math.PI, 0);
    actx.stroke();
    actx.fillStyle = '#ff4d6d';
    actx.fillRect(cx - 36, headY - 10, 8, 20);
    actx.fillRect(cx + 28, headY - 10, 8, 20);
  } else if (hw === 'beanie') {
    actx.fillStyle = '#ff4d6d';
    actx.beginPath();
    actx.arc(cx, headY - 18, 28, Math.PI, 0);
    actx.fill();
    actx.fillStyle = '#fff';
    actx.beginPath();
    actx.arc(cx, headY - 46, 7, 0, 6.28);
    actx.fill();
  } else if (hw === 'cap') {
    actx.fillStyle = '#00d4ff';
    actx.beginPath();
    actx.arc(cx, headY - 20, 26, Math.PI, 0);
    actx.fill();
    actx.fillRect(cx - 12, headY - 24, 40, 6);
  }
}

// 3D Map Rendering
function draw3DMap(m) {
  for (const s of m.platforms) {
    const hw = s.w / 2, hh = s.h / 2;
    const x = s.x - hw, y = s.y - hh;
    const depth = Math.min(22, s.h * 0.55);

    // Cast Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    rr(x + 6, y + s.h + 4, s.w - 4, 16, 8);
    ctx.fill();

    // Front Extrusion Face
    ctx.fillStyle = '#130f24';
    rr(x, y + s.h - 4, s.w, depth, 6);
    ctx.fill();

    // Main Platform Face
    ctx.fillStyle = s.color || '#231c3b';
    rr(x, y, s.w, s.h, 8);
    ctx.fill();

    // Top Neon Glow Strip
    ctx.fillStyle = s.topColor || '#8a4fff';
    rr(x, y, s.w, 6, 4);
    ctx.fill();
  }
}

// Draw Character in Match
function drawPlayer(p, meta, now) {
  const c = meta.color || '#8a4fff';
  const f = p.fc;
  const stun = p.f & 1;
  const grab = p.f & 2;
  const punch = p.f & 4;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, Math.min(p.y + 76, 700), 22, 6, 0, 0, 6.28);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);

  // Legs
  ctx.strokeStyle = c;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 22); ctx.lineTo(-9, 39);
  ctx.moveTo(9, 22); ctx.lineTo(9, 39);
  ctx.stroke();

  // Body
  ctx.fillStyle = c;
  rr(-20, -28, 40, 56, 16);
  ctx.fill();

  // Arms
  let reach = punch ? 44 : grab ? 34 : 14;
  let ay = grab ? -20 : punch ? -10 : 8;
  ctx.strokeStyle = c;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(f * 14, -12); ctx.lineTo(f * reach, ay);
  ctx.moveTo(-f * 14, -12); ctx.lineTo(-f * (grab ? reach : 16), grab ? ay : 8);
  ctx.stroke();

  ctx.restore();

  // Head
  ctx.save();
  ctx.translate(p.hx, p.hy);
  ctx.rotate(p.a * 0.7);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, 6.28);
  ctx.fill();

  // Eyes/Shades
  if (meta.hat === 'crown') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-14, -16); ctx.lineTo(-14, -28); ctx.lineTo(0, -32); ctx.lineTo(14, -28); ctx.lineTo(14, -16);
    ctx.fill();
  }

  ctx.fillStyle = '#111';
  ctx.fillRect(-12, -4, 10, 8);
  ctx.fillRect(2, -4, 10, 8);

  ctx.restore();

  // Name Tag
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(meta.name, p.hx, p.hy - 28);
}

// Performance & 60 FPS Monitor
let frameCount = 0, lastFpsUpdate = performance.now(), currentFps = 60, frameTimeMs = 16.6;
let lastFrameTime = performance.now();
let cachedBgGradient = null;

// Reconnect listeners
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !socket.connected) hello();
});
window.addEventListener('focus', () => {
  if (!socket.connected) hello();
});

// Main Animation Loop (Target 60 FPS)
function frame(now) {
  requestAnimationFrame(frame);

  const delta = now - lastFrameTime;
  lastFrameTime = now;
  frameTimeMs = delta;
  frameCount++;

  if (now - lastFpsUpdate >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = now;
    const fpsEl = $('fps-counter');
    if (fpsEl && !fpsEl.classList.contains('hidden')) {
      fpsEl.textContent = `${currentFps} FPS · ${frameTimeMs.toFixed(1)}ms`;
    }
  }

  // Draw Hero Profile Avatar ONLY when visible (prevents CPU/GPU waste)
  const profileTab = $('tab-profile');
  if (profileTab && profileTab.classList.contains('active')) {
    drawPedestalAvatar($('profile-avatar-canvas'), now, playerProfile.equipped, playerProfile.equipped.pose);
  }
  const custModal = $('customise-screen');
  if (custModal && !custModal.classList.contains('hidden')) {
    drawPedestalAvatar($('customise-stage-canvas'), now, playerProfile.equipped, playerProfile.equipped.pose);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const m = MAPS[room?.map || 'rooftop'] || MAPS.rooftop;
  const s = inMatch ? interp() : null;

  // Dynamic Camera
  let targetCamX = 640, targetCamY = 480, targetZoom = 0.8;
  if (s && s.p) {
    const alives = s.p.filter(p => p.al);
    if (alives.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of alives) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      targetCamX = Math.max(450, Math.min(830, (minX + maxX) / 2));
      targetCamY = Math.max(380, Math.min(560, (minY + maxY) / 2 - 20));
      const spanX = Math.max(500, (maxX - minX) * 1.55);
      const spanY = Math.max(360, (maxY - minY) * 1.55);
      targetZoom = Math.max(0.65, Math.min(1.2, Math.min(canvas.width / spanX, canvas.height / spanY)));
    }
  }

  camX += (targetCamX - camX) * 0.08;
  camY += (targetCamY - camY) * 0.08;
  camZoom += (targetZoom - camZoom) * 0.08;

  shake *= 0.88;
  const sx = (Math.random() - 0.5) * shake * camZoom;
  const sy = (Math.random() - 0.5) * shake * camZoom;

  const viewX = canvas.width / 2 - camX * camZoom + sx;
  const viewY = canvas.height / 2 - camY * camZoom + sy;

  ctx.setTransform(camZoom, 0, 0, camZoom, viewX, viewY);
  ctx.save();

  // Cached Dark Minimal Arena Canvas Background
  if (!cachedBgGradient) {
    cachedBgGradient = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    cachedBgGradient.addColorStop(0, '#0a0814');
    cachedBgGradient.addColorStop(1, '#19132c');
  }
  ctx.fillStyle = cachedBgGradient;
  ctx.fillRect(-600, -400, WORLD.w + 1200, WORLD.h + 900);

  draw3DMap(m);

  // Powerups
  if (s && s.pu) {
    for (const pu of s.pu) {
      const bob = Math.sin(now / 260 + pu.id) * 7;
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.t === 'speed' ? '⚡' : pu.t === 'shield' ? '🛡️' : pu.t === 'mega' ? '💥' : '💣', pu.x, pu.y + bob);
    }
  }

  // Players
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
        return `<div class="hp-card ${p.al ? '' : 'dead'}" style="--c:${meta.color || '#8a4fff'}">
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

  // Comic Pops (In-place loop to avoid creating arrays every frame)
  for (let i = comicPops.length - 1; i >= 0; i--) {
    const pop = comicPops[i];
    ctx.save();
    ctx.font = `900 ${Math.round(24 * pop.sc)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = pop.c;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
    pop.y -= 0.6;
    pop.l -= 0.025;
    if (pop.l <= 0) {
      comicPops.splice(i, 1);
    }
  }

  ctx.restore();
}

requestAnimationFrame(frame);
