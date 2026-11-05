import { Client, Room } from '@colyseus/core';
import { ChatMsg, JoinOptions, PlayerInfo, PosMsg, PROTOCOL, ReadyMsg, SheetMsg, SnapMsg, WarnMsg } from './protocol.js';
import { WorldSim, SimPlayer } from './sim.js';
import { sanitizeSheet } from './sheet.js';
import { derive } from '../../src/game/state';
import { readToken } from './auth.js';

/** Anti-trapaça: nível confiável por personagem (conta+nome+classe). Sobe no máximo 1 nível a cada 40 s conectado. */
const LEVEL_LEDGER = new Map<string, { lvl: number; at: number }>();
const LEVEL_EVERY = 40_000;
export function trustedLevel(key: string, declared: number, now: number): number {
  const e = LEVEL_LEDGER.get(key);
  if (!e) { LEVEL_LEDGER.set(key, { lvl: declared, at: now }); return declared; }
  const allowed = e.lvl + Math.floor((now - e.at) / LEVEL_EVERY);
  const lvl = Math.min(declared, allowed);
  if (lvl > e.lvl) { e.at += (lvl - e.lvl) * LEVEL_EVERY; e.lvl = lvl; }
  else if (lvl < e.lvl) { e.lvl = lvl; e.at = now; }   // trocou para personagem/nível menor
  return lvl;
}

interface Peer extends PlayerInfo, SimPlayer {
  x: number; y: number; f: number; mv: number; loc: string;
  lastPos: number; lastChat: number; chatBurst: number;
  msgs: number; msgAt: number; lastSheet: number; lastWarn: string;
  acc: string; user: string;
}

const MAX_CLIENTS = 60;
const SNAP_MS = 100;       // 10 atualizações por segundo
const POS_MIN_MS = 40;     // limite de mensagens 'pos' por jogador
const MAP_LIMIT = 100000;  // pixels; descarta valores absurdos

const clean = (s: unknown, max: number) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown, lo: number, hi: number, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/**
 * Sala única do mundo: presença, movimento, chat e (fase 2) os monstros do mundo aberto, simulados aqui.
 * O servidor decide a vida/morte dos monstros, calcula o dano dos jogadores e o XP a partir da ficha declarada.
 * A vida/inventário do jogador ainda vivem no cliente (sem contas): ver server/README.md.
 */
export class WorldRoom extends Room {
  maxClients = MAX_CLIENTS;
  private peers = new Map<string, Peer>();
  private snapTimer?: NodeJS.Timeout;
  private simTimer?: NodeJS.Timeout;
  private sim = new WorldSim();
  private lastStep = Date.now();

  /** limite geral de mensagens de combate por jogador (anti-flood) */
  private allow(p: Peer) {
    const now = Date.now();
    if (now - p.msgAt > 1000) { p.msgAt = now; p.msgs = 0; }
    return ++p.msgs <= 40;
  }

