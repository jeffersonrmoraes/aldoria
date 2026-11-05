// Cliente de rede (Colyseus): presença, movimento e chat. Falhas nunca derrubam o jogo: ele segue offline.
import { Client, Room } from 'colyseus.js';
import { ChatMsg, JoinOptions, PlayerInfo, PosMsg, PROTOCOL, SnapMsg } from './protocol';
import { serverUrl } from './config';

export type RemoteInfo = PlayerInfo & { x?: number; y?: number };
export type NetStatus = 'off' | 'connecting' | 'on' | 'error';

export interface NetHandlers {
  status(s: NetStatus, detail?: string): void;
  roster(list: RemoteInfo[]): void;
  join(p: RemoteInfo): void;
  leave(id: string): void;
  snap(s: SnapMsg): void;
  chat(m: ChatMsg): void;
}

export class NetClient {
  status: NetStatus = 'off';
  selfId = '';
  online = 0;
  private room: Room | null = null;
  private lastSend = 0;
  private last = { x: 0, y: 0, f: 0, mv: 0, loc: '' };
  private closed = false;

  constructor(private h: NetHandlers) {}

  async connect(me: Omit<JoinOptions, 'v'>) {
    this.closed = false;
    this.set('connecting', 'Conectando ao servidor… (pode levar até 1 minuto se ele estava dormindo)');
    try {
      const client = new Client(serverUrl());
      const room = await Promise.race([
        client.joinOrCreate('world', { ...me, v: PROTOCOL } satisfies JoinOptions),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), 70000)),
      ]);
      if (this.closed) { room.leave(); return; }
      this.room = room;
      room.onMessage('welcome', (m: { id: string; online: number }) => { this.selfId = m.id; this.online = m.online; this.set('on', `Online · ${m.online} no reino`); });
      room.onMessage('roster', (l: RemoteInfo[]) => this.h.roster(l));
      room.onMessage('join', (p: RemoteInfo) => this.h.join(p));
      room.onMessage('online', (m: { n: number }) => { this.online = m.n; this.set('on', `Online · ${m.n} no reino`); });
      room.onMessage('leave', (m: { id: string }) => this.h.leave(m.id));
      room.onMessage('snap', (s: SnapMsg) => this.h.snap(s));
      room.onMessage('chat', (m: ChatMsg) => this.h.chat(m));
      room.onLeave(() => { this.room = null; if (!this.closed) this.set('error', 'Conexão perdida — jogando offline.'); });
      room.onError((_c, msg) => this.set('error', `Erro de rede: ${msg}`));
    } catch (e) {
      if (this.closed) return;
      const msg = e instanceof Error ? e.message : String(e);
      this.set('error', `Servidor indisponível (${msg}) — jogando offline.`);
    }
  }

  /** Envia a posição (no máximo ~10x/s; reenvia a cada 1 s mesmo parado). */
  tick(now: number, x: number, y: number, f: number, mv: boolean, loc: string) {
    if (!this.room || this.status !== 'on') return;
    const l = this.last, m = mv ? 1 : 0;
    const changed = Math.abs(x - l.x) > 0.5 || Math.abs(y - l.y) > 0.5 || Math.abs(f - l.f) > 0.05 || m !== l.mv || loc !== l.loc;
    if (now - this.lastSend < (changed ? 100 : 1000)) return;
    this.lastSend = now;
    this.last = { x, y, f, mv: m, loc };
    this.room.send('pos', { x, y, f, mv: m, loc } satisfies PosMsg);
  }

  chat(t: string) { if (this.room && this.status === 'on') this.room.send('chat', { t }); }

  disconnect() {
    this.closed = true;
    try { this.room?.leave(); } catch { /* ignora */ }
    this.room = null;
    this.status = 'off';
  }

  private set(s: NetStatus, detail?: string) { this.status = s; this.h.status(s, detail); }
}
