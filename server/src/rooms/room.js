import Matter from 'matter-js';
import { MAPS } from '../../../shared/maps.js';
import { GAME_MODES } from '../../../shared/modes.js';
import { AIController } from './ai.js';
import { getBroadcastService } from '../telegram/bot.js';
import { db } from '../db.js';

const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;
const COLORS = ['#8a4fff', '#ff4d6d', '#4dd2ff', '#ffd23f', '#7cff6b', '#ff7b00', '#1a1829', '#00f5d4'];
const MATCH_MS = 90000, COUNTDOWN_MS = 3000, RESULT_MS = 6000;
const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const r1 = n => Math.round(n * 10) / 10;

export class Room {
  constructor(code, io, { max = 4, isPublic = false, mapId = 'rooftop', mode = 'classic', groupId = null } = {}) {
    this.code = code;
    this.io = io;
    this.max = Math.max(2, Math.min(6, max || 4));
    this.isPublic = !!isPublic;
    this.mapId = MAPS[mapId] ? mapId : 'rooftop';
    this.mode = GAME_MODES[mode] ? mode : 'classic';
    this.groupId = groupId;
    this.players = new Map();
    this.spectators = new Set();
    this.aiControllers = [];
    this.phase = 'lobby';
    this.nextPid = 1;
    this.loop = null;
    this.tickN = 0;
    this.touched = Date.now();
    this.engine = null;
    this.statics = [];
    this.probe = null;
    this.powerups = [];
    this.nextPowerId = 1;
    this.lastPowerupSpawn = 0;
    this.zonePoints = new Map(); // For King of the Arena
  }

  get map() {
    return MAPS[this.mapId] || MAPS.rooftop;
  }

  get modeName() {
    return GAME_MODES[this.mode]?.name || 'Classic Brawl';
  }

  setMap(mapId) {
    if (this.phase !== 'lobby' || !MAPS[mapId]) return false;
    this.mapId = mapId;
    this.touched = Date.now();
    this.broadcastRoom();
    return true;
  }

  setMode(modeId) {
    if (this.phase !== 'lobby' || !GAME_MODES[modeId]) return false;
    this.mode = modeId;
    this.touched = Date.now();
    this.broadcastRoom();
    return true;
  }

  addSpectator(socketId) {
    this.spectators.add(socketId);
    this.io.to(socketId).emit('spectator_joined', {
      code: this.code,
      spectatorsCount: this.spectators.size,
      room: this.publicState()
    });
    this.broadcastRoom();
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
    this.broadcastRoom();
  }

