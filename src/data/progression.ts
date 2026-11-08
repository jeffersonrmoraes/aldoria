import { CLASS_BY_ID } from './classes';
import { ABILITIES, Ability, ABILITY_NAMES, ABILITY_SHORT, Bonus, addBonus, bonusLines } from './rules';

/**
 * Árvores de progressão de cada classe.
 *  - Habilidades: um ramo para cada habilidade da classe (Potência → Eficiência → Maestria) + um ramo de treino passivo.
 *  - Atributos: três caminhos (atributo principal, Constituição e um terceiro) com nós que sobem os valores de atributo.
 * Pontos: 1 de habilidade por nível (+1 nos níveis 5, 10, 15 e 20), 1 de atributo por nível a partir do 2 (+1 nos níveis 5, 10, 15 e 20).
 */
export interface SkillMod { dmgPct?: number; cdPct?: number; costPct?: number }
export interface TreeNode {
  id: string; name: string; icon: string; desc: string;
  branch: number; tier: number; cost: number;
  req?: string;
  skill?: number; mod?: SkillMod;
  bonus?: Bonus;
  ab?: Partial<Record<Ability, number>>;
}
export interface Tree { title: string; branches: { name: string; icon: string }[]; nodes: TreeNode[] }

const bonusPts = (level: number) => (level >= 5 ? 1 : 0) + (level >= 10 ? 1 : 0) + (level >= 15 ? 1 : 0) + (level >= 20 ? 1 : 0);
export const skillPointsTotal = (level: number) => level + bonusPts(level);
export const attrPointsTotal = (level: number) => Math.max(0, level - 1) + bonusPts(level);

const PASSIVES: Record<'melee' | 'magic' | 'ranged', { name: string; icon: string; b: Bonus }[]> = {
  melee: [
    { name: 'Treino de Combate', icon: '🏋️', b: { hp: 12 } },
    { name: 'Golpes Precisos', icon: '🎯', b: { dmg: 2, crit: 0.03 } },
    { name: 'Sede de Batalha', icon: '🩸', b: { lifesteal: 0.04, ac: 1 } },
  ],
  magic: [
    { name: 'Reserva Arcana', icon: '🔷', b: { energy: 25 } },
    { name: 'Foco de Conjuração', icon: '✨', b: { dmgPct: 0.08, regenEn: 1 } },
    { name: 'Poder Desperto', icon: '🌟', b: { dmg: 2, crit: 0.04 } },
  ],
  ranged: [
    { name: 'Olho de Águia', icon: '🦅', b: { crit: 0.04 } },
    { name: 'Pés Leves', icon: '👟', b: { speed: 0.05, dmg: 1 } },
    { name: 'Disparo Rápido', icon: '🏹', b: { dmgPct: 0.1, atkSpeed: 0.06 } },
  ],
};
// toques de personalidade por classe (somados ao 3º nó do ramo passivo)
const FLAVOR: Record<string, Bonus> = {
  cleric: { regenHp: 0.5 }, paladin: { regenHp: 0.5 }, druid: { regenHp: 0.4 }, necromancer: { lifesteal: 0.03 }, monk: { speed: 0.04 },
  rogue: { speed: 0.04 }, barbarian: { hp: 15 }, warlock: { lifesteal: 0.03 }, bard: { energy: 15 }, bladesinger: { atkSpeed: 0.04 },
};

const treeCache: Record<string, Tree> = {};
export function skillTree(cid: string): Tree {
  if (treeCache[cid]) return treeCache[cid];
  const cls = CLASS_BY_ID[cid];
  const nodes: TreeNode[] = [];
  const branches: { name: string; icon: string }[] = [];
  cls.skills.forEach((sk, i) => {
    branches.push({ name: sk.name, icon: sk.icon });
    const dmgKind = !['heal', 'buff'].includes(sk.kind);
    nodes.push(
      { id: `s${i}a`, name: dmgKind ? 'Potência' : 'Intensidade', icon: '💥', desc: dmgKind ? '+18% de dano da habilidade' : '+20% de efeito', branch: i, tier: 1, cost: 1, skill: i, mod: { dmgPct: dmgKind ? 0.18 : 0.2 } },
      { id: `s${i}b`, name: 'Eficiência', icon: '⏳', desc: '-15% de recarga e -15% de custo de energia', branch: i, tier: 2, cost: 1, req: `s${i}a`, skill: i, mod: { cdPct: 0.15, costPct: 0.15 } },
      { id: `s${i}c`, name: 'Maestria', icon: '👑', desc: dmgKind ? '+30% de dano e -10% de recarga' : '+30% de efeito e -10% de recarga', branch: i, tier: 3, cost: 2, req: `s${i}b`, skill: i, mod: { dmgPct: 0.3, cdPct: 0.1 } },
    );
  });
  branches.push({ name: 'Treino', icon: '📜' });
  const ps = PASSIVES[cls.style];
  ps.forEach((p, k) => {
    const b: Bonus = { ...p.b };
    if (k === 2 && FLAVOR[cid]) addBonus(b, FLAVOR[cid]);
    nodes.push({ id: `p${k}`, name: p.name, icon: p.icon, desc: bonusLines(b).join(', '), branch: 3, tier: k + 1, cost: k === 2 ? 2 : 1, req: k ? `p${k - 1}` : undefined, bonus: b });
  });
  return (treeCache[cid] = { title: `Árvore de Habilidades — ${cls.name}`, branches, nodes });
}

