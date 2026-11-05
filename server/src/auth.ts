// Contas: cadastro/login com senha (scrypt) e token assinado (HMAC). Também expõe os saves na nuvem (/api/chars).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CLASS_BY_ID } from '../../src/data/classes';
import { RACE_BY_ID } from '../../src/data/races';
import { MAX_LEVEL } from '../../src/data/rules';
import type { Store } from './store.js';

const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) console.warn('[auth] AUTH_SECRET não definido: os logins serão invalidados a cada reinício.');
const TOKEN_MS = 30 * 24 * 3600 * 1000;
const SLOTS = 3;
const MAX_BODY = 300_000;

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (p: string) => createHmac('sha256', SECRET).update(p).digest('base64url');

export function makeToken(a: { id: string; username: string }) {
  const p = b64(JSON.stringify({ a: a.id, u: a.username, e: Date.now() + TOKEN_MS }));
  return `${p}.${sign(p)}`;
}
export function readToken(t: unknown): { id: string; username: string } | null {
  if (typeof t !== 'string') return null;
  const [p, s] = t.split('.');
  if (!p || !s) return null;
  const good = sign(p);
  if (s.length !== good.length || !timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try {
    const o = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (typeof o.a !== 'string' || typeof o.u !== 'string' || !(o.e > Date.now())) return null;
    return { id: o.a, username: o.u };
  } catch { return null; }
}

function hash(pass: string) { const salt = randomBytes(16); return `s1$${salt.toString('hex')}$${scryptSync(pass, salt, 32).toString('hex')}`; }
function check(pass: string, stored: string) {
  const [v, salt, h] = stored.split('$');
  if (v !== 's1' || !salt || !h) return false;
  const a = scryptSync(pass, Buffer.from(salt, 'hex'), 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// limitador simples por IP
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now(), l = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  l.push(now); hits.set(key, l);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return l.length > max;
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
function send(res: ServerResponse, code: number, body: unknown) { res.writeHead(code, { 'content-type': 'application/json', ...CORS }); res.end(JSON.stringify(body)); }
function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, no) => {
    let n = 0; const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => { n += c.length; if (n > MAX_BODY) { no(new Error('grande')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch { no(new Error('json')); } });
    req.on('error', no);
  });
}

/** valida (de forma básica) um personagem salvo antes de guardá-lo */
function okChar(d: unknown): boolean {
  const p = d as { raceId?: string; classId?: string; level?: number; items?: unknown[]; name?: string };
  return !!p && typeof p === 'object' && !!RACE_BY_ID[String(p.raceId)] && !!CLASS_BY_ID[String(p.classId)]
    && Number.isInteger(p.level) && p.level! >= 1 && p.level! <= MAX_LEVEL && Array.isArray(p.items) && p.items.length <= 60
    && typeof p.name === 'string' && p.name.length <= 20;
}

/** Trata /api/*; devolve false se a rota não for da API. */
export function apiHandler(store: Store) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/api/')) return false;
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS).end(); return true; }
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
    try {
      if (req.method === 'POST' && (url === '/api/register' || url === '/api/login')) {
        const b = (await body(req)) as { user?: unknown; pass?: unknown };
        const user = String(b.user ?? '').trim(), pass = String(b.pass ?? '');
        if (url === '/api/register') {
          if (limited('r' + ip, 8, 3600_000)) return send(res, 429, { error: 'Muitas contas criadas daqui. Tente mais tarde.' }), true;
          if (!/^[A-Za-z0-9_]{3,16}$/.test(user)) return send(res, 400, { error: 'Usuário: 3 a 16 letras, números ou _.' }), true;
          if (pass.length < 6 || pass.length > 64) return send(res, 400, { error: 'A senha precisa ter de 6 a 64 caracteres.' }), true;
          const a = await store.createAccount(user, hash(pass));
          if (!a) return send(res, 409, { error: 'Esse usuário já existe.' }), true;
          return send(res, 200, { token: makeToken(a), user: a.username }), true;
        }
        if (limited('l' + ip, 15, 60_000)) return send(res, 429, { error: 'Muitas tentativas. Espere um minuto.' }), true;
        const a = await store.findAccount(user);
        const good = a ? check(pass, a.pass) : (check(pass, 's1$00$00'), false);   // custo parecido com e sem usuário
        if (!a || !good) return send(res, 401, { error: 'Usuário ou senha incorretos.' }), true;
        return send(res, 200, { token: makeToken(a), user: a.username }), true;
      }
      const who = readToken((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (!who) return send(res, 401, { error: 'Faça login novamente.' }), true;
      if (req.method === 'GET' && url === '/api/chars') return send(res, 200, { user: who.username, chars: await store.listChars(who.id) }), true;
      const m = url.match(/^\/api\/chars\/(\d+)$/);
      if (m) {
        const slot = Number(m[1]);
        if (slot < 0 || slot >= SLOTS) return send(res, 400, { error: 'Espaço inválido.' }), true;
        if (req.method === 'PUT') {
          const d = await body(req);
          if (!okChar(d)) return send(res, 400, { error: 'Personagem inválido.' }), true;
          await store.putChar(who.id, slot, d);
          return send(res, 200, { ok: true, at: Date.now() }), true;
        }
        if (req.method === 'DELETE') { await store.delChar(who.id, slot); return send(res, 200, { ok: true }), true; }
      }
      return send(res, 404, { error: 'Rota desconhecida.' }), true;
    } catch (e) {
      console.error('[api]', e instanceof Error ? e.message : e);
      return send(res, 400, { error: 'Requisição inválida.' }), true;
    }
  };
}