  onCreate() {
    this.setPatchRate(null); // sem estado sincronizado: usamos mensagens

    this.onMessage('sheet', (client, m: SheetMsg) => {
      const p = this.peers.get(client.sessionId);
      if (!p) return;
      const now = Date.now();
      if (now - p.lastSheet < 800) return;
      p.lastSheet = now;
      const rejected: string[] = [];
      const sheet = sanitizeSheet(m, rejected);
      if (!sheet) return;
      const key = rejected.join('|');
      if (key !== p.lastWarn) { p.lastWarn = key; if (rejected.length) client.send('warn', { items: rejected.slice(0, 6) } satisfies WarnMsg); }
      const lv = trustedLevel(`${p.acc}|${p.name}|${sheet.classId}`, sheet.level, now);
      if (lv < sheet.level) { rejected.push(`nível ${sheet.level} (subindo rápido demais; valendo ${lv})`); sheet.level = lv; p.lastWarn = ''; client.send('warn', { items: [`nível declarado ${m.level} acima do permitido; valendo ${lv} online`] } satisfies WarnMsg); }
      p.sheet = sheet; p.d = derive(sheet);
      p.level = sheet.level;
    });
    this.onMessage('atk', (client, m: { m: number }) => { const p = this.peers.get(client.sessionId); if (p && this.allow(p)) this.sim.attack(p, m?.m, this.peers.values()); });
    this.onMessage('sk', (client, m: { i: number; m?: number; a?: number }) => { const p = this.peers.get(client.sessionId); if (p && this.allow(p)) this.sim.skill(p, m?.i, m?.m, m?.a, this.peers.values()); });
    this.onMessage('mn', (client, m: { m: number }) => { const p = this.peers.get(client.sessionId); if (p && this.allow(p)) this.sim.minion(p, m?.m, this.peers.values()); });

    this.onMessage('pos', (client, m: PosMsg) => {
      const p = this.peers.get(client.sessionId);
      if (!p) return;
      const now = Date.now();
      if (now - p.lastPos < POS_MIN_MS) return;
      p.lastPos = now;
      p.x = num(m?.x, -MAP_LIMIT, MAP_LIMIT, p.x);
      p.y = num(m?.y, -MAP_LIMIT, MAP_LIMIT, p.y);
      p.f = num(m?.f, -10, 10, p.f);
      p.mv = m?.mv ? 1 : 0;
      p.dead = !!m?.dd;
      const loc = clean(m?.loc, 40) || 'world';
      if (loc !== p.loc) {
        const old = p.loc;
        p.loc = loc;
        // quem ficou no mapa antigo deixa de ver este jogador
        for (const c of this.clients) { if (c.sessionId !== p.id && this.peers.get(c.sessionId)?.loc === old) c.send('leave', { id: p.id, moved: true }); }
        this.sendRoster(client);
        if (loc === 'world') this.sendReady(client);
      }
    });

    this.onMessage('chat', (client, m: { t: string }) => {
      const p = this.peers.get(client.sessionId);
      if (!p) return;
      const t = clean(m?.t, 200);
      if (!t) return;
      if (t.startsWith('/')) { if (this.allow(p) && !this.command(p, t)) this.say(p, 'Comando desconhecido. Use /grupo ou /g mensagem.'); return; }
      const now = Date.now();
      // anti-spam: no máximo 5 mensagens a cada 8 s
      p.chatBurst = Math.max(0, p.chatBurst - (now - p.lastChat) / 1600) + 1;
      p.lastChat = now;
      if (p.chatBurst > 5) { client.send('chat', { id: '', name: 'Sistema', t: 'Calma, aventureiro! Você está falando rápido demais.', ch: 'sistema' } satisfies ChatMsg); return; }
      const msg: ChatMsg = { id: p.id, name: p.name, t, ch: 'mapa' };
      for (const c of this.clients) {
        const o = this.peers.get(c.sessionId);
        if (o && o.loc === p.loc) c.send('chat', msg);
      }
    });

    this.snapTimer = setInterval(() => this.broadcastSnap(), SNAP_MS);
    this.simTimer = setInterval(() => this.tickSim(), SNAP_MS);
  }

  onDispose() { if (this.snapTimer) clearInterval(this.snapTimer); if (this.simTimer) clearInterval(this.simTimer); }

