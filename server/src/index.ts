import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom } from './WorldRoom.js';
import { PROTOCOL } from './protocol.js';
import { openStore } from './store.js';
import { apiHandler } from './auth.js';

// rede de segurança: um erro inesperado numa mensagem/temporizador nunca derruba o mundo inteiro
process.on('uncaughtException', (e) => console.error('[erro]', e));
process.on('unhandledRejection', (e) => console.error('[erro]', e));

const port = Number(process.env.PORT ?? 2567);
const started = Date.now();

// HTTP simples: verificação de saúde (Render) e página de status.
const store = await openStore();
console.log(`Armazenamento de contas: ${store.kind}${store.kind === 'arquivo' ? ' (temporário: defina DATABASE_URL para guardar de verdade)' : ''}`);
const api = apiHandler(store);
const http = createServer(async (req, res) => {
  if (await api(req, res)) return;
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ ok: true, game: 'Reinos de Aldoria', protocol: PROTOCOL, store: store.kind, uptime: Math.round((Date.now() - started) / 1000) }));
    return;
  }
  res.writeHead(404).end();
});

const server = new Server({ transport: new WebSocketTransport({ server: http }) });
server.define('world', WorldRoom);
await server.listen(port);
console.log(`Servidor de Aldoria ouvindo na porta ${port}`);
