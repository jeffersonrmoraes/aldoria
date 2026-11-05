import { Bonus, bonusLines } from './rules';

/** Encantamentos de arma (3 níveis). Alguns dão bônus fixos; outros disparam efeitos ao acertar. */
export type ProcKind = 'fire' | 'frost' | 'bolt' | 'poison';
export interface EnchantDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bonus?: (lvl: number) => Bonus;
  proc?: { kind: ProcKind; chance: number[]; dmg: number[] }; // por nível
  color: string;
  minLevel: number;
}
const L = (a: number[]) => (lvl: number) => a[Math.min(2, Math.max(0, lvl - 1))];

export const ENCHANTS: EnchantDef[] = [
  { id: 'vampirism', name: 'Vampirismo', icon: '🩸', color: '#ff4d6d', desc: 'Cura você com parte do dano causado.', minLevel: 1, bonus: (l) => ({ lifesteal: L([0.04, 0.07, 0.11])(l) }) },
  { id: 'mana', name: 'Sede de Mana', icon: '🔷', color: '#6ab0ff', desc: 'Recupera energia ao derrotar um inimigo.', minLevel: 1, bonus: (l) => ({ manaKill: L([8, 14, 22])(l) }) },
  { id: 'fury', name: 'Fúria Sangrenta', icon: '😡', color: '#ff7a1a', desc: 'Aumenta todo o dano causado.', minLevel: 1, bonus: (l) => ({ dmgPct: L([0.05, 0.09, 0.14])(l) }) },
  { id: 'precision', name: 'Precisão Letal', icon: '🎯', color: '#ffd23f', desc: 'Chance extra de golpe crítico.', minLevel: 1, bonus: (l) => ({ crit: L([0.05, 0.08, 0.12])(l) }) },
  { id: 'haste', name: 'Celeridade', icon: '💨', color: '#9ee8ff', desc: 'Ataca mais depressa.', minLevel: 3, bonus: (l) => ({ atkSpeed: L([0.06, 0.1, 0.15])(l) }) },
  { id: 'fortune', name: 'Fortuna', icon: '🪙', color: '#f1c40f', desc: 'Inimigos derrotados soltam mais ouro.', minLevel: 1, bonus: (l) => ({ goldPct: L([0.1, 0.2, 0.32])(l) }) },
  { id: 'wisdom', name: 'Sabedoria', icon: '📚', color: '#c084fc', desc: 'Mais experiência dos inimigos.', minLevel: 1, bonus: (l) => ({ xpPct: L([0.08, 0.14, 0.22])(l) }) },
  { id: 'regen', name: 'Vitalidade', icon: '💚', color: '#7ee787', desc: 'Regenera vida continuamente.', minLevel: 2, bonus: (l) => ({ regenHp: L([0.6, 1.2, 2])(l) }) },
  { id: 'flow', name: 'Fluxo Arcano', icon: '🌀', color: '#7aa8ff', desc: 'Regenera energia continuamente.', minLevel: 2, bonus: (l) => ({ regenEn: L([1, 2, 3.2])(l) }) },
  { id: 'flame', name: 'Chama Eterna', icon: '🔥', color: '#ff6a1a', desc: 'Chance de queimar o alvo com dano de fogo.', minLevel: 3, proc: { kind: 'fire', chance: [0.2, 0.28, 0.36], dmg: [4, 7, 11] } },
  { id: 'frost', name: 'Toque Gélido', icon: '❄️', color: '#9be7ff', desc: 'Chance de congelar e retardar o alvo.', minLevel: 3, proc: { kind: 'frost', chance: [0.2, 0.28, 0.36], dmg: [3, 5, 8] } },
  { id: 'storm', name: 'Relâmpago', icon: '⚡', color: '#ffe96a', desc: 'Chance de lançar um raio que salta entre inimigos.', minLevel: 5, proc: { kind: 'bolt', chance: [0.18, 0.25, 0.32], dmg: [5, 9, 14] } },
  { id: 'venom', name: 'Veneno de Drow', icon: '☠️', color: '#7aff5a', desc: 'Chance de envenenar o alvo (dano ao longo do tempo).', minLevel: 4, proc: { kind: 'poison', chance: [0.25, 0.33, 0.4], dmg: [3, 5, 8] } },
];
export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

export interface Ench { id: string; lvl: number }
export const enchBonus = (e?: Ench): Bonus => { const d = e && ENCHANT_BY_ID[e.id]; return d?.bonus ? d.bonus(e!.lvl) : {}; };
export const enchProc = (e?: Ench) => {
  const d = e && ENCHANT_BY_ID[e.id];
  if (!d?.proc) return null;
  const i = Math.min(2, e!.lvl - 1);
  return { kind: d.proc.kind, chance: d.proc.chance[i], dmg: d.proc.dmg[i] };
};
export const ROMAN = ['', 'I', 'II', 'III'];
export function enchLine(e: Ench): string {
  const d = ENCHANT_BY_ID[e.id];
  if (!d) return '';
  const body = d.bonus ? bonusLines(d.bonus(e.lvl)).join(', ') : (() => { const p = enchProc(e)!; return `${Math.round(p.chance * 100)}% de chance · ${p.dmg} de dano`; })();
  return `<span style="color:${d.color}">${d.icon} ${d.name} ${ROMAN[e.lvl]}</span> — ${body}`;
}
/** custo em ouro para encantar uma arma (nível 1–3). */
export const enchantCost = (itemValue: number, lvl: number) => Math.round(itemValue * (0.6 + 0.7 * lvl) + 40 * lvl);
