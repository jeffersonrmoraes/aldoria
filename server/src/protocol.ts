// Protocolo cliente <-> servidor (v1). Mantido em espelho em src/net/protocol.ts do cliente.
export const PROTOCOL = 1;

/** Dados públicos de um jogador (aparência e identificação). */
export interface PlayerInfo {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  tone: string;
  level: number;
}

/** Opções enviadas ao entrar na sala. */
export interface JoinOptions {
  v: number;
  name: string;
  raceId: string;
  classId: string;
  tone: string;
  level: number;
}

/** 'pos': cliente -> servidor (x/y em pixels do mundo, f = direção, mv = andando, loc = mapa atual). */
export interface PosMsg { x: number; y: number; f: number; mv: number; loc: string }

/** 'snap': servidor -> cliente, [id, x, y, f, mv] dos jogadores no mesmo mapa. */
export type SnapMsg = [string, number, number, number, number][];

export interface ChatMsg { id: string; name: string; t: string; ch: 'mapa' | 'sistema' }
