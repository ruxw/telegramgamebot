import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { Room } from './rooms/room.js';
import { validateInitData } from './telegram/auth.js';
import { startBot } from './telegram/bot.js';
import { db } from './db.js';
import { GAME_MODES, TITLES, IN_GAME_COLLECTIBLES, COSMETICS, calcLevel } from '../../shared/modes.js';

// Load .env if present
try {
  for (const l of fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
let botUsername = process.env.BOT_USERNAME || '';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

// Proxy Telegram profile photo (avoids CORS for client)
app.get('/api/pfp/:userId', async (req, res) => {
  if (!BOT_TOKEN) return res.status(404).json({ ok: false });
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${req.params.userId}&limit=1`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const photos = j.result?.photos;
    if (!photos || photos.length === 0 || photos[0].length === 0) {
      return res.status(404).json({ ok: false, error: 'no_photo' });
    }
    const fid = photos[0][0].file_id;
    const r2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fid}`, { signal: AbortSignal.timeout(5000) });
    const j2 = await r2.json();
    const fp = j2.result?.file_path;
    if (!fp) return res.status(404).json({ ok: false, error: 'no_file_path' });
    const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fp}`, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) return res.status(404).json({ ok: false });
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(buffer);
  } catch (err) {
    console.error('Error fetching pfp for user:', req.params.userId, err.message);
    res.status(500).json({ ok: false });
  }
});

// Telegram Gifts API endpoint (getUserGifts)
app.get('/api/gifts/:userId', async (req, res) => {
  if (!BOT_TOKEN) return res.json({ ok: true, gifts: [] });
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserGifts?user_id=${req.params.userId}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    if (j.ok && j.result?.gifts) {
      return res.json({ ok: true, gifts: j.result.gifts });
    }
    res.json({ ok: true, gifts: [] });
  } catch (err) {
    res.json({ ok: true, gifts: [] });
  }
});

// Database API: Player profile
app.get('/api/player/:key', (req, res) => {
  const p = db.getPlayer(req.params.key);
  const prog = calcLevel(p.xp);
  res.json({ ok: true, profile: { ...p, ...prog } });
});

app.post('/api/player/:key', (req, res) => {
  const p = db.updatePlayer(req.params.key, req.body || {});
  const prog = calcLevel(p.xp);
  res.json({ ok: true, profile: { ...p, ...prog } });
});

// Mode Leaderboards
app.get('/api/leaderboard/:mode', (req, res) => {
  const lb = db.getModeLeaderboard(req.params.mode);
  res.json({ ok: true, leaderboard: lb });
});

app.get('/health', (_q, r) => r.json({ ok: true, game: 'Gang Beasts Telegram Game' }));
app.get('/config', (_q, r) => r.json({
  title: 'Gang Beasts',
  telegramRequired: !!BOT_TOKEN,
  bot: botUsername,
  modes: GAME_MODES,
  cosmetics: COSMETICS,
  titles: TITLES,
  collectibles: IN_GAME_COLLECTIBLES
}));

const groupRooms = new Map(); // telegram group id -> room code
const rooms = new Map();      // code -> Room
const playerRoom = new Map(); // key -> code
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => {
  let c;
  do {
    c = Array.from({ length: 5 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
  } while (rooms.has(c));
  return c;
};
const clean = s => String(s || 'Beast').replace(/[^\w \-.]/g, '').trim().slice(0, 16) || 'Beast';

io.on('connection', socket => {
  let key = null, name = 'Beast', tokens = 150, last = Date.now();
  let playerCustom = { color: '#8a4fff', hat: 'crown', face: 'cool', outfit: 'none', pose: 'flex' };

  const allow = () => {
    const n = Date.now();
    tokens = Math.min(150, tokens + (n - last) * 0.15);
    last = n;
    return tokens-- >= 1;
  };
  const room = () => rooms.get(playerRoom.get(key));

  const leave = (silent = false) => {
    const r = room();
    if (!r) return;
    socket.leave(r.code);
    r.removePlayer(key, true);
    playerRoom.delete(key);
    if (!silent) r.broadcastRoom();
  };

  const enter = (r, ack) => {
    if (playerRoom.get(key) !== r.code) leave(true);
    const p = r.addPlayer(key, name, socket.id, playerCustom);
    if (!p) return ack?.({ ok: false, error: 'Room is full or match is already in progress' });
    playerRoom.set(key, r.code);
    socket.join(r.code);
    ack?.({ ok: true, pid: p.pid, room: r.publicState() });
    r.broadcastRoom();
  };

  let spUsed = false;
  const resolveStart = sp => {
    if (!sp || typeof sp !== 'string') return null;
    if (/^watch_live_g_[A-Za-z0-9_\-]{1,32}$/.test(sp)) {
      const gid = sp.replace('watch_live_g_', '');
      const code = groupRooms.get(gid);
      return rooms.get(code) || null;
    }
    if (/^watch_[A-Za-z0-9]{3,8}$/.test(sp)) {
      const code = sp.slice(6).toUpperCase();
      return rooms.get(code) || null;
    }
    if (/^r_[A-Za-z0-9]{3,8}$/.test(sp)) {
      const code = sp.slice(2).toUpperCase();
      return rooms.get(code) || null;
    }
    if (/^g_[A-Za-z0-9_\-]{1,32}$/.test(sp)) {
      const gid = sp.slice(2);
      let r = rooms.get(groupRooms.get(gid));
      if (!r || r.phase !== 'lobby' || r.players.size >= r.max) {
        r = new Room(genCode(), io, { max: 4, isPublic: false, groupId: gid });
        rooms.set(r.code, r);
        groupRooms.set(gid, r.code);
      }
      return r;
    }
    return null;
  };

  socket.on('hello', (d, ack) => {
    if (!d || !allow()) return ack?.({ ok: false });
    let sp = '';
    let tgUser = null;

    if (BOT_TOKEN) {
      tgUser = validateInitData(d.initData, BOT_TOKEN);
      if (!tgUser) return ack?.({ ok: false, error: 'Please open this game directly inside Telegram.' });
      key = 'tg:' + tgUser.id;
      name = clean(tgUser.name);
      sp = tgUser.startParam || (typeof d.startParam === 'string' ? d.startParam : '');
    } else {
      if (typeof d.key !== 'string' || d.key.length < 8 || d.key.length > 64) return ack?.({ ok: false });
      key = d.key;
      name = clean(d.name);
      sp = typeof d.startParam === 'string' ? d.startParam : '';
    }

    // Load or create player record in persistent DB
    const dbProfile = db.getPlayer(key, {
      name,
      username: tgUser?.username || '',
      pfpUrl: tgUser?.photo_url || '',
      isPremium: !!tgUser?.is_premium
    });

    if (dbProfile.equipped) {
      playerCustom = {
        color: dbProfile.equipped.skin || '#8a4fff',
        hat: dbProfile.equipped.headwear || 'crown',
        face: dbProfile.equipped.face || 'cool',
        outfit: dbProfile.equipped.outfit || 'none',
        pose: dbProfile.equipped.pose || 'flex'
      };
    }

    // Handle Spectator Deeplink
    if (sp && sp.startsWith('watch_')) {
      const targetRoom = resolveStart(sp);
      if (targetRoom) {
        targetRoom.addSpectator(socket.id);
        socket.join(targetRoom.code);
        return ack?.({
          ok: true,
          isSpectator: true,
          room: targetRoom.publicState()
        });
      }
    }

    let r = room();
    if (!r && sp && !spUsed) {
      spUsed = true;
      r = resolveStart(sp);
    }
    if (r) {
      const p = r.addPlayer(key, name, socket.id, playerCustom);
      if (!p) return ack?.({ ok: false, error: 'Room is full or match is already in progress' });
      playerRoom.set(key, r.code);
      socket.join(r.code);
      r.broadcastRoom();
      return ack?.({ ok: true, pid: p.pid, room: r.publicState(), profile: dbProfile });
    }
    ack?.({ ok: true, profile: dbProfile });
  });

  socket.on('update_custom', d => {
    if (!key || !allow()) return;
    if (d?.skin) playerCustom.color = d.skin;
    if (d?.hat) playerCustom.hat = d.hat;
    if (d?.face) playerCustom.face = d.face;
    if (d?.outfit) playerCustom.outfit = d.outfit;
    if (d?.pose) playerCustom.pose = d.pose;

    db.updatePlayer(key, {
      equipped: {
        skin: playerCustom.color,
        headwear: playerCustom.hat,
        face: playerCustom.face,
        outfit: playerCustom.outfit,
        pose: playerCustom.pose
      }
    });

    const r = room();
    const p = r?.players.get(key);
    if (p) {
      p.color = playerCustom.color;
      p.hat = playerCustom.hat;
      p.face = playerCustom.face;
      p.outfit = playerCustom.outfit;
      p.pose = playerCustom.pose;
      r.broadcastRoom();
    }
  });

  socket.on('create', (d, ack) => {
    if (!key || !allow()) return;
    const max = [2, 3, 4, 6].includes(d?.max) ? d.max : 4;
    const r = new Room(genCode(), io, { max, isPublic: false, mapId: d?.map, mode: d?.mode || 'classic' });
    rooms.set(r.code, r);
    enter(r, ack);
  });

  socket.on('join', (d, ack) => {
    if (!key || !allow()) return;
    const r = rooms.get(String(d?.code || '').toUpperCase().trim());
    if (!r) return ack?.({ ok: false, error: 'Room not found. Check the code and try again.' });
    enter(r, ack);
  });

  socket.on('quick', (d, ack) => {
    if (!key || !allow()) return;
    const requestedMode = d?.mode || 'classic';
    let r = [...rooms.values()].find(x => x.isPublic && x.phase === 'lobby' && x.mode === requestedMode && x.players.size < x.max);
    if (!r) {
      r = new Room(genCode(), io, { max: 4, isPublic: true, mode: requestedMode });
      rooms.set(r.code, r);
    }
    enter(r, ack);
  });

  socket.on('fill_ai', (d) => {
    if (!key || !allow()) return;
    const r = room();
    if (r && r.phase === 'lobby') {
      r.fillWithAI(d?.difficulty || 'advanced', d?.archetype || 'aggressive');
    }
  });

  socket.on('set_map', mapId => {
    if (key && allow()) room()?.setMap(mapId);
  });

  socket.on('set_mode', modeId => {
    if (key && allow()) room()?.setMode(modeId);
  });

  socket.on('ready', v => {
    if (key && allow()) room()?.setReady(key, v);
  });

  socket.on('input', d => {
    if (key && allow()) room()?.setInput(key, d);
  });

  socket.on('leave', () => {
    if (key && allow()) leave(false);
  });

  socket.on('disconnect', () => {
    if (!key) return;
    const r = room();
    if (!r) return;
    r.removePlayer(key, false);
    r.removeSpectator(socket.id);
    r.broadcastRoom();
  });
});

// Periodic room cleanup
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const anyone = [...r.players.values()].some(p => p.connected || (now - p.dcAt < 45000));
    if ((!anyone && now - r.touched > 45000) || now - r.touched > 3600000) {
      r.destroy();
      rooms.delete(code);
      for (const [k, c] of playerRoom) {
        if (c === code) playerRoom.delete(k);
      }
      for (const [gid, c] of groupRooms) {
        if (c === code) groupRooms.delete(gid);
      }
    }
  }
}, 15000);

server.listen(PORT, () => console.log(`Gang Beasts Game server running on :${PORT}`));

if (BOT_TOKEN && PUBLIC_URL.startsWith('https://')) {
  startBot({
    token: BOT_TOKEN,
    publicUrl: PUBLIC_URL,
    onUsername: u => { botUsername = u; }
  }).catch(e => console.error('Bot failed to start:', e.message));
} else if (BOT_TOKEN) {
  console.warn('BOT_TOKEN is set but PUBLIC_URL is not an https:// URL - Telegram bot polling not started');
}