const ATREE_CACHE: Record<string, Tree> = {};
const AB_ICON: Record<Ability, string> = { str: '💪', dex: '🏃', con: '🛡️', int: '📘', wis: '🔮', cha: '🎭' };
export function attrTree(cid: string): Tree {
  if (ATREE_CACHE[cid]) return ATREE_CACHE[cid];
  const cls = CLASS_BY_ID[cid];
  const third: Ability = cls.priority.find((a) => a !== cls.primary && a !== 'con') ?? 'dex';
  const stats: Ability[] = [cls.primary, 'con', third];
  const branches = stats.map((a) => ({ name: ABILITY_NAMES[a], icon: AB_ICON[a] }));
  const nodes: TreeNode[] = [];
  const mageish = cls.style === 'magic';
  const extras: Bonus[][] = [
    [{}, { dmg: 1 }, { crit: 0.02 }, { dmgPct: 0.06 }],                                         // principal
    [{}, { hp: 10 }, { ac: 1 }, { hp: 20, regenHp: 0.5 }],                                       // constituição
    mageish ? [{}, { energy: 12 }, { regenEn: 1 }, { energy: 20, crit: 0.03 }] : [{}, { speed: 0.03 }, { atkSpeed: 0.03 }, { speed: 0.03, crit: 0.03 }], // terceiro
  ];
  const names = ['Treino', 'Disciplina', 'Maestria', 'Ápice'];
  const costs = [1, 1, 2, 2];
  stats.forEach((a, bi) => {
    for (let t = 0; t < 4; t++) {
      const bonus = extras[bi][t];
      const ab = { [a]: t === 3 ? 2 : 1 } as Partial<Record<Ability, number>>;
      const id = `a${bi}_${t}`;
      const lines = [`+${ab[a]} ${ABILITY_SHORT[a]}`, ...bonusLines(bonus)];
      nodes.push({ id, name: `${names[t]} de ${ABILITY_NAMES[a]}`, icon: AB_ICON[a], desc: lines.join(', '), branch: bi, tier: t + 1, cost: costs[t], req: t ? `a${bi}_${t - 1}` : undefined, ab, bonus: Object.keys(bonus).length ? bonus : undefined });
    }
  });
  return (ATREE_CACHE[cid] = { title: `Árvore de Atributos — ${cls.name}`, branches, nodes });
}

export interface ProgState { classId: string; level: number; skills?: Record<string, 1>; attrs?: Record<string, 1> }
export const spentOf = (tree: Tree, owned?: Record<string, 1>) => tree.nodes.reduce((a, n) => a + (owned?.[n.id] ? n.cost : 0), 0);
export const skillPointsLeft = (p: ProgState) => skillPointsTotal(p.level) - spentOf(skillTree(p.classId), p.skills);
export const attrPointsLeft = (p: ProgState) => attrPointsTotal(p.level) - spentOf(attrTree(p.classId), p.attrs);

export function nodeState(p: ProgState, kind: 'skills' | 'attrs', n: TreeNode): 'owned' | 'open' | 'locked' | 'nopoints' {
  const owned = p[kind];
  if (owned?.[n.id]) return 'owned';
  if (n.req && !owned?.[n.req]) return 'locked';
  const left = kind === 'skills' ? skillPointsLeft(p) : attrPointsLeft(p);
  return left >= n.cost ? 'open' : 'nopoints';
}
export function buyNode(p: ProgState, kind: 'skills' | 'attrs', id: string): boolean {
  const tree = kind === 'skills' ? skillTree(p.classId) : attrTree(p.classId);
  const n = tree.nodes.find((x) => x.id === id);
  if (!n || nodeState(p, kind, n) !== 'open') return false;
  (p[kind] ??= {})[id] = 1;
  return true;
}

/** Bônus somados de todos os nós comprados (passivos + atributos). */
export function treeTotals(p: ProgState): { bonus: Bonus; ab: Partial<Record<Ability, number>> } {
  const bonus: Bonus = {}; const ab: Partial<Record<Ability, number>> = {};
  for (const [kind, tree] of [['skills', skillTree(p.classId)], ['attrs', attrTree(p.classId)]] as const) {
    for (const n of tree.nodes) {
      if (!p[kind]?.[n.id]) continue;
      addBonus(bonus, n.bonus);
      if (n.ab) for (const a of ABILITIES) if (n.ab[a]) ab[a] = (ab[a] ?? 0) + n.ab[a]!;
    }
  }
  return { bonus, ab };
}
/** Modificadores acumulados para a habilidade de índice i (0–2). */
export function skillMod(p: ProgState, i: number): Required<SkillMod> {
  const m = { dmgPct: 0, cdPct: 0, costPct: 0 };
  if (i > 2) return m;
  for (const n of skillTree(p.classId).nodes) if (n.skill === i && p.skills?.[n.id] && n.mod) {
    m.dmgPct += n.mod.dmgPct ?? 0; m.cdPct += n.mod.cdPct ?? 0; m.costPct += n.mod.costPct ?? 0;
  }
  return m;
}
export const respecCost = (level: number) => level * 60;
