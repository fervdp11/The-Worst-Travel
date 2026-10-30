import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { PROTOCOL_VERSION } from '../shared/protocol';
import type { ClientToServer, ServerToClient } from '../shared/protocol';
import { RoomManager } from './room/RoomManager';

const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const here = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIR = resolve(process.env.CLIENT_DIR || join(here, DEV ? '../client' : '../client'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const manager = new RoomManager();

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, ...manager.stats() }));
    return;
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  let file = join(CLIENT_DIR, path);
  if (!file.startsWith(CLIENT_DIR)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(CLIENT_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Compilación del cliente no encontrada. Ejecuta «npm run build».');
    return;
  }
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=604800, immutable',
  });
  createReadStream(file).pipe(res);
}

async function main() {
  let handler: (req: IncomingMessage, res: ServerResponse) => void = serveStatic;
  const httpServer = createServer((req, res) => handler(req, res));
  if (DEV) {
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({ server: { middlewareMode: true, hmr: { server: httpServer } }, appType: 'spa' });
    handler = (req, res) => {
      if ((req.url || '').startsWith('/health')) return serveStatic(req, res);
      vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
    };
  }
  const io = new Server<ClientToServer, ServerToClient>(httpServer, {
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false,
  });
  io.on('connection', (socket) => {
    const session = manager.connect({ send: (ev, data) => (socket.emit as (e: string, d: unknown) => void).call(socket, ev, data) });
    socket.onAny((ev: string, data: unknown) => session.handle(ev, data));
    socket.on('disconnect', () => session.onDisconnect());
  });
  httpServer.listen(PORT, HOST, () => {
    console.log(`The Worst Travel escuchando en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} ${DEV ? '(desarrollo)' : ''}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