  spawnPowerup() {
    const types = ['speed', 'shield', 'mega', 'bomb'];
    const map = this.map;
    const plat = map.platforms[Math.floor(Math.random() * map.platforms.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const pu = {
      id: this.nextPowerId++,
      type,
      x: plat.x + (Math.random() - 0.5) * (plat.w * 0.6),
      y: plat.y - plat.h / 2 - 20,
      active: true
    };
    this.powerups.push(pu);
    return pu;
  }

  addPlayer(key, name, sid, customData = {}) {
    let p = this.players.get(key);
    if (p) {
      p.sid = sid;
      p.name = name || p.name;
      p.connected = true;
      p.dcAt = 0;
      if (customData.color) p.color = customData.color;
      if (customData.hat) p.hat = customData.hat;
      if (customData.face) p.face = customData.face;
      if (customData.outfit) p.outfit = customData.outfit;
      if (customData.pose) p.pose = customData.pose;
      if (customData.title) p.title = customData.title;
      if (customData.level) p.level = customData.level;
      if (customData.pfpUrl) p.pfpUrl = customData.pfpUrl;
      if (customData.username) p.username = customData.username;
      this.touched = Date.now();
      return p;
    }
    if (this.phase !== 'lobby' || this.players.size >= this.max) return null;
    p = {
      key,
      pid: this.nextPid++,
      name,
      sid,
      color: customData.color || COLORS[(this.players.size) % COLORS.length],
      hat: customData.hat || 'none',
      face: customData.face || 'normal',
      outfit: customData.outfit || 'none',
      pose: customData.pose || 'stand',
      title: customData.title || 'Street Brawler',
      level: customData.level || 1,
      pfpUrl: customData.pfpUrl || '',
      username: customData.username || '',
      isAI: !!customData.isAI,
      aiDifficulty: customData.aiDifficulty || 'advanced',
      ready: false,
      connected: true,
      dcAt: 0,
      kos: 0,
      score: 0,
      input: { x: 0, j: 0, p: 0, g: 0 }
    };
    this.players.set(key, p);
    this.touched = Date.now();
    return p;
  }

  fillWithAI(difficulty = 'advanced', archetype = 'aggressive') {
    while (this.players.size < this.max) {
      const aiPid = this.nextPid++;
      const names = ['TitanBot', 'ShadowAI', 'RooftopMenace', 'YeetBot', 'IronClad', 'GladiatorAI'];
      const botTitles = ['Titan Slayer 👹', 'Arena Gladiator ⚔️', 'Yeet Enthusiast 🚀', 'Knockout Artist 💥', 'Street Brawler 🥊'];
      const name = names[aiPid % names.length];
      const aiKey = 'ai:' + aiPid;
      const p = {
        key: aiKey,
        pid: aiPid,
        name: `🤖 ${name}`,
        sid: null,
        color: COLORS[aiPid % COLORS.length],
        hat: ['crown', 'viking', 'cowboy', 'shades', 'headphones'][aiPid % 5],
        face: 'evil',
        outfit: 'none',
        pose: 'boxing',
        title: botTitles[aiPid % botTitles.length],
        level: Math.floor(Math.random() * 8) + 5,
        pfpUrl: '',
        username: `@bot_${name.toLowerCase()}`,
        isAI: true,
        aiDifficulty: difficulty,
        aiArchetype: archetype,
        ready: true,
        connected: true,
        dcAt: 0,
        kos: 0,
        score: 0,
        input: { x: 0, j: 0, p: 0, g: 0 }
      };
      this.players.set(aiKey, p);
    }
    this.maybeStart();
    this.broadcastRoom();
  }

  setMode(mode) {
    if (this.phase !== 'lobby' || !GAME_MODES[mode]) return;
    this.mode = mode;
    this.modeName = GAME_MODES[mode].name;
    this.broadcastRoom();
  }

  removePlayer(key, explicitLeave = false) {
    const p = this.players.get(key);
    if (!p) return;
    if (explicitLeave) {
      if (p.grab) this.release(p);
      for (const o of this.players.values()) if (o.grab && o.grab.target === p) this.release(o);
      if (this.phase === 'playing' && p.alive) this.eliminate(p);
      this.players.delete(key);
    } else {
      p.connected = false;
      p.dcAt = Date.now();
    }
    this.touched = Date.now();
  }

  setReady(key, v) {
    const p = this.players.get(key);
    if (!p || this.phase === 'playing' || this.phase === 'countdown') return;
    p.ready = !!v;
    this.touched = Date.now();
    this.maybeStart();
  }

  setInput(key, d) {
    const p = this.players.get(key);
    if (!p || !d) return;
    const x = Number(d.x);
    p.input = {
      x: Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0,
      j: d.j ? 1 : 0,
      p: d.p ? 1 : 0,
      g: d.g ? 1 : 0
    };
  }

  publicState() {
    const now = Date.now();
    return {
      code: this.code,
      phase: this.phase,
      max: this.max,
      map: this.mapId,
      mode: this.mode,
      modeName: this.modeName,
      spectators: this.spectators.size,
      powerups: this.powerups,
      players: [...this.players.values()].map(p => {
        const isOffline = !p.connected && (now - p.dcAt > 45000);
        const isMinimized = !p.connected && !isOffline;
        return {
          pid: p.pid,
          name: p.name,
          color: p.color,
          hat: p.hat || 'none',
          face: p.face || 'normal',
          outfit: p.outfit || 'none',
          pose: p.pose || 'stand',
          title: p.title || 'Street Brawler',
          level: p.level || 1,
          pfpUrl: p.pfpUrl || '',
          username: p.username || '',
          isAI: p.isAI,
          ready: p.ready,
          connected: !isOffline,
          minimized: isMinimized,
          kos: p.kos || 0,
          score: p.score || 0
        };
      })
    };
  }

  broadcastRoom() {
    this.io.to(this.code).emit('room', this.publicState());
  }

  maybeStart() {
    const now = Date.now();
    const ps = [...this.players.values()].filter(p => p.connected || (now - p.dcAt <= 45000));
    if (this.phase === 'lobby' && ps.length >= 2 && ps.every(p => p.ready)) {
      this.startMatch();
    }
    this.broadcastRoom();
  }

  startMatch() {
    this.cleanupPhysics();
    const gravityY = this.mode === 'chaos' ? 0.45 : 1;
    const engine = this.engine = Engine.create({ gravity: { y: gravityY } });
    this.statics = this.map.platforms.map(s => Bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, friction: 0.9 }));
    this.probe = Bodies.rectangle(0, 0, 32, 12, { isSensor: true });
    Composite.add(engine.world, this.statics);

    // Initialize AI controllers for any bot players
    this.aiControllers = [];

    let i = 0;
    const now = Date.now();
    const activePlayers = [...this.players.values()].filter(p => p.connected || (now - p.dcAt <= 45000));
    for (const p of activePlayers) {
      const sp = this.map.spawns[i % this.map.spawns.length];
      const g = -(++i);
      const isBoss = this.mode === 'boss' && p.isAI && i === activePlayers.length;

      p.torso = Bodies.rectangle(sp.x, sp.y, isBoss ? 56 : 38, isBoss ? 80 : 56, {
        density: isBoss ? 0.006 : 0.002,
        friction: 0.5,
        frictionAir: 0.02,
        chamfer: { radius: 10 },
        collisionFilter: { group: g }
      });
      p.head = Bodies.circle(sp.x, sp.y - (isBoss ? 60 : 44), isBoss ? 30 : 20, {
        density: isBoss ? 0.002 : 0.0008,
        frictionAir: 0.02,
        collisionFilter: { group: g }
      });
      p.neck = Constraint.create({
        bodyA: p.torso,
        pointA: { x: 0, y: isBoss ? -42 : -30 },
        bodyB: p.head,
        pointB: { x: 0, y: isBoss ? 24 : 18 },
        stiffness: 0.5,
        length: 2,
        damping: 0.1
      });
      Composite.add(engine.world, [p.torso, p.head, p.neck]);
      Object.assign(p, {
        alive: true,
        damage: 0,
        stamina: 100,
        facing: (i % 2 === 1) ? 1 : -1,
        stunUntil: 0,
        punchUntil: 0,
        lastPunch: 0,
        lastJump: 0,
        prevP: 0,
        grab: null,
        onGround: false,
        speedBoost: 0,
        shield: 0,
        megaPunch: 0,
        isBoss
      });

      if (p.isAI) {
        this.aiControllers.push(new AIController(p, this, p.aiDifficulty || 'advanced', p.aiArchetype || 'aggressive'));
      }
    }

    this.powerups = [];
    this.lastPowerupSpawn = Date.now();
    this.phase = 'countdown';
    this.phaseEnd = Date.now() + COUNTDOWN_MS;
    this.tickN = 0;
    if (this.loop) clearInterval(this.loop);
    this.loop = setInterval(() => this.step(), 1000 / 60);

    // Announce match start in Telegram group if applicable
    getBroadcastService()?.onMatchStart(this);
  }

