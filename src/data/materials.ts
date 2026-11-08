// Materiais de forja: caem dos monstros e são usados na Forja (Ferreira Durga) para criar armas e armaduras.
// Funções puras (sem DOM). Inspirado nos materiais comuns de ofício dos livros de D&D (madeira, pedra, ferro, ouro, gemas).
export type MatId = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond';
export interface Mat { id: MatId; name: string; icon: string; color: string }
export const MATS: Mat[] = [
  { id: 'wood', name: 'Madeira', icon: '🪵', color: '#c8955a' },
  { id: 'stone', name: 'Pedra', icon: '🪨', color: '#b4b9c2' },
  { id: 'iron', name: 'Ferro', icon: '⛓️', color: '#9fb4c9' },
  { id: 'gold', name: 'Ouro', icon: '🥇', color: '#ffd23f' },
  { id: 'diamond', name: 'Diamante', icon: '💎', color: '#7be8ff' },
];
export const MAT_BY_ID = Object.fromEntries(MATS.map((m) => [m.id, m])) as Record<MatId, Mat>;
export type Mats = Partial<Record<MatId, number>>;

const ri = (a: number, b: number, rnd: () => number) => a + Math.floor(rnd() * (b - a + 1));

/** Materiais largados por um monstro (chance e quantidade crescem com o nível; elites e chefes dão mais). */
export function rollMats(level: number, elite: boolean, boss: boolean, rnd: () => number = Math.random): Mats {
  const out: Mats = {};
  const give = (id: MatId, chance: number, lo: number, hi: number) => {
    if (rnd() < chance) out[id] = (out[id] ?? 0) + ri(lo, hi, rnd) * (elite ? 2 : 1);
  };
  const k = boss ? 3 : elite ? 2.5 : 1;
  const bonus = Math.floor(level / 6);
  give('wood', Math.min(0.9, 0.24 * k), 1, 2 + bonus);
  give('stone', Math.min(0.9, 0.22 * k), 1, 2 + bonus);
  give('iron', Math.min(0.9, 0.14 * k), 1, 2 + bonus);
  give('gold', Math.min(0.9, (0.045 + level * 0.002) * k), 1, 1 + Math.floor(bonus / 2));
  give('diamond', Math.min(0.9, (0.01 + level * 0.0012) * k), 1, 1);
  if (boss) {                                           // chefes sempre dão materiais bons
    out.iron = (out.iron ?? 0) + ri(4, 8, rnd); out.stone = (out.stone ?? 0) + ri(3, 6, rnd);
    out.wood = (out.wood ?? 0) + ri(3, 6, rnd); out.gold = (out.gold ?? 0) + ri(2, 4, rnd);
    if (rnd() < 0.45) out.diamond = (out.diamond ?? 0) + ri(1, 2, rnd);
  }
  return out;
}

/** Custo de forjar um item: corpo (ferro ou madeira), pedra, ouro e diamante crescem com a raridade (0 Comum … 4 Lendário). */
export function craftCost(metal: boolean, rarity: number, minLevel: number): Mats {
  const f = 1 + minLevel / 12;
  const body = Math.round([4, 8, 14, 22, 36][rarity] * f);
  const cost: Mats = { [metal ? 'iron' : 'wood']: body, stone: Math.round([2, 4, 8, 12, 18][rarity] * f) };
  if (rarity >= 2) cost.gold = [0, 0, 3, 6, 10][rarity];
  if (rarity >= 3) cost.diamond = [0, 0, 0, 2, 5][rarity];
  return cost;
}
export const canPay = (have: Mats | undefined, cost: Mats) => (Object.keys(cost) as MatId[]).every((k) => (have?.[k] ?? 0) >= (cost[k] ?? 0));
export const addMats = (have: Mats, add: Mats) => { for (const k of Object.keys(add) as MatId[]) have[k] = (have[k] ?? 0) + (add[k] ?? 0); };
export const payMats = (have: Mats, cost: Mats) => { for (const k of Object.keys(cost) as MatId[]) have[k] = (have[k] ?? 0) - (cost[k] ?? 0); };
export const fmtMats = (m: Mats) => MATS.filter((x) => m[x.id]).map((x) => `${x.icon} ${m[x.id]} ${x.name}`).join(' · ');
