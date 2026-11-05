import { Client, Room } from '@colyseus/core';
import { ChatMsg, JoinOptions, PlayerInfo, PosMsg, PROTOCOL, SnapMsg } from './protocol.js';

interface Peer extends PlayerInfo {
  x: number; y: number; f: number; mv: number; loc: string;
  lastPos: number; lastChat: number; chatBurst: number;
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

/** Sala única do mundo: presença, movimento e chat. O servidor só repassa e valida; o combate ainda é local (fase 1). */
export class WorldRoom extends Room {
  maxClients = MAX_CLIENTS;
  private peers = new Map<string, Peer>();
  private snapTimer?: NodeJS.Timeout;

  onCreate() {
    this.setPatchRate(null); // sem estado sincronizado: usamos mensagens

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
      const loc = clean(m?.loc, 40) || 'world';
      if (loc !== p.loc) {
        const old = p.loc;
        p.loc = loc;
        // quem ficou no mapa antigo deixa de ver este jogador
        for (const c of this.clients) { if (c.sessionId !== p.id && this.peers.get(c.sessionId)?.loc === old) c.send('leave', { id: p.id, moved: true }); }
        this.sendRoster(client);
      }
    });

    this.onMessage('chat', (client, m: { t: string }) => {
      const p = this.peers.get(client.sessionId);
      if (!p) return;
      const t = clean(m?.t, 200);
      if (!t) return;
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
  }

  onDispose() { if (this.snapTimer) clearInterval(this.snapTimer); }

  onAuth(_client: Client, options: JoinOptions) {
    if (!options || options.v !== PROTOCOL) throw new Error('Versão do jogo incompatível. Recarregue a página (Ctrl+F5).');
    return true;
  }

  onJoin(client: Client, o: JoinOptions) {
    const p: Peer = {
      id: client.sessionId,
      name: clean(o.name, 16) || 'Aventureiro',
      raceId: clean(o.raceId, 20), classId: clean(o.classId, 20), tone: clean(o.tone, 12),
      level: num(o.level, 1, 99, 1),
      x: 0, y: 0, f: 0, mv: 0, loc: 'world',
      lastPos: 0, lastChat: 0, chatBurst: 0,
    };
    this.peers.set(client.sessionId, p);
    client.send('welcome', { id: p.id, online: this.peers.size });
    this.sendRoster(client);
    this.notifyOthers(p, 'join', this.info(p));
    this.broadcast('online', { n: this.peers.size });
    console.log(`[+] ${p.name} entrou (${this.peers.size} online)`);
  }

  onLeave(client: Client) {
    const p = this.peers.get(client.sessionId);
    this.peers.delete(client.sessionId);
    if (p) {
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