  cleanupPhysics() {
    if (this.engine) {
      try {
        Composite.clear(this.engine.world, false);
        Engine.clear(this.engine);
      } catch {}
      this.engine = null;
      this.statics = [];
      this.probe = null;
    }
  }

  stopLoop(phase) {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
    this.phase = phase;
    this.cleanupPhysics();
    if (phase === 'lobby') {
      const now = Date.now();
      for (const [k, p] of this.players) {
        p.ready = false;
        p.grab = null;
        if (!p.connected && (now - p.dcAt > 45000)) this.players.delete(k);
      }
    }
  }

  grounded(p) {
    if (!this.probe || !p.torso) return false;
    const offsetY = p.isBoss ? 46 : 33;
    Body.setPosition(this.probe, { x: p.torso.position.x, y: p.torso.position.y + offsetY });
    const others = [...this.players.values()].filter(o => o !== p && o.alive && o.torso).map(o => o.torso);
    return Query.collides(this.probe, this.statics.concat(others)).length > 0;
  }

  nearest(p, range) {
    let best = null, bd = range;
    for (const o of this.players.values()) {
      if (o === p || !o.alive || !o.torso || !p.torso) continue;
      const dx = o.torso.position.x - p.torso.position.x;
      const dy = o.torso.position.y - p.torso.position.y;
      const d = Math.hypot(dx, dy);
      if (d < bd && (dx * p.facing > -8 || d < 35)) {
        best = o;
        bd = d;
      }
    }
    return best;
  }

