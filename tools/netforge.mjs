// Fase 3b: manda uma ficha com itens forjados e espera o aviso 'warn' do servidor.
import { Client } from 'colyseus.js';
const URL = process.argv[2] ?? 'ws://localhost:2599'; const HTTP = URL.replace(/^ws/, 'http');
const tok = (await (await fetch(HTTP + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'forja' + Math.random().toString(36).slice(2, 8), pass: 'senha123' }) })).json()).token;
const room = await new Client(URL).joinOrCreate('world', { v: 5, tok, name: 'Forja', raceId: 'human', classId: 'barbarian', tone: 'a', level: 5 });
let warn = null; room.onMessage('warn', (m) => { warn = m; });
const fake = { uid: 'x', name: 'Espada Longa', slot: 'mainhand', rarity: 1, minLevel: 1, value: 1, icon: '⚔', style: 'melee', dice: [6, 20], speed: 1, plus: 11 };
room.send('sheet', { raceId: 'human', classId: 'barbarian', level: 5, equipped: { mainhand: fake } });
await new Promise((r) => setTimeout(r, 1500));
console.log(warn ? 'OK aviso recebido: ' + JSON.stringify(warn) : 'FALHOU: sem aviso');
room.leave(); process.exit(warn ? 0 : 1);
