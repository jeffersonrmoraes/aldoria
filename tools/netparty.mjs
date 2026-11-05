// Fase 4: grupos. Dois bots: A convida B, B aceita, chat /g, ambos entram no grupo.
import { Client } from 'colyseus.js';
const URL = process.argv[2] ?? 'ws://localhost:2599'; const HTTP = URL.replace(/^ws/, 'http');
const mk = async (name) => {
  const tok = (await (await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: name + Math.random().toString(36).slice(2, 7), pass: 'senha123' }) })).json()).token;
  const r = await new Client(URL).joinOrCreate('world', { v: 5, tok, name, raceId: 'human', classId: 'barbarian', tone: 'a', level: 3 });
  const log = []; r.onMessage('chat', (m) => log.push(`${m.ch}|${m.name}|${m.t}`)); ['welcome','ready','roster','online','mobs','snap','join','leave'].forEach((t) => r.onMessage(t, () => {}));
  return { r, log };
};
const a = await mk('Alfa'), b = await mk('Beta');
const w = (ms) => new Promise((r) => setTimeout(r, ms));
await w(500);
a.r.send('chat', { t: '/grupo convidar Beta' }); await w(300);
b.r.send('chat', { t: '/grupo aceitar' }); await w(300);
a.r.send('chat', { t: '/g olá grupo' }); await w(300);
b.r.send('chat', { t: '/grupo' }); await w(300);
b.r.send('chat', { t: '/grupo sair' }); await w(300);
console.log('A:', a.log); console.log('B:', b.log);
const ok = b.log.some((l) => l.startsWith('grupo|Alfa|olá')) && b.log.some((l) => l.includes('Grupo: Alfa')) && a.log.some((l) => l.includes('desfeito'));
console.log(ok ? 'OK' : 'FALHOU'); process.exit(ok ? 0 : 1);