  fx(k, x, y, pw) {
    this.io.to(this.code).emit('fx', { k, x: Math.round(x), y: Math.round(y), p: pw });
  }

  punch(p, now) {
    if (p.stamina < 12 || now - p.lastPunch < 420) return;
    p.lastPunch = now;
    p.stamina -= 12;
    p.punchUntil = now + 160;
    const t = this.nearest(p, p.isBoss ? 110 : 75);
    if (!t || !t.torso) return;

    if (t.shield > 0) {
      this.fx('hit', t.torso.position.x, t.torso.position.y, 2);
      return;
    }
    const megaMult = (1 + (p.megaPunch > 0 ? 2 : 0)) * (p.isBoss ? 1.8 : 1);
    t.damage += 10 * megaMult;
    p.score = (p.score || 0) + Math.round(10 * megaMult);
    t.lastHitBy = p;
    const kb = (6 + t.damage * 0.14) * megaMult;
    Body.setVelocity(t.torso, { x: p.facing * kb, y: -3 - kb * 0.35 });
    Body.setAngularVelocity(t.torso, p.facing * 0.28);
    t.stunUntil = now + 240 + t.damage * 8;
    this.fx('hit', t.torso.position.x, t.torso.position.y, kb);
  }

  tryGrab(p) {
    const t = this.nearest(p, 70);
    if (!t || !t.torso || !p.torso) return;
    for (const o of this.players.values()) {
      if (o.grab && o.grab.target === t) return;
    }
    if (!this.engine?.world) return;
    const c = Constraint.create({
      bodyA: p.torso,
      bodyB: t.torso,
      length: 44,
      stiffness: 0.3,
      damping: 0.2
    });
    Composite.add(this.engine.world, c);
    p.grab = { c, target: t };
    t.lastHitBy = p;
  }

  release(p) {
    if (!p.grab) return;
    if (this.engine?.world && p.grab.c) {
      try { Composite.remove(this.engine.world, p.grab.c); } catch {}
    }
    p.grab = null;
  }

  throwGrabbed(p, now) {
    if (!p.grab || !p.grab.target || !p.grab.target.alive) {
      this.release(p);
      return;
    }
    const t = p.grab.target;
    this.release(p);
    if (t.torso) {
      const throwSpeed = (14 + t.damage * 0.08) * (p.isBoss ? 1.6 : 1);
      Body.setVelocity(t.torso, { x: p.facing * throwSpeed, y: -9 });
      Body.setAngularVelocity(t.torso, p.facing * 0.35);
      t.stunUntil = now + 950;
      t.damage += 8;
      t.lastHitBy = p;
      p.lastPunch = now;
      p.punchUntil = now + 180;
      this.fx('throw', t.torso.position.x, t.torso.position.y, throwSpeed);
    }
  }