  // ---------- grupos (party) ----------
  private parties = new Map<string, Set<string>>();
  private invites = new Map<string, { from: string; at: number }>();   // convidado → convite
  private pid = 0;
  private say(p: Peer, t: string, ch: ChatMsg['ch'] = 'sistema', name = 'Sistema') { p.send('chat', { id: '', name, t, ch } satisfies ChatMsg); }
  private members(p: Peer): Peer[] { return p.party ? [...(this.parties.get(p.party) ?? [])].map((i) => this.peers.get(i)).filter((x): x is Peer => !!x) : []; }
  private leaveParty(p: Peer, why = 'saiu do grupo') {
    const id = p.party; if (!id) return;
    const set = this.parties.get(id); p.party = undefined; set?.delete(p.id);
    if (!set) return;
    const rest = [...set].map((i) => this.peers.get(i)).filter((x): x is Peer => !!x);
    for (const o of rest) this.say(o, `${p.name} ${why}.`);
    if (rest.length < 2) { for (const o of rest) { o.party = undefined; this.say(o, 'O grupo foi desfeito.'); } this.parties.delete(id); }
  }
  /** comandos de chat: /grupo convidar Nome | aceitar | sair | lista, e /g mensagem */
  private command(p: Peer, t: string): boolean {
    const [cmd, sub, ...rest] = t.slice(1).split(/\s+/);
    const c = cmd.toLowerCase();
    if (c === 'g') {
      const txt = [sub, ...rest].filter(Boolean).join(' ');
      if (!p.party) { this.say(p, 'Você não está em um grupo. Use /grupo convidar Nome.'); return true; }
      if (txt) for (const o of this.members(p)) this.say(o, txt, 'grupo', p.name);
      return true;
    }
    if (c !== 'grupo' && c !== 'party') return false;
    const s = (sub ?? 'lista').toLowerCase();
    if (s === 'convidar') {
      const name = rest.join(' ').toLowerCase();
      const o = [...this.peers.values()].find((x) => x.name.toLowerCase() === name && x !== p);
      if (!o) { this.say(p, 'Aventureiro não encontrado online.'); return true; }
      if (o.party) { this.say(p, `${o.name} já está em um grupo.`); return true; }
      if (p.party && (this.parties.get(p.party)?.size ?? 0) >= 5) { this.say(p, 'O grupo já tem 5 membros.'); return true; }
      this.invites.set(o.id, { from: p.id, at: Date.now() });
      this.say(p, `Convite enviado a ${o.name}.`);
      this.say(o, `${p.name} convidou você para um grupo. Digite /grupo aceitar (vale 60 s).`);
    } else if (s === 'aceitar') {
      const inv = this.invites.get(p.id); this.invites.delete(p.id);
      const from = inv && Date.now() - inv.at < 60_000 ? this.peers.get(inv.from) : undefined;
      if (!from) { this.say(p, 'Nenhum convite válido.'); return true; }
      if (p.party) { this.say(p, 'Você já está em um grupo.'); return true; }
      if (!from.party) { from.party = 'g' + ++this.pid; this.parties.set(from.party, new Set([from.id])); }
      const set = this.parties.get(from.party)!;
      if (set.size >= 5) { this.say(p, 'O grupo está cheio.'); return true; }
      set.add(p.id); p.party = from.party;
      for (const o of this.members(p)) this.say(o, `${p.name} entrou no grupo.`);
    } else if (s === 'sair') {
      if (!p.party) this.say(p, 'Você não está em um grupo.'); else { this.say(p, 'Você saiu do grupo.'); this.leaveParty(p); }
    } else {
      const m = this.members(p);
      this.say(p, m.length ? `Grupo: ${m.map((x) => `${x.name} (nv ${x.level})`).join(', ')}` : 'Você não está em um grupo. Use /grupo convidar Nome. Comandos: /grupo convidar|aceitar|sair, /g mensagem.');
    }
    return true;
  }

  private sendReady(client: Client) { client.send('ready', { n: this.sim.spawnCount, h: this.sim.sig } satisfies ReadyMsg); }

  /** avança os monstros e envia a cada jogador do mundo aberto os que estão por perto */
  private tickSim() {
    try { this.tickSimInner(); } catch (e) { console.error('[sim]', e); }
  }
  private tickSimInner() {
    const now = Date.now(), dt = Math.min(0.25, (now - this.lastStep) / 1000);
    this.lastStep = now;
    if (!this.peers.size) return;
    this.sim.step(dt, now, this.peers.values());
    for (const c of this.clients) {
      const p = this.peers.get(c.sessionId);
      if (p && p.loc === 'world') c.send('mobs', this.sim.snapshot(p));
    }
  }

