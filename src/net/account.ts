// Conta online: login/cadastro no servidor e sincronização dos personagens (saves na nuvem).
import { serverUrl } from './config';
import { exportSlot, hooks, importSlot, SLOTS } from '../game/state';

const KEY_TOKEN = 'aldoria-token', KEY_USER = 'aldoria-user', KEY_LAST = 'aldoria-last-user';
const safe = <T, D>(f: () => T, d: D): T | D => { try { return f(); } catch { return d; } };

export const getToken = () => safe(() => localStorage.getItem(KEY_TOKEN), null) || '';
export const getUser = () => safe(() => localStorage.getItem(KEY_USER), null) || '';
export const loggedIn = () => !!getToken();
export function logout() { safe(() => { localStorage.removeItem(KEY_TOKEN); localStorage.removeItem(KEY_USER); }, null); }

const base = () => serverUrl().replace(/^ws/, 'http');

async function api(path: string, method: string, data?: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 70000);   // o servidor gratuito pode levar ~1 min para acordar
  try {
    const r = await fetch(base() + path, {
      method, signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: 'Bearer ' + getToken() } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, json: { error: 'Não consegui falar com o servidor. Ele pode estar acordando — tente de novo em instantes.' } };
  } finally { clearTimeout(t); }
}

/** Entra (ou cria a conta) e sincroniza os personagens. Devolve a mensagem de erro, ou null se deu certo. */
export async function authenticate(mode: 'login' | 'register', user: string, pass: string): Promise<string | null> {
  const r = await api(mode === 'login' ? '/api/login' : '/api/register', 'POST', { user, pass });
  if (!r.ok) return r.json?.error ?? 'Erro ao entrar.';
  safe(() => { localStorage.setItem(KEY_TOKEN, r.json.token); localStorage.setItem(KEY_USER, r.json.user); }, null);
  return (await syncAll()) ? null : 'Entrei, mas não consegui sincronizar os personagens. Tente de novo.';
}

/** Junta os saves locais com os da nuvem: vale o mais recente (campo `sv`). */
export async function syncAll(): Promise<boolean> {
  const r = await api('/api/chars', 'GET');
  if (r.status === 401) { logout(); return false; }
  if (!r.ok) return false;
  const user = getUser(), last = safe(() => localStorage.getItem(KEY_LAST), null);
  const mine = !last || last === user;                           // outro usuário neste navegador: não sobe os heróis dele
  const remote = new Map<number, { sv?: number }>((r.json.chars as { slot: number; data: { sv?: number } }[]).map((c) => [c.slot, c.data]));
  for (let n = 0; n < SLOTS; n++) {
    const srv = remote.get(n), loc = exportSlot(n);
    const locSv = loc ? (JSON.parse(loc).sv ?? 0) : 0;
    if (srv && (!loc || (srv.sv ?? 0) >= locSv)) importSlot(n, JSON.stringify(srv));
    else if (loc && mine) await api('/api/chars/' + n, 'PUT', JSON.parse(loc));
  }
  safe(() => localStorage.setItem(KEY_LAST, user), null);
  return true;
}

// salvamento na nuvem: no máximo um envio a cada 6 s por espaço (o jogo salva localmente a cada 8 s)
const pending = new Map<number, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
function flush() {
  timer = undefined;
  for (const [n, json] of pending) void api('/api/chars/' + n, 'PUT', JSON.parse(json));
  pending.clear();
}
hooks.save = (n, p) => { if (!loggedIn()) return; pending.set(n, JSON.stringify(p)); timer ??= setTimeout(flush, 6000); };
hooks.del = (n) => { if (loggedIn()) { pending.delete(n); void api('/api/chars/' + n, 'DELETE'); } };
addEventListener('beforeunload', () => { if (pending.size && loggedIn()) for (const [n, json] of pending) fetch(base() + '/api/chars/' + n, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken() }, body: json }).catch(() => {}); });
