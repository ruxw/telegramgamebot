import Matter from 'matter-js';
import { MAPS } from '../../../shared/maps.js';

const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;
const COLORS = ['#ff4d6d', '#4dd2ff', '#ffd23f', '#7cff6b', '#b5179e', '#ff7b00', '#ff70a6', '#00f5d4'];
const MATCH_MS = 120000, COUNTDOWN_MS = 3000, RESULT_MS = 6000;
const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const r1 = n => Math.round(n * 10) / 10;

export class Room {
  constructor(code, io, { max = 4, isPublic = false, mapId = 'rooftop' } = {}) {
    this.code = code;
    this.io = io;
    this.max = Math.max(2, Math.min(6, max || 4));
    this.isPublic = !!isPublic;
    this.mapId = MAPS[mapId] ? mapId : 'rooftop';
    this.mode = 'lms'; // Last Man Standing
    this.players = new Map();
    this.phase = 'lobby';
    this.nextPid = 1;
    this.loop = null;
    this.tickN = 0;
    this.touched = Date.now();
    this.engine = null;
    this.statics = [];
    this.probe = null;
    this.powerups = []; // active powerups: { id, type, x, y, active }
    this.nextPowerId = 1;
    this.lastPowerupSpawn = 0;
  }

  get map() {
    return MAPS[this.mapId] || MAPS.rooftop;
  }

