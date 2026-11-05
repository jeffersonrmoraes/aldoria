// Teste de robustez do servidor: todas as classes usam todas as habilidades (e mensagens inválidas) perto de monstros.
import { Client } from 'colyseus.js';
const url = process.argv[2] ?? 'ws://localhost:2599';
const classes = ['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard','necromancer','eldknight','bladesinger','illusionist'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let total = 0, hits = 0;
for (const classId of classes) {
  const c = new Client(url);
  let room;
  try { room = await c.joinOrCreate('world', { v: 2, name: classId, raceId: 'human', classId, tone: 'a', level: 10 }); } catch (e) { console.log(classId, 'falhou ao entrar:', e.message); continue; }
  let mobs = [];
  for (const t of ['welcome','roster','online','snap','join','leave','matk','ready','kill','hurt']) room.onMessage(t, () => {});
  room.onMessage('mobs', (a) => { mobs = a; });
  room.onMessage('hit', () => { hits++; });
  room.send('sheet', { raceId: 'human', classId, level: 10, equipped: {} });
  room.send('pos', { x: 1000, y: 1000, f: 0, mv: 0, loc: 'world' });
  await sleep(600);
  if (mobs.length) room.send('pos', { x: mobs[1] - 10, y: mobs[2], f: 0, mv: 0, loc: 'world' });
  await sleep(300);
  for (let round = 0; round < 3; round++) for (let i = 0; i < 4; i++) { room.send('sk', { i, m: mobs[0], a: 0.5 }); room.send('atk', { m: mobs[0] }); room.send('mn', { m: mobs[0] }); total += 3; await sleep(120); }
  // lixo deliberado
  room.send('sk', { i: 'x', m: -5, a: 'z' }); room.send('atk', { m: 1e9 }); room.send('sheet', { classId: 5 }); room.send('sheet', null); room.send('pos', { x: NaN, y: 'a', loc: 7 }); room.send('sk'); room.send('atk');
  await sleep(300);
  room.leave();
}
const r = await fetch(url.replace('ws', 'http') + '/health').then((x) => x.json()).catch(() => null);
console.log('mensagens enviadas', total, 'hits recebidos', hits, '| servidor vivo:', !!r?.ok);
process.exit(0);
