// Árvore de armas: uma árvore por tipo (família) de arma, vale para qualquer classe.
// Cada árvore tem 3 ramos: Perícia (bônus passivos enquanto empunha o tipo) e uma trilha para cada uma das 2 habilidades da arma (teclas 5/6).
// Pontos de arma: 1 por nível (+1 nos níveis 5, 10, 15 e 20), compartilhados entre todas as famílias.
import { Bonus, addBonus, bonusLines } from './rules';
import type { SkillMod, Tree, TreeNode } from './progression';
import { FAMILY_NAMES, WeaponFamily, weaponFamily } from './weaponskills';

export const FAMILIES = Object.keys(FAMILY_NAMES) as WeaponFamily[];
export const weaponPointsTotal = (level: number) => level + (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 15 ? 1 : 0) + (level >= 20 ? 1 : 0);

interface WState { level: number; wskills?: Record<string, 1>; equipped: { mainhand?: { name: string } } }

const PERICIA: { name: string; icon: string; b: Bonus; cost: number }[] = [
  { name: 'Perícia', icon: '🎓', b: { dmgPct: 0.08 }, cost: 1 },
  { name: 'Técnica', icon: '🎯', b: { crit: 0.03, atkSpeed: 0.04 }, cost: 1 },
  { name: 'Mestre de Armas', icon: '🏅', b: { dmgPct: 0.1, dmg: 2 }, cost: 2 },
];
const cache: Partial<Record<WeaponFamily, Tree>> = {};
export function weaponTree(f: WeaponFamily): Tree {
  if (cache[f]) return cache[f]!;
  const nodes: TreeNode[] = [];
  PERICIA.forEach((p, t) => nodes.push({
    id: `${f}:p${t}`, name: p.name, icon: p.icon, desc: bonusLines(p.b).join(', '), branch: 0, tier: t + 1, cost: p.cost,
    req: t ? `${f}:p${t - 1}` : undefined, bonus: p.b,
  }));
  for (const s of [0, 1]) {
    const br = s + 1;
    nodes.push(
      { id: `${f}:s${s}a`, name: 'Potência', icon: '💥', desc: '+18% de dano da habilidade', branch: br, tier: 1, cost: 1, skill: s, mod: { dmgPct: 0.18 } },
      { id: `${f}:s${s}b`, name: 'Eficiência', icon: '⏳', desc: '-15% de recarga e de custo de energia', branch: br, tier: 2, cost: 1, req: `${f}:s${s}a`, skill: s, mod: { cdPct: 0.15, costPct: 0.15 } },
      { id: `${f}:s${s}c`, name: 'Maestria', icon: '👑', desc: '+30% de dano e -10% de recarga', branch: br, tier: 3, cost: 2, req: `${f}:s${s}b`, skill: s, mod: { dmgPct: 0.3, cdPct: 0.1 } },
    );
  }
  return (cache[f] = {
    title: `Árvore de Armas — ${FAMILY_NAMES[f]}`,
    branches: [{ name: 'Perícia', icon: '⚔️' }, { name: 'Habilidade 1', icon: '5️⃣' }, { name: 'Habilidade 2', icon: '6️⃣' }],
    nodes,
  });
}

export const weaponPointsSpent = (owned?: Record<string, 1>) => {
  let a = 0;
  if (owned) for (const f of FAMILIES) for (const n of weaponTree(f).nodes) if (owned[n.id]) a += n.cost;
  return a;
};
export const weaponPointsLeft = (p: WState) => weaponPointsTotal(p.level) - weaponPointsSpent(p.wskills);

export function weaponNodeState(p: WState, n: TreeNode): 'owned' | 'open' | 'locked' | 'nopoints' {
  if (p.wskills?.[n.id]) return 'owned';
  if (n.req && !p.wskills?.[n.req]) return 'locked';
  return weaponPointsLeft(p) >= n.cost ? 'open' : 'nopoints';
}
export function buyWeaponNode(p: WState, f: WeaponFamily, id: string): boolean {
  const n = weaponTree(f).nodes.find((x) => x.id === id);
  if (!n || weaponNodeState(p, n) !== 'open') return false;
  (p.wskills ??= {})[id] = 1;
  return true;
}

/** Bônus passivos da árvore de armas: só valem para o tipo de arma empunhado. */
export function weaponBonus(p: WState): Bonus {
  const b: Bonus = {};
  if (!p.wskills) return b;
  const f = weaponFamily(p.equipped.mainhand?.name);
  for (const n of weaponTree(f).nodes) if (p.wskills[n.id] && n.bonus) addBonus(b, n.bonus);
  return b;
}
/** Modificadores da habilidade de arma s (0 ou 1) do tipo empunhado. */
export function weaponSkillMod(p: WState, s: number): Required<SkillMod> {
  const m = { dmgPct: 0, cdPct: 0, costPct: 0 };
  if (!p.wskills) return m;
  const f = weaponFamily(p.equipped.mainhand?.name);
  for (const n of weaponTree(f).nodes) if (n.skill === s && p.wskills[n.id] && n.mod) {
    m.dmgPct += n.mod.dmgPct ?? 0; m.cdPct += n.mod.cdPct ?? 0; m.costPct += n.mod.costPct ?? 0;
  }
  return m;
}