  setMap(mapId) {
    if (this.phase !== 'lobby' || !MAPS[mapId]) return false;
    this.mapId = mapId;
    this.touched = Date.now();
    this.broadcastRoom();
    return true;
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
      ready: false,
      connected: true,
      dcAt: 0,
      input: { x: 0, j: 0, p: 0, g: 0 }
    };
    this.players.set(key, p);
    this.touched = Date.now();
    return p;
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
      // Mark socket disconnected with timestamp (grace period for app minimize / screen lock)
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
      powerups: this.powerups,
      players: [...this.players.values()].map(p => {
        // Generous 45-second grace period when minimized before showing offline
        const isOffline = !p.connected && (now - p.dcAt > 45000);
        const isMinimized = !p.connected && !isOffline;
        return {
          pid: p.pid,
          name: p.name,
          color: p.color,
          hat: p.hat || 'none',
          ready: p.ready,
          connected: !isOffline,
          minimized: isMinimized
        };
      })
    };
  }

  broadcastRoom() {
    this.io.to(this.code).emit('room', this.publicState());
  }

  maybeStart() {
    const now = Date.now();
    // Allow players who are currently connected or temporarily minimized within grace period
    const ps = [...this.players.values()].filter(p => p.connected || (now - p.dcAt <= 45000));
    if (this.phase === 'lobby' && ps.length >= 2 && ps.every(p => p.ready)) {
      this.startMatch();
    }
    this.broadcastRoom();
  }

  startMatch() {
    this.cleanupPhysics();
    const engine = this.engine = Engine.create({ gravity: { y: 1 } });
    this.statics = this.map.platforms.map(s => Bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, friction: 0.9 }));
    this.probe = Bodies.rectangle(0, 0, 26, 6, { isSensor: true });
    Composite.add(engine.world, this.statics);

    let i = 0;
    const now = Date.now();
    const activePlayers = [...this.players.values()].filter(p => p.connected || (now - p.dcAt <= 45000));
    for (const p of activePlayers) {
      const sp = this.map.spawns[i % this.map.spawns.length];
      const g = -(++i);
      p.torso = Bodies.rectangle(sp.x, sp.y, 38, 56, {
        density: 0.002,
        friction: 0.5,
        frictionAir: 0.02,
        chamfer: { radius: 10 },
        collisionFilter: { group: g }
      });
      p.head = Bodies.circle(sp.x, sp.y - 44, 20, {
        density: 0.0008,
        frictionAir: 0.02,
        collisionFilter: { group: g }
      });
      p.neck = Constraint.create({
        bodyA: p.torso,
        pointA: { x: 0, y: -30 },
        bodyB: p.head,
        pointB: { x: 0, y: 18 },
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
        megaPunch: 0
      });
    }

    this.powerups = [];
    this.lastPowerupSpawn = Date.now();
    this.phase = 'countdown';
    this.phaseEnd = Date.now() + COUNTDOWN_MS;
    this.tickN = 0;
    if (this.loop) clearInterval(this.loop);
    this.loop = setInterval(() => this.step(), 1000 / 60);
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
        // Only clean up if disconnected longer than 45 seconds
        if (!p.connected && (now - p.dcAt > 45000)) this.players.delete(k);
      }
    }
  }

  grounded(p) {
    if (!this.probe || !p.torso) return false;
    Body.setPosition(this.probe, { x: p.torso.position.x, y: p.torso.position.y + 31 });
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
    const t = this.nearest(p, 75);
    if (!t || !t.torso) return;

    if (t.shield > 0) {
      // Shield blocks damage increase
      this.fx('hit', t.torso.position.x, t.torso.position.y, 2);
      return;
    }
    const megaMult = 1 + (p.megaPunch > 0 ? 2 : 0);
    t.damage += 10 * megaMult;
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
      const throwSpeed = 14 + t.damage * 0.08;
      Body.setVelocity(t.torso, { x: p.facing * throwSpeed, y: -9 });
      Body.setAngularVelocity(t.torso, p.facing * 0.35);
      t.stunUntil = now + 950;
      t.damage += 8;
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
    p.onGround = this.grounded(p);

    if (!stunned) {
      const max = (p.grab ? 3.2 : 5.0) * (p.onGround ? 1 : 0.82) * (1 + (p.speedBoost > 0 ? 1.5 : 0));
      const k = p.onGround ? 0.24 : 0.09;
      Body.setVelocity(tb, {
        x: tb.velocity.x + (inp.x * max - tb.velocity.x) * k,
        y: tb.velocity.y
      });
      if (inp.x) p.facing = Math.sign(inp.x);

      Body.setAngularVelocity(tb, tb.angularVelocity * 0.8 - wrap(tb.angle) * 0.06);

      if (inp.j && p.onGround && now - p.lastJump > 260) {
        Body.setVelocity(tb, { x: tb.velocity.x, y: -8.8 });
        p.lastJump = now;
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
  }

  step() {
    const now = Date.now();
    this.tickN++;

    if (this.phase === 'countdown') {
      if (now >= this.phaseEnd) {
        this.phase = 'playing';
        this.phaseEnd = now + MATCH_MS;
        this.broadcastRoom();
      }
    } else if (this.phase === 'playing') {
      for (const p of [...this.players.values()].filter(q => q.alive)) {
        if (!p.connected) {
          p.input = { x: 0, j: 0, p: 0, g: 0 };
          // Generous 35s grace period before eliminating a minimized player mid-fight
          if (now - p.dcAt > 35000) {
            this.eliminate(p);
            continue;
          }
        }
        this.control(p, now);
      }

      if (this.engine) Engine.update(this.engine, 1000 / 60);

      // Powerup Spawning (up to 2 concurrent, every 7-8s)
      if (this.powerups.filter(p => p.active).length < 2 && now - this.lastPowerupSpawn > 7500) {
        this.spawnPowerup();
        this.lastPowerupSpawn = now;
      }

      // Powerup Collection & Expiry
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
      for (const p of this.players.values()) {
        if (p.speedBoost > 0) p.speedBoost = Math.max(0, p.speedBoost - 16.6);
        if (p.shield > 0) p.shield = Math.max(0, p.shield - 16.6);
        if (p.megaPunch > 0) p.megaPunch = Math.max(0, p.megaPunch - 16.6);
      }

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
        left.sort((a, b) => a.damage - b.damage);
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
    this.io.to(this.code).emit('result', {
      winner: winner ? winner.pid : null,
      name: winner ? winner.name : null
    });
    this.broadcastRoom();
  }

  snapshot(now) {
    return {
      ph: this.phase,
      cd: Math.max(0, Math.ceil((this.phaseEnd - now) / 1000)),
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
        f: (now < p.stunUntil ? 1 : 0) | (p.grab ? 2 : 0) | (now < p.punchUntil ? 4 : 0),
        fc: p.facing,
        h: p.hat || 'none'
      } : { i: p.pid, al: 0 }),
      pu: this.powerups.filter(p => p.active).map(p => ({ id: p.id, t: p.type, x: Math.round(p.x), y: Math.round(p.y) }))
    };
  }

  destroy() {
    this.stopLoop('lobby');
  }
}
