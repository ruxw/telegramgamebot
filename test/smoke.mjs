import { io } from 'socket.io-client';
import { spawn } from 'child_process';
const srv = spawn('node', ['server/src/index.js'], { env: { ...process.env, PORT: 3111 }, stdio: 'inherit' });
await new Promise(r => setTimeout(r, 800));
const mk = (name) => new Promise(res => { const s = io('http://localhost:3111'); s.name = name; s.emit('hello', { key: 'key-' + name + '-12345', name }, r => { s.pid = r.pid; res(s); }); });
const a = await mk('Alice'), b = await mk('Bob');
const ack = (s, ev, d) => new Promise(r => s.emit(ev, d, r));
const cr = await ack(a, 'create', { max: 2 }); a.pid = cr.pid; console.log('create', cr.ok, cr.room.code);
const jr = await ack(b, 'join', { code: cr.room.code }); b.pid = jr.pid; console.log('join', jr.ok, 'pids', a.pid, b.pid);
let snaps = 0, last = null, result = null, fx = 0, phases = new Set();
a.on('snap', s => { snaps++; last = s; phases.add(s.ph); }); a.on('fx', () => fx++); a.on('result', r => result = r);
a.emit('ready', true); b.emit('ready', true);
await new Promise(r => setTimeout(r, 3600));
console.log('phases', [...phases], 'snaps', snaps);
// Alice runs at Bob and punches repeatedly; Bob runs right off the edge to test elimination.
const t0 = Date.now(); let n = 0;
const iv = setInterval(() => {
  const me = last?.p.find(p => p.i === a.pid), bob = last?.p.find(p => p.i === b.pid);
  if (me && bob?.al) a.emit('input', { x: Math.sign(bob.x - me.x) * (Math.abs(bob.x - me.x) > 50 ? 1 : 0), j: 0, p: (n++ % 10) < 2 ? 1 : 0, g: 0 });
}, 33);
await new Promise(r => { const c = setInterval(() => { if (result || Date.now() - t0 > 25000) { clearInterval(c); r(); } }, 200); });
clearInterval(iv);
const me = last.p.find(p => p.i === a.pid), bob = last.p.find(p => p.i === b.pid);
console.log('fx events', fx, 'bob', bob, 'alice damage', me?.d);
console.log('result', result);
console.log(fx > 0 ? 'COMBAT OK' : 'NO COMBAT');
srv.kill(); process.exit(0);
