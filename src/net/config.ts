// Endereço do servidor online. Ordem: ?server=... na URL, depois o valor salvo, depois o padrão.
export const DEFAULT_SERVER = 'wss://aldoria-server.onrender.com';
const KEY_SERVER = 'aldoria-server';
const KEY_ONLINE = 'aldoria-online';

const safe = <T, D = T>(f: () => T, d: D): T | D => { try { return f(); } catch { return d; } };

export function serverUrl(): string {
  const q = safe(() => new URLSearchParams(location.search).get('server'), null);
  if (q) { safe(() => localStorage.setItem(KEY_SERVER, q), null); return q; }
  return safe(() => localStorage.getItem(KEY_SERVER), null) || DEFAULT_SERVER;
}
export const onlineWanted = () => safe(() => localStorage.getItem(KEY_ONLINE) === '1', false);
export const setOnlineWanted = (v: boolean) => safe(() => localStorage.setItem(KEY_ONLINE, v ? '1' : '0'), null);
