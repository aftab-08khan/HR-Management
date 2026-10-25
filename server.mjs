import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import next from 'next';
import {WebSocketServer} from 'ws';
import {getToken} from 'next-auth/jwt';
import {database} from './lib/mongodb.js';
import {connectNotificationSocket, resolveNotificationUser, socketOriginAllowed} from './lib/notifications.js';

export function upgradeRequestPath(target) {
  if (typeof target !== 'string' || target.length > 8192) return null;
  try {return new URL(target, 'http://localhost').pathname;} catch {return null;}
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const chunk of header.split(';')) {
    const separator = chunk.indexOf('=');
    if (separator < 1) continue;
    const name = chunk.slice(0, separator).trim();
    try {cookies[name] = decodeURIComponent(chunk.slice(separator + 1).trim());} catch {}
  }
  return cookies;
}

function argument(name, fallback) {
  const direct = process.argv.find(value => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : fallback;
}

export async function startServer() {
  const dev = process.argv.includes('--dev');
  if (!dev) process.env.NODE_ENV ||= 'production';
  const port = Number(argument('--port', process.env.PORT || '3000'));
  const hostname = argument('--hostname', process.env.HOST || (dev ? '127.0.0.1' : '0.0.0.0'));
  let handle;
  const server = createServer((req, res) => {void handle(req, res);});
  // Next attaches its HMR upgrade listener on the first request. Its server facade
  // forwards every upgrade except our endpoint, which otherwise matches the API catch-all.
  const nextHttpServer = new Proxy(server, {get(target, key, receiver) {
    if (key === 'on') return (event, listener) => {
      target.on(event, event === 'upgrade' ? (req, socket, head) => {
        const pathname = upgradeRequestPath(req.url);
        if (pathname === null) return socket.destroy();
        if (pathname !== '/api/live') listener(req, socket, head);
      } : listener);
      return receiver;
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
  const createNext = typeof next === 'function' ? next : next.default;
  const app = createNext({dev, hostname, port, httpServer: nextHttpServer});
  await app.prepare();
  handle = app.getRequestHandler();
  const sockets = new WebSocketServer({noServer: true, maxPayload: 1024, perMessageDeflate: false});
  const sessions = new Set();
  function reject(socket, status, message) {
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  server.on('upgrade', async (req, socket, head) => {
    const pathname = upgradeRequestPath(req.url);
    if (pathname === null) return reject(socket, 400, 'Bad Request');
    if (pathname !== '/api/live') return;
    socket.on('error', () => {});
    if (!socketOriginAllowed(req.headers.origin, req.headers.host, process.env.NEXTAUTH_URL)) return reject(socket, 403, 'Forbidden');
    if (!process.env.NEXTAUTH_SECRET) return reject(socket, 503, 'Service Unavailable');
    try {
      const token = await getToken({req: {headers: req.headers, cookies: parseCookies(req.headers.cookie)}, secret: process.env.NEXTAUTH_SECRET});
      if (!token?.email || !token.workspaceId || !token.exp) return reject(socket, 401, 'Unauthorized');
      const db = await database();
      if (!await resolveNotificationUser(db, token)) return reject(socket, 403, 'Forbidden');
      if (socket.destroyed) return;
      sockets.handleUpgrade(req, socket, head, ws => {
        const session = connectNotificationSocket(ws, token, {db});
        sessions.add(session);
        ws.once('close', () => sessions.delete(session));
      });
    } catch {reject(socket, 503, 'Service Unavailable');}
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, hostname, resolve);});
  console.log(`PeopleOS ${dev ? 'development' : 'production'} server: http://localhost:${port} (WebSocket /api/live)`);
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const session of sessions) session.close();
    sockets.close();
    server.close(() => void app.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  return {server, app, sockets, shutdown};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startServer();
