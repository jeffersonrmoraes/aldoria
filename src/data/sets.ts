import { Bonus, bonusLines } from './rules';

/** Conjuntos de equipamento (regra da casa inspirada nos itens de conjunto do D&D): 2, 3 ou 4 peças dão bônus cumulativos. */
export type SetSlot = 'head' | 'body' | 'legs' | 'offhand';
export interface SetDef {
  id: string;
  name: string;
  /** nomes-base de cada peça (o item pode ter sufixo de raridade: "Manto da Lich do Rei Caído") */
  pieces: Partial<Record<SetSlot, string>>;
  /** bônus por número de peças equipadas (valores acumulam) */
  bonus: { n: number; b: Bonus }[];
  icon: string;
}

export const SETS: SetDef[] = [
  { id: 'aprendiz', name: 'Traje do Aprendiz', icon: '🎩', pieces: { body: 'Túnica Simples', head: 'Chapéu de Aprendiz', legs: 'Calças de Viagem' },
    bonus: [{ n: 2, b: { energy: 10 } }, { n: 3, b: { dmg: 1, energy: 10 } }] },
  { id: 'runico', name: 'Conjunto Rúnico', icon: '🔷', pieces: { body: 'Robe Rúnico', head: 'Capuz Arcano', legs: 'Calças Rúnicas' },
    bonus: [{ n: 2, b: { energy: 20 } }, { n: 3, b: { dmgPct: 0.06, regenEn: 1 } }] },
  { id: 'arquimago', name: 'Regalia do Arquimago', icon: '🧙', pieces: { body: 'Manto do Arquimago', head: 'Chapéu do Arquimago', legs: 'Calças Estelares', offhand: 'Orbe do Arquimago' },
    bonus: [{ n: 2, b: { energy: 30 } }, { n: 3, b: { dmgPct: 0.1, dmg: 2 } }, { n: 4, b: { energy: 40, dmgPct: 0.1, crit: 0.05 } }] },
  { id: 'mosteiro', name: 'Hábito do Mosteiro', icon: '🥋', pieces: { body: 'Hábito do Mosteiro', head: 'Capuz do Mosteiro', legs: 'Faixas de Combate do Mosteiro' },
    bonus: [{ n: 2, b: { speed: 0.04, hp: 10 } }, { n: 3, b: { atkSpeed: 0.06, ac: 1 } }] },
  { id: 'punhoceleste', name: 'Punho Celestial', icon: '☯️', pieces: { body: 'Vestes do Punho Celestial', head: 'Coroa do Mestre Ki', legs: 'Calças do Punho Celestial' },
    bonus: [{ n: 2, b: { speed: 0.05, hp: 15 } }, { n: 3, b: { atkSpeed: 0.1, dmgPct: 0.08, crit: 0.05 } }] },
  { id: 'necro', name: 'Mortalha do Necromante', icon: '💀', pieces: { body: 'Manto do Necromante', head: 'Capuz Sepulcral', legs: 'Calças Sepulcrais', offhand: 'Crânio Ritual' },
    bonus: [{ n: 2, b: { lifesteal: 0.03 } }, { n: 3, b: { dmgPct: 0.08, energy: 20 } }, { n: 4, b: { manaKill: 5, lifesteal: 0.03 } }] },
  { id: 'lich', name: 'Panóplia da Lich', icon: '☠️', pieces: { body: 'Manto da Lich', head: 'Coroa da Lich', legs: 'Calças da Lich', offhand: 'Filactério' },
    bonus: [{ n: 2, b: { energy: 30 } }, { n: 3, b: { dmgPct: 0.12, lifesteal: 0.04 } }, { n: 4, b: { crit: 0.06, manaKill: 7, dmg: 3 } }] },
  { id: 'couro', name: 'Couro do Batedor', icon: '🧥', pieces: { body: 'Gibão de Couro', head: 'Capuz de Couro', legs: 'Perneiras de Couro' },
    bonus: [{ n: 2, b: { speed: 0.03 } }, { n: 3, b: { crit: 0.04, dmg: 1 } }] },
  { id: 'batido', name: 'Couro do Caçador', icon: '🏹', pieces: { body: 'Couro Batido', head: 'Capelo Reforçado', legs: 'Perneiras Batidas' },
    bonus: [{ n: 2, b: { crit: 0.03, ac: 1 } }, { n: 3, b: { speed: 0.04, dmg: 1 } }] },
  { id: 'dragaoverde', name: 'Couro do Dragão Verde', icon: '🐉', pieces: { body: 'Couro de Dragão Verde', head: 'Capuz de Couro de Dragão', legs: 'Perneiras de Couro de Dragão' },
    bonus: [{ n: 2, b: { crit: 0.05, speed: 0.04 } }, { n: 3, b: { dmgPct: 0.12, atkSpeed: 0.08, ac: 1 } }] },
  { id: 'menestrel', name: 'Trajes do Menestrel', icon: '🎶', pieces: { body: 'Gibão do Menestrel', head: 'Chapéu de Menestrel', legs: 'Botas de Menestrel' },
    bonus: [{ n: 2, b: { energy: 15, speed: 0.03 } }, { n: 3, b: { dmgPct: 0.06, crit: 0.04 } }] },
  { id: 'malha', name: 'Malha do Soldado', icon: '⛓️', pieces: { body: 'Camisão de Malha', head: 'Elmo de Ferro', legs: 'Grevas de Malha' },
    bonus: [{ n: 2, b: { hp: 12 } }, { n: 3, b: { ac: 1, dmg: 1 } }] },
  { id: 'aco', name: 'Aço do Veterano', icon: '🛡️', pieces: { body: 'Brunea', head: 'Elmo de Aço', legs: 'Grevas de Aço', offhand: 'Escudo de Aço' },
    bonus: [{ n: 2, b: { hp: 20 } }, { n: 3, b: { ac: 1, dmgPct: 0.05 } }, { n: 4, b: { hp: 25, ac: 1 } }] },
  { id: 'mithral', name: 'Mithral Élfico', icon: '✨', pieces: { body: 'Brunea de Mithral', head: 'Elmo de Mithral', legs: 'Grevas de Mithral' },
    bonus: [{ n: 2, b: { ac: 1, hp: 20 } }, { n: 3, b: { speed: 0.05, dmgPct: 0.08, ac: 1 } }] },
  { id: 'placas', name: 'Placas do Cavaleiro', icon: '🏰', pieces: { body: 'Cota de Malha', head: 'Elmo Grande', legs: 'Grevas de Placas' },
    bonus: [{ n: 2, b: { hp: 18 } }, { n: 3, b: { ac: 2, regenHp: 0.5 } }] },
  { id: 'loriga', name: 'Loriga do Guardião', icon: '🗡️', pieces: { body: 'Loriga Segmentada', head: 'Elmo de Placas', legs: 'Grevas Segmentadas', offhand: 'Escudo do Guardião' },
    bonus: [{ n: 2, b: { hp: 25 } }, { n: 3, b: { ac: 2, dmgPct: 0.05 } }, { n: 4, b: { hp: 30, regenHp: 1 } }] },
  { id: 'adamantina', name: 'Adamantina Anã', icon: '💎', pieces: { body: 'Placas de Adamantina', head: 'Elmo de Adamantina', legs: 'Grevas de Adamantina', offhand: 'Escudo de Mithral' },
    bonus: [{ n: 2, b: { hp: 40 } }, { n: 3, b: { ac: 3, dmgPct: 0.1 } }, { n: 4, b: { regenHp: 1.5, lifesteal: 0.04, crit: 0.05 } }] },
  { id: 'carvalho', name: 'Guardião do Carvalho', icon: '🌳', pieces: { body: 'Casca de Carvalho', head: 'Coroa de Folhas', legs: 'Perneiras de Casca', offhand: 'Totem Druídico' },
    bonus: [{ n: 2, b: { regenHp: 0.5, hp: 10 } }, { n: 3, b: { dmgPct: 0.06, energy: 15 } }, { n: 4, b: { regenHp: 1, regenEn: 1 } }] },
  { id: 'urso', name: 'Peles do Urso Furioso', icon: '🐻', pieces: { body: 'Peles de Urso', head: 'Elmo de Chifres', legs: 'Calças de Pele' },
    bonus: [{ n: 2, b: { hp: 20 } }, { n: 3, b: { dmg: 2, lifesteal: 0.03 } }] },
  { id: 'sol', name: 'Aurora do Sol', icon: '☀️', pieces: { body: 'Couraça do Sol', head: 'Elmo do Sol', legs: 'Grevas do Sol', offhand: 'Símbolo do Sol' },
    bonus: [{ n: 2, b: { hp: 15, regenHp: 0.4 } }, { n: 3, b: { dmgPct: 0.06, ac: 1 } }, { n: 4, b: { regenHp: 1, energy: 20 } }] },
];

