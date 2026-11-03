import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { Room } from './rooms/room.js';
import { validateInitData } from './telegram/auth.js';
import { startBot } from './telegram/bot.js';

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
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

app.get('/health', (_q, r) => r.json({ ok: true, game: 'Gang Beasts Telegram Game' }));
app.get('/config', (_q, r) => r.json({
  title: 'Gang Beasts',
  telegramRequired: !!BOT_TOKEN,
  bot: botUsername
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
  let playerCustom = { color: '', hat: 'none' };

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
    if (/^r_[A-Za-z0-9]{3,8}$/.test(sp)) {
      const code = sp.slice(2).toUpperCase();
      return rooms.get(code) || null;
    }
    if (/^g_[A-Za-z0-9_\-]{1,32}$/.test(sp)) {
      const gid = sp.slice(2);
      let r = rooms.get(groupRooms.get(gid));
      if (!r || r.phase !== 'lobby' || r.players.size >= r.max) {
        r = new Room(genCode(), io, { max: 4, isPublic: false });
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
    if (typeof d.skin === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.skin)) playerCustom.color = d.skin;
    if (typeof d.hat === 'string' && ['none', 'crown', 'shades', 'cowboy', 'viking', 'bow'].includes(d.hat)) playerCustom.hat = d.hat;

    if (BOT_TOKEN) {
      const u = validateInitData(d.initData, BOT_TOKEN);
      if (!u) return ack?.({ ok: false, error: 'Please open this game directly inside Telegram.' });
      key = 'tg:' + u.id;
      name = clean(u.name);
      sp = u.startParam || (typeof d.startParam === 'string' ? d.startParam : '');
    } else {
      if (typeof d.key !== 'string' || d.key.length < 8 || d.key.length > 64) return ack?.({ ok: false });
      key = d.key;
      name = clean(d.name);
      sp = typeof d.startParam === 'string' ? d.startParam : '';
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
      return ack?.({ ok: true, pid: p.pid, room: r.publicState() });
    }
    ack?.({ ok: true });
  });

  socket.on('update_custom', d => {
    if (!key || !allow()) return;
    if (typeof d?.skin === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.skin)) playerCustom.color = d.skin;
    if (typeof d?.hat === 'string') playerCustom.hat = d.hat;
    const r = room();
    const p = r?.players.get(key);
    if (p) {
      if (playerCustom.color) p.color = playerCustom.color;
      if (playerCustom.hat) p.hat = playerCustom.hat;
      r.broadcastRoom();
    }
  });

  socket.on('create', (d, ack) => {
    if (!key || !allow()) return;
    const max = [2, 3, 4, 6].includes(d?.max) ? d.max : 4;
    const r = new Room(genCode(), io, { max, isPublic: false, mapId: d?.map });
    rooms.set(r.code, r);
    enter(r, ack);
  });

  socket.on('join', (d, ack) => {
    if (!key || !allow()) return;
    const r = rooms.get(String(d?.code || '').toUpperCase().trim());
    if (!r) return ack?.({ ok: false, error: 'Room not found. Check the code and try again.' });
    enter(r, ack);
  });

  socket.on('quick', (_d, ack) => {
    if (!key || !allow()) return;
    let r = [...rooms.values()].find(x => x.isPublic && x.phase === 'lobby' && x.players.size < x.max);
    if (!r) {
      r = new Room(genCode(), io, { max: 4, isPublic: true });
      rooms.set(r.code, r);
    }
    enter(r, ack);
  });

  socket.on('set_map', mapId => {
    if (key && allow()) room()?.setMap(mapId);
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