  onAuth(_client: Client, options: JoinOptions) {
    if (!options || options.v !== PROTOCOL) throw new Error('Versão do jogo incompatível. Recarregue a página (Ctrl+F5).');
    const who = readToken(options.tok);
    if (!who) throw new Error('Faça login para jogar online.');
    return who;
  }

  onJoin(client: Client, o: JoinOptions, who: { id: string; username: string }) {
    // a mesma conta só pode ter uma sessão: a mais antiga é desconectada
    for (const c of this.clients) {
      const old = this.peers.get(c.sessionId);
      if (old && old.acc === who.id && c.sessionId !== client.sessionId) { c.send('kicked', { why: 'Sua conta entrou em outro lugar.' }); c.leave(); }
    }
    const p: Peer = {
      id: client.sessionId,
      name: clean(o.name, 16) || 'Aventureiro',
      raceId: clean(o.raceId, 20), classId: clean(o.classId, 20), tone: clean(o.tone, 12),
      level: num(o.level, 1, 99, 1),
      x: 0, y: 0, f: 0, mv: 0, loc: 'world',
      lastPos: 0, lastChat: 0, chatBurst: 0, msgs: 0, msgAt: 0, lastSheet: 0, lastWarn: "", acc: who.id, user: who.username,
      dead: false, sheet: null, d: null, buffs: [], cds: {}, lastAtk: 0, lastMn: 0,
      send: (type, msg) => client.send(type, msg),
    };
    this.peers.set(client.sessionId, p);
    client.send('welcome', { id: p.id, online: this.peers.size });
    this.sendReady(client);
    this.sendRoster(client);
    this.notifyOthers(p, 'join', this.info(p));
    this.broadcast('online', { n: this.peers.size });
    console.log(`[+] ${p.name} entrou (${this.peers.size} online)`);
  }

  onLeave(client: Client) {
    const p = this.peers.get(client.sessionId);
    this.peers.delete(client.sessionId);
    this.invites.delete(client.sessionId);
    if (p) {
      this.leaveParty(p, 'desconectou');
      this.notifyOthers(p, 'leave', { id: p.id });
      this.broadcast('online', { n: this.peers.size });
      console.log(`[-] ${p.name} saiu (${this.peers.size} online)`);
    }
  }

  private info(p: Peer): PlayerInfo {
    return { id: p.id, name: p.name, raceId: p.raceId, classId: p.classId, tone: p.tone, level: p.level };
  }

  /** Lista (com aparência) dos jogadores do mesmo mapa; enviada ao entrar e ao trocar de mapa. */
  private sendRoster(client: Client) {
    const me = this.peers.get(client.sessionId);
    if (!me) return;
    const list = [...this.peers.values()].filter((o) => o.id !== me.id && o.loc === me.loc).map((o) => ({ ...this.info(o), x: o.x, y: o.y }));
    client.send('roster', list);
    // avisa aos que estão no mapa novo (e aos do antigo, que perderam este jogador)
    this.notifyOthers(me, 'join', { ...this.info(me), x: me.x, y: me.y });
  }

  private notifyOthers(p: Peer, type: string, msg: unknown) {
    for (const c of this.clients) {
      if (c.sessionId === p.id) continue;
      const o = this.peers.get(c.sessionId);
      if (type === 'leave' || (o && o.loc === p.loc)) c.send(type, msg);
    }
  }

  private broadcastSnap() {
    if (this.peers.size < 2) return;
    const byLoc = new Map<string, Peer[]>();
    for (const p of this.peers.values()) {
      const l = byLoc.get(p.loc);
      if (l) l.push(p); else byLoc.set(p.loc, [p]);
    }
    for (const c of this.clients) {
      const me = this.peers.get(c.sessionId);
      if (!me) continue;
      const near = byLoc.get(me.loc)!;
      if (near.length < 2) continue;
      const snap: SnapMsg = [];
      for (const o of near) if (o.id !== me.id) snap.push([o.id, Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10, Math.round(o.f * 100) / 100, o.mv]);
      c.send('snap', snap);
    }
  }
}
