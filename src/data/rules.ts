export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma',
};
export const ABILITY_SHORT: Record<Ability, string> = {
  str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
};

export type Dice = [number, number];

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const prof = (level: number) => 2 + Math.floor((level - 1) / 4);
export const roll = (n: number, d: number) => {
  let t = 0;
  for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * d);
  return t;
};
export const d20 = () => roll(1, 20);
export const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const fmtDice = (d: Dice, bonus = 0) =>
  `${d[0]}d${d[1]}${bonus ? (bonus > 0 ? '+' + bonus : '' + bonus) : ''}`;

/** XP acumulado necessário para ALCANÇAR o nível (índice = nível-1). */
export const XP_TABLE = [0, 100, 300, 600, 1000, 1600, 2400, 3400, 4600, 6000, 7800, 9800, 12000, 14400, 17000, 19800, 22800, 26000, 29400, 33000];
export const MAX_LEVEL = XP_TABLE.length; // nível máximo 20 (como no D&D); os monstros do Capítulo 1 vão até o nível 10

export const levelFromXp = (xp: number) => {
  let l = 1;
  while (l < MAX_LEVEL && xp >= XP_TABLE[l]) l++;
  return l;
};

export type SkillKind = 'strike' | 'bolt' | 'nova' | 'cone' | 'heal' | 'buff' | 'dash' | 'drain' | 'summon';

export interface Buff {
  ac?: number; dmg?: number; speed?: number; regen?: number; atkSpeed?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  unlock: number;
  cd: number;      // ms
  cost: number;    // energia
  kind: SkillKind;
  mult?: number;   // multiplicador do dano da arma
  hits?: number;
  range?: number;
  radius?: number;
  dur?: number;    // ms (buffs)
  slow?: boolean;
  stun?: number;   // ms
  buff?: Buff;
  color?: number;
}

/** Bônus genéricos: itens, conjuntos, árvores e encantamentos usam o mesmo formato. */
export interface Bonus {
  ac?: number; hp?: number; dmg?: number; energy?: number; speed?: number;
  crit?: number;      // chance extra de crítico (0.05 = +5%)
  regenEn?: number; regenHp?: number;
  dmgPct?: number;    // aumento percentual de todo dano (0.1 = +10%)
  lifesteal?: number; // fração do dano que vira cura
  atkSpeed?: number;  // fração de redução do intervalo de ataque
  xpPct?: number; goldPct?: number;
  manaKill?: number;  // energia recuperada ao matar
}
export const BONUS_LABEL: Record<keyof Bonus, (v: number) => string> = {
  ac: (v) => `+${v} CA`, hp: (v) => `+${v} PV`, dmg: (v) => `+${v} dano`, energy: (v) => `+${v} energia`,
  speed: (v) => `+${Math.round(v * 100)}% velocidade`, crit: (v) => `+${Math.round(v * 100)}% crítico`,
  regenEn: (v) => `+${v.toFixed(1)} energia/s`, regenHp: (v) => `+${v.toFixed(1)} PV/s`,
  dmgPct: (v) => `+${Math.round(v * 100)}% dano`, lifesteal: (v) => `${Math.round(v * 100)}% de roubo de vida`,
  atkSpeed: (v) => `+${Math.round(v * 100)}% vel. de ataque`, xpPct: (v) => `+${Math.round(v * 100)}% XP`,
  goldPct: (v) => `+${Math.round(v * 100)}% ouro`, manaKill: (v) => `+${v} energia ao matar`,
};
export function addBonus(into: Bonus, b?: Bonus) {
  if (!b) return;
  for (const k of Object.keys(b) as (keyof Bonus)[]) into[k] = (into[k] ?? 0) + (b[k] ?? 0);
}
export function bonusLines(b: Bonus): string[] {
  return (Object.keys(b) as (keyof Bonus)[]).filter((k) => b[k]).map((k) => BONUS_LABEL[k](b[k]!));
}