  control(p, now) {
    const tb = p.torso;
    if (!tb) return;
    const inp = p.input;
    const stunned = now < p.stunUntil;
    const isDirectGrounded = this.grounded(p);
    if (isDirectGrounded) p.lastGroundedAt = now;
    // Coyote time: considered grounded if on ground or was grounded within last 120ms
    p.onGround = isDirectGrounded || (now - (p.lastGroundedAt || 0) < 120);

    if (!stunned) {
      const maxSpd = (p.grab ? 3.2 : 5.0) * (p.onGround ? 1 : 0.82) * (1 + (p.speedBoost > 0 ? 1.5 : 0)) * (this.mode === 'chaos' ? 1.5 : 1);
      const k = p.onGround ? 0.24 : 0.09;
      Body.setVelocity(tb, {
        x: tb.velocity.x + (inp.x * maxSpd - tb.velocity.x) * k,
        y: tb.velocity.y
      });
      if (inp.x) p.facing = Math.sign(inp.x);

      Body.setAngularVelocity(tb, tb.angularVelocity * 0.8 - wrap(tb.angle) * 0.06);

      if (inp.j && p.onGround && now - p.lastJump > 260) {
        Body.setVelocity(tb, { x: tb.velocity.x, y: this.mode === 'chaos' ? -12 : -9.5 });
        p.lastJump = now;
        p.lastGroundedAt = 0;
        p.onGround = false;
      }

      if (inp.p && !p.prevP) {
        if (p.grab) this.throwGrabbed(p, now);
        else this.punch(p, now);
      }

      if (inp.g) {
        if (!p.grab && p.stamina > 6) this.tryGrab(p);
      } else {
        this.release(p);
      }
    } else {
      this.release(p);
    }

    p.prevP = inp.p;

    if (p.grab) {
      p.stamina -= 0.22;
      if (p.grab.target && p.grab.target.torso) {
        p.grab.target.stunUntil = Math.max(p.grab.target.stunUntil, now + 200);
        if (inp.j || inp.x) {
          Body.applyForce(p.grab.target.torso, p.grab.target.torso.position, { x: p.facing * 0.001, y: -0.002 });
        }
      }
      if (p.stamina <= 0) this.release(p);
    } else {
      p.stamina = Math.min(100, p.stamina + 0.35);
    }

    p.damage = Math.max(0, p.damage - 0.025);
  }

  eliminate(p) {
    if (!p.alive) return;
    p.alive = false;
    this.release(p);
    for (const o of this.players.values()) {
      if (o.grab && o.grab.target === p) this.release(o);
    }
    if (this.engine?.world && p.torso) {
      try {
        Composite.remove(this.engine.world, [p.torso, p.head, p.neck]);
      } catch {}
    }
    const px = p.torso ? Math.max(40, Math.min(1240, p.torso.position.x)) : 640;
    const py = p.torso ? Math.min(710, p.torso.position.y) : 600;
    this.fx('ko', px, py, 0);

    const killer = p.lastHitBy && p.lastHitBy.alive ? p.lastHitBy : null;
    if (killer) {
      killer.kos = (killer.kos || 0) + 1;
      killer.score = (killer.score || 0) + 100;
    }

    getBroadcastService()?.onKnockout(this, p.name, killer?.name);
  }