export const SET_BY_ID: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.id, s]));

const PIECE_INDEX: { slot: string; base: string; id: string }[] = [];
for (const s of SETS) for (const [slot, base] of Object.entries(s.pieces)) PIECE_INDEX.push({ slot, base: base!, id: s.id });
// nomes mais longos primeiro ("Brunea de Mithral" antes de "Brunea")
PIECE_INDEX.sort((a, b) => b.base.length - a.base.length);

/** Qual conjunto uma peça (slot + nome-base) integra. */
export function setForBase(slot: string, baseName: string): string | undefined {
  return PIECE_INDEX.find((p) => p.slot === slot && baseName.startsWith(p.base))?.id;
}

interface HasSet { set?: string }
export interface ActiveSet { def: SetDef; n: number; bonus: Bonus; next?: { n: number; b: Bonus } }

export function activeSets(eq: Partial<Record<string, HasSet | undefined>>): ActiveSet[] {
  const cnt: Record<string, number> = {};
  for (const it of Object.values(eq)) if (it?.set) cnt[it.set] = (cnt[it.set] ?? 0) + 1;
  const out: ActiveSet[] = [];
  for (const [id, n] of Object.entries(cnt)) {
    const def = SET_BY_ID[id];
    if (!def) continue;
    const b: Bonus = {};
    for (const t of def.bonus) if (n >= t.n) for (const k of Object.keys(t.b) as (keyof Bonus)[]) b[k] = (b[k] ?? 0) + (t.b[k] ?? 0);
    out.push({ def, n, bonus: b, next: def.bonus.find((t) => t.n > n) });
  }
  return out;
}

/** HTML com as peças e bônus do conjunto (para dicas de item e janela do personagem). */
export function setTipHtml(def: SetDef, owned: Set<string>): string {
  const slots = Object.entries(def.pieces) as [SetSlot, string][];
  const have = slots.filter(([s]) => owned.has(s)).length;
  const rows = slots.map(([s, n]) => `<div style="opacity:${owned.has(s) ? 1 : 0.45}">${owned.has(s) ? '◆' : '◇'} ${n}</div>`).join('');
  const bon = def.bonus.map((t) => `<div style="color:${have >= t.n ? '#7ee787' : '#8d85a8'}">(${t.n}) ${bonusLines(t.b).join(', ')}</div>`).join('');
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #4a4170"><b style="color:#ffd23f">${def.icon} ${def.name} (${have}/${slots.length})</b>${rows}${bon}</div>`;
}
