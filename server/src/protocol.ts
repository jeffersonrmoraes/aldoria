// Protocolo cliente <-> servidor (v3). Mantido em espelho em src/net/protocol.ts do cliente.
export const PROTOCOL = 7;

/** Dados públicos de um jogador (aparência e identificação). */
export interface PlayerInfo {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  tone: string;
  level: number;
  /** aparência (cabelo, olhos…), validada por `sanitizeLook`; ausente = visual original */
  look?: Record<string, unknown>;
}

/** Opções enviadas ao entrar na sala. */
export interface JoinOptions {
  v: number;
  name: string;
  raceId: string;
  classId: string;
  tone: string;
  level: number;
  look?: Record<string, unknown>;
  /** token da conta (login em /api/login) */
  tok: string;
}

/** 'pos': cliente -> servidor (x/y em pixels do mundo, f = direção, mv = andando, loc = mapa atual, dd = morto). */
export interface PosMsg { x: number; y: number; f: number; mv: number; loc: string; dd?: 0 | 1 }

/** 'sheet': ficha do personagem declarada pelo cliente (o servidor valida e recalcula tudo a partir dela). */
export interface SheetMsg {
  raceId: string; classId: string; level: number;
  equipped: Record<string, unknown>;
  skills?: Record<string, 1>; attrs?: Record<string, 1>; wskills?: Record<string, 1>;
}

/** 'atk': ataque básico contra o monstro de índice m. */
export interface AtkMsg { m: number }
/** 'sk': uso da habilidade i (alvo m opcional; a = ângulo do cone). */
export interface SkMsg { i: number; m?: number; a?: number }
/** 'mn': golpe de um aliado invocado no monstro m. */
export interface MnMsg { m: number }

/** 'ready': servidor -> cliente, o mundo aberto é simulado no servidor (n = pontos de spawn, h = assinatura do mundo). */
export interface ReadyMsg { n: number; h: string }
/** fase 3b: o servidor recusou itens da ficha declarada (inválidos para o gerador do jogo) */
export interface WarnMsg { items: string[] }
/** 'mobs': servidor -> cliente, lista plana [idx, x, y, hp, flags, face] por monstro próximo. flags: 1 morto, 2 perseguindo, 4 andando. */
export type MobsMsg = number[];
/** 'hit': resultado de um golpe num monstro. k: h acerto, m erro, p proc/dot, d dreno. */
export interface HitMsg { m: number; d: number; c: 0 | 1; k: 'h' | 'm' | 'p' | 'd'; by: string; col?: number }
/** 'matk': um monstro atacou (animação). */
export interface MAtkMsg { m: number }
/** 'hurt': dano recebido pelo jogador (d = 0 significa que esquivou). */
export interface HurtMsg { m: number; d: number; c: 0 | 1 }
/** 'kill': recompensa (XP e ouro calculados pelo servidor) para quem participou da morte. */
export interface KillMsg { m: number; def: string; xp: number; gold: number; elite: 0 | 1 }

/** 'snap': servidor -> cliente, [id, x, y, f, mv] dos jogadores no mesmo mapa. */
export type SnapMsg = [string, number, number, number, number][];

export interface ChatMsg { id: string; name: string; t: string; ch: 'mapa' | 'sistema' | 'grupo' }
