import { Client } from 'colyseus.js';

// cria uma conta de teste no servidor e devolve o token
const HTTP = (process.argv[2] ?? 'ws://localhost:2599').replace(/^ws/, 'http');
let _tok; const tok = async () => _tok ??= (await (await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'bot' + Math.random().toString(36).slice(2, 9), pass: 'senha123' }) })).json()).token;

const c = new Client(process.argv[2] ?? 'ws://localhost:2599');
const room = await c.joinOrCreate('world', { v: 4, tok: await tok(), name: 'Bot', raceId: 'human', classId: 'barbarian', tone: 'a', level: 3 });
let ready, mobs = [], kills = [], hits = [], hurts = [];
room.onMessage('ready', (m) => { ready = m; });
room.onMessage('mobs', (a) => { mobs = a; });
room.onMessage('kill', (m) => kills.push(m));
room.onMessage('hit', (m) => hits.push(m));
room.onMessage('hurt', (m) => hurts.push(m));
room.onMessage('welcome', () => {}); room.onMessage('roster', () => {}); room.onMessage('online', () => {}); room.onMessage('snap', () => {}); room.onMessage('join', () => {}); room.onMessage('leave', () => {}); room.onMessage('matk', () => {});
const sheet = { raceId: 'human', classId: 'barbarian', level: 3, equipped: { mainhand: { uid: 'a', name: 'Machado Grande', slot: 'mainhand', rarity: 0, minLevel: 1, value: 1, icon: 'x', style: 'melee', dice: [1, 12], speed: 1, twoHanded: true }, body: { uid: 'b', name: 'Gibão', slot: 'body', rarity: 0, minLevel: 1, value: 1, icon: 'x', armorType: 'light', ac: 11, dexCap: 2 } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);
console.log('ready', ready);
// escolhe um monstro de Campos perto do início: mande o jogador para perto do primeiro mob visto
room.send('sheet', sheet);
room.send('pos', { x: 3200, y: 2400, f: 0, mv: 0, loc: 'world' });
await sleep(700);
console.log('mobs near start', mobs.length / 6);
// teleporta ao primeiro mob de qualquer lugar: varre posições
let target = null;
for (const [x, y] of [[1000, 1000], [3000, 1500], [5000, 1000], [2000, 3500], [4500, 3800], [3200, 2200], [3200, 1200]]) {
  room.send('pos', { x, y, f: 0, mv: 0, loc: 'world' });
  await sleep(300); await sleep(250);
  if (mobs.length >= 6) { target = { x, y }; break; }
}
console.log('probe', target, mobs.length / 6);
if (!target) process.exit(1);
// tenta alguns monstros até conseguir matar um (alguns ficam junto a vilas: o jogador ali é intocável)
const cand = []; for (let k = 0; k < mobs.length; k += 6) cand.push(mobs.slice(k, k + 6));
let i = -1, mx = 0, my = 0;
for (const [ci, cx, cy] of cand.slice(0, 8)) {
  i = ci; mx = cx; my = cy;
  room.send('pos', { x: cx - 8, y: cy, f: 0, mv: 0, loc: 'world' });
  await sleep(250);
  for (let k = 0; k < 14 && !kills.length; k++) { room.send('atk', { m: ci }); await sleep(750); }
  if (kills.length) break;
}
let flags = null; for (let k = 0; k < mobs.length; k += 6) if (mobs[k] === i) flags = mobs.slice(k, k + 6);
console.log('alvo', i, 'hits', hits.length, 'hurts', hurts.length, hurts.slice(0, 4).map((h) => h.d).join(','), 'kills', kills, 'estado final', flags);
// ataque a distância absurda deve ser ignorado
const before = hits.length;
room.send('pos', { x: mx + 900, y: my + 900, f: 0, mv: 0, loc: 'world' }); await sleep(300);
room.send('atk', { m: mobs.length ? mobs[0] : 0 }); await sleep(500);
console.log('hits from far (esperado 0 novos):', hits.length - before);
if (kills.length) {
  // respawn: o monstro morto deve voltar ao lar com a vida cheia (18–28 s)
  room.send('pos', { x: mx - 60, y: my, f: 0, mv: 0, loc: 'world' });
  const t0 = Date.now(); let back = false;
  while (Date.now() - t0 < 40000 && !back) { await sleep(500); for (let k = 0; k < mobs.length; k += 6) if (mobs[k] === i && !(mobs[k + 4] & 1)) back = true; }
  console.log('respawn visto:', back, Math.round((Date.now() - t0) / 1000) + 's');
}
process.exit(0);
