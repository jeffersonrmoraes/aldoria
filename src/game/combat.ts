// Regras de combate PURAS (sem DOM/Three), compartilhadas entre o cliente e o servidor online.
// O servidor usa as mesmas fórmulas para validar dano e XP.
import { Buff, SkillDef, d20, roll } from '../data/rules';
import { CLASS_BY_ID } from '../data/classes';
import { RACE_BY_ID } from '../data/races';
import { skillMod, skillModById } from '../data/progression';
import { weaponModById, weaponSkillMod } from '../data/weapontree';
import { EXTRA_BY_ID } from '../data/extraskills';
import { WEAPON_SKILLS, weaponFamily } from '../data/weaponskills';
import { MobDef } from '../data/monsters';
import { Derived, PlayerState } from './state';

/** Habilidade com os bônus da árvore de habilidades aplicados (dano, recarga, custo). */
/** Habilidade extra (de classe ou do tipo de arma empunhado) com os bônus da árvore aplicados. */
function extraAt(p: PlayerState, id?: string): SkillDef | undefined {
  const base = id ? EXTRA_BY_ID[id] : undefined;
  if (!base || p.level < base.unlock) return undefined;
  const isClass = base.id.startsWith('c_');
  if (isClass ? base.id.slice(2, base.id.lastIndexOf('_x')) !== p.classId : base.id.slice(2, base.id.lastIndexOf('_x')) !== weaponFamily(p.equipped.mainhand?.name)) return undefined;
  const m = isClass ? skillModById(p, base.id) : weaponModById(p, base.id);
  return {
    ...base,
    mult: base.mult != null ? +(base.mult * (1 + m.dmgPct)).toFixed(3) : base.mult,
    dur: base.dur != null && base.kind === 'buff' ? Math.round(base.dur * (1 + m.dmgPct)) : base.dur,
    cd: Math.round(base.cd * (1 - m.cdPct)), cost: Math.max(4, Math.round(base.cost * (1 - m.costPct))),
  };
}
export function skillAt(p: PlayerState, i: number): SkillDef | undefined {
  if (i === 3) return RACE_BY_ID[p.raceId].racial;
  if (i < 0 || i > 8) return undefined;
  if (i >= 6) return extraAt(p, p.bar?.[i - 6]);
  const wi = i - 4;
  const base = i >= 4 ? WEAPON_SKILLS[weaponFamily(p.equipped.mainhand?.name)][wi] : CLASS_BY_ID[p.classId].skills[i];   // 4–5: habilidades da arma empunhada
  if (!base) return undefined;
  const m = i >= 4 ? weaponSkillMod(p, wi) : skillMod(p, i);
  if (!m.dmgPct && !m.cdPct && !m.costPct) return base;
  return {
    ...base,
    mult: base.mult != null ? +(base.mult * (1 + m.dmgPct)).toFixed(3) : base.mult,
    dur: base.dur != null ? Math.round(base.dur * (1 + m.dmgPct)) : base.dur,
    cd: Math.round(base.cd * (1 - m.cdPct)), cost: Math.max(4, Math.round(base.cost * (1 - m.costPct))),
  };
}

/** Dano de uma habilidade (mult) ou ataque básico (mult = 1): dados da arma + bônus, com crítico. */
export function calcDamage(d: Derived, mult: number, buffDmg: number): { dmg: number; crit: boolean } {
  const crit = d20() >= d.crit || Math.random() < d.critPct;
  let dmg = roll(d.dice[0], d.dice[1]);
  if (crit) dmg += roll(d.dice[0], d.dice[1]);
  return { dmg: Math.max(1, Math.round((dmg + d.dmgBonus + buffDmg) * mult * (1 + d.dmgPct))), crit };
}

/** Ataque básico (d20 contra a CA do alvo). `disadv`: atirar com inimigo adjacente ou além do alcance normal. */
export function basicHit(d: Derived, p: Pick<PlayerState, 'raceId'>, ac: number, buffDmg: number, disadv: boolean): { hit: boolean; crit: boolean; dmg: number } {
  let r = d20();
  if (r === 1 && RACE_BY_ID[p.raceId].mods.luck) r = d20();
  if (disadv) r = Math.min(r, d20());
  const crit = r >= d.crit || (r !== 1 && Math.random() < d.critPct);
  const hit = r !== 1 && (crit || r + d.atk >= ac);
  let dmg = roll(d.dice[0], d.dice[1]);
  if (crit) dmg += roll(d.dice[0], d.dice[1]);
  if (d.offDice) dmg += roll(d.offDice[0], d.offDice[1]) + d.offPlus;   // ataque extra da mão esquerda
  dmg = Math.max(1, Math.round((dmg + d.dmgBonus + buffDmg) * (1 + d.dmgPct)));
  return { hit, crit, dmg };
}

/** XP concedido ao derrotar um monstro (penaliza quem é muito mais forte que ele). */
export function killXp(def: MobDef, level: number, raceId: string, xpPct: number): number {
  const diff = Math.min(level, 10) - def.level;   // acima do nível 10 a penalidade não cresce (o conteúdo do Capítulo 1 acaba no 10)
  const mult = diff >= 5 ? 0.2 : diff >= 3 ? 0.6 : 1;
  return Math.round(def.xp * mult * (1 + (RACE_BY_ID[raceId].mods.xp ?? 0) + xpPct));
}

/** Elite determinista por índice do ponto de spawn (6%): cliente e servidor concordam sem trocar mensagens. */
export const eliteAt = (i: number) => ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) < 60;

/** Soma de buffs ativos. */
export function sumBuffs(list: { until: number; buff: Buff }[], now: number): Required<Buff> {
  const s = { ac: 0, dmg: 0, speed: 0, regen: 0, atkSpeed: 0 };
  for (const b of list) if (b.until > now) for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += b.buff[k] ?? 0;
  return s;
}

/** Assinatura do mundo gerado: cliente e servidor só dividem monstros se o mundo for idêntico. */
export function worldSig(spawns: { x: number; y: number; mob: string }[]): string {
  let h = 7;
  for (const sp of spawns) h = (Math.imul(h, 31) + sp.x * 7 + sp.y * 13 + sp.mob.length) | 0;
  return `${spawns.length}:${(h >>> 0).toString(36)}`;
}
