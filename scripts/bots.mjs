// Clientes de prueba sin interfaz: se unen a una sala por código y caminan al azar.
// Uso: node scripts/bots.mjs CODIGO [n] [url]
import { io } from 'socket.io-client';

const [code, nArg, url = 'http://localhost:3000'] = process.argv.slice(2);
const n = Number(nArg) || 3;
const PROTOCOL = 8;
for (let i = 0; i < n; i++) {
  const s = io(url, { transports: ['websocket'] });
  let seq = 0;
  let dir = [0, 0];
  let ready = false;
  s.on('connect', () => s.emit('hello', { v: PROTOCOL, name: `Bot ${i + 1}` }));
  s.on('welcome', () => { ready = true; s.emit('join', { code, name: `Bot ${i + 1}` }); });
  s.on('room', (r) => { if (r) s.emit('loaded', { mapId: r.mapId }); });
  s.on('gstart', (g) => setTimeout(() => s.emit('loaded', { mapId: g.mapId }), 500));
  s.on('err', (e) => console.log(`bot${i}`, e.msg));
  setInterval(() => {
    if (!ready) return;
    if (Math.random() < 0.05) dir = [Math.round((Math.random() * 2 - 1) * 100), Math.round((Math.random() * 2 - 1) * 100)];
    s.emit('inp', { s: seq + 1, d: [dir[0], dir[1], dir[0], dir[1]] });
    seq += 2;
  }, 66);
}