  step() {
    const now = Date.now();
    this.tickN++;

    if (this.phase === 'countdown') {
      if (now >= this.phaseEnd) {
        this.phase = 'playing';
        this.phaseEnd = now + (this.mode === 'elimination' ? 60000 : MATCH_MS);
        this.broadcastRoom();
      }
    } else if (this.phase === 'playing') {
      // Step AI controllers
      for (const ai of this.aiControllers) {
        ai.update(now);
      }

      for (const p of [...this.players.values()].filter(q => q.alive)) {
        if (!p.connected && !p.isAI) {
          p.input = { x: 0, j: 0, p: 0, g: 0 };
          if (now - p.dcAt > 35000) {
            this.eliminate(p);
            continue;
          }
        }
        this.control(p, now);
      }

      if (this.engine) Engine.update(this.engine, 1000 / 60);

      // Powerup Spawning
      const spawnInterval = this.mode === 'chaos' ? 4000 : 7500;
      if (this.powerups.filter(p => p.active).length < 3 && now - this.lastPowerupSpawn > spawnInterval) {
        this.spawnPowerup();
        this.lastPowerupSpawn = now;
      }

      // Powerup Collection
      for (const pu of this.powerups) {
        if (!pu.active) continue;
        for (const p of this.players.values()) {
          if (!p.alive || !p.torso) continue;
          const dx = p.torso.position.x - pu.x;
          const dy = p.torso.position.y - pu.y;
          if (Math.hypot(dx, dy) < 46) {
            pu.active = false;
            this.lastPowerupSpawn = now;
            if (pu.type === 'speed') {
              p.speedBoost = (p.speedBoost || 0) + 6500;
            } else if (pu.type === 'shield') {
              p.shield = (p.shield || 0) + 7000;
            } else if (pu.type === 'mega') {
              p.megaPunch = (p.megaPunch || 0) + 8000;
            } else if (pu.type === 'bomb') {
              for (const o of this.players.values()) {
                if (!o.alive || !o.torso || o.key === p.key) continue;
                const bx = o.torso.position.x - pu.x;
                const by = o.torso.position.y - pu.y;
                if (Math.hypot(bx, by) < 190) {
                  o.damage = Math.min(500, (o.damage || 0) + 45);
                  Body.setVelocity(o.torso, {
                    x: (bx > 0 ? 1 : -1) * 16,
                    y: -12
                  });
                  o.stunUntil = now + 650;
                }
              }
              this.fx('bomb', pu.x, pu.y, 30);
            }
            this.io.to(this.code).emit('powerup_collect', { id: pu.id, type: pu.type, pid: p.pid });
            break;
          }
        }
      }
      this.powerups = this.powerups.filter(p => p.active);

      // King of the Arena zone scoring
      if (this.mode === 'king' && this.tickN % 60 === 0) {
        for (const p of this.players.values()) {
          if (p.alive && p.torso && Math.abs(p.torso.position.x - 640) < 140 && p.torso.position.y < 580) {
            p.score = (p.score || 0) + 15;
          }
        }
      }

      // Check map boundaries / falls
      const m = this.map;
      for (const p of this.players.values()) {
        if (!p.alive || !p.torso) continue;
        const { x, y } = p.torso.position;
        if (y > m.killY || x < -m.killX || x > 1280 + m.killX) {
          this.eliminate(p);
        }
      }

      const left = [...this.players.values()].filter(p => p.alive);
      if (left.length <= 1 || now >= this.phaseEnd) {
        // Sort by mode rules: King uses score, others use survival or damage
        if (this.mode === 'king') {
          left.sort((a, b) => (b.score || 0) - (a.score || 0));
        } else {
          left.sort((a, b) => a.damage - b.damage);
        }
        this.finish(left[0] || null);
      }
    } else if (this.phase === 'results') {
      if (now >= this.phaseEnd) {
        this.stopLoop('lobby');
        this.broadcastRoom();
        return;
      }
    }

    if (this.tickN % 2 === 0 && this.phase !== 'lobby') {
      this.io.to(this.code).volatile.emit('snap', this.snapshot(now));
    }
  }

  finish(winner) {
    if (this.phase === 'results') return;
    this.phase = 'results';
    this.phaseEnd = Date.now() + RESULT_MS;

    const winnerPid = winner ? winner.pid : null;
    const winnerName = winner ? winner.name : null;

    this.io.to(this.code).emit('result', {
      winner: winnerPid,
      name: winnerName
    });

    // Record match in server persistent DB
    db.recordMatchResult({
      code: this.code,
      mode: this.mode,
      map: this.mapId,
      groupId: this.groupId,
      winnerKey: winner ? winner.key : null,
      winnerName: winnerName,
      winnerScore: winner ? winner.score : 0,
      timestamp: Date.now()
    });

    // Announce winner to group chat
    getBroadcastService()?.onMatchFinish(this, winner);
    this.broadcastRoom();
  }

  snapshot(now) {
    return {
      ph: this.phase,
      cd: Math.max(0, Math.ceil((this.phaseEnd - now) / 1000)),
      sp: this.spectators.size,
      p: [...this.players.values()].map(p => (p.alive && p.torso && p.head) ? {
        i: p.pid,
        al: 1,
        x: r1(p.torso.position.x),
        y: r1(p.torso.position.y),
        a: Math.round(p.torso.angle * 100) / 100,
        hx: r1(p.head.position.x),
        hy: r1(p.head.position.y),
        d: Math.round(p.damage),
        s: Math.round(p.stamina),
        sc: p.score || 0,
        f: (now < p.stunUntil ? 1 : 0) | (p.grab ? 2 : 0) | (now < p.punchUntil ? 4 : 0),
        fc: p.facing,
        h: p.hat || 'none',
        face: p.face || 'normal',
        isBoss: !!p.isBoss
      } : { i: p.pid, al: 0 }),
      pu: this.powerups.filter(p => p.active).map(p => ({ id: p.id, t: p.type, x: Math.round(p.x), y: Math.round(p.y) }))
    };
  }

  destroy() {
    this.stopLoop('lobby');
  }
}
