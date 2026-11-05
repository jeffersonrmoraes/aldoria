// Validação da ficha declarada pelo cliente. Sem contas, o servidor não "conhece" o personagem: ele
// aceita a ficha, mas só depois de checar formato, limites e regras de equipamento (classe, nível, mãos).
import { CLASS_BY_ID } from '../../src/data/classes';
import { RACE_BY_ID } from '../../src/data/races';
import { ENCHANT_BY_ID } from '../../src/data/enchants';
import { MAX_LEVEL } from '../../src/data/rules';
import { Item, Slot } from '../../src/data/items';
import { PlayerState, equipBlock } from '../../src/game/state';
import type { SheetMsg } from './protocol.js';

const SLOTS: Slot[] = ['mainhand', 'body', 'head', 'legs', 'offhand', 'accessory'];   // mão principal antes da esquerda (duas mãos)
const ARMOR_TYPES = ['cloth', 'light', 'medium', 'heavy'];
const OFF_KINDS = ['shield', 'weapon', 'focus'];
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v: unknown, max = 60) => String(v ?? '').slice(0, max);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function cleanItem(slot: Slot, raw: unknown): Item | null {
  if (!isObj(raw)) return null;
  const it: Item = {
    uid: str(raw.uid, 24), name: str(raw.name), slot, rarity: Math.round(num(raw.rarity, 0, 4, 0)) as Item['rarity'],
    minLevel: Math.round(num(raw.minLevel, 1, 30, 1)), value: Math.round(num(raw.value, 0, 1e6, 0)), icon: str(raw.icon, 8),
  };
  if (raw.style === 'melee' || raw.style === 'ranged' || raw.style === 'magic') it.style = raw.style;
  if (Array.isArray(raw.dice)) it.dice = [Math.round(num(raw.dice[0], 1, 6, 1)), Math.round(num(raw.dice[1], 2, 20, 4))];
  if (raw.speed !== undefined) it.speed = num(raw.speed, 0.4, 2, 1);
  if (raw.plus !== undefined) it.plus = Math.round(num(raw.plus, 0, 12, 0));
  if (ARMOR_TYPES.includes(String(raw.armorType))) it.armorType = raw.armorType as Item['armorType'];
  if (raw.ac !== undefined) it.ac = Math.round(num(raw.ac, 0, 30, 10));
  if (raw.dexCap !== undefined) it.dexCap = Math.round(num(raw.dexCap, 0, 10, 10));
  if (OFF_KINDS.includes(String(raw.offKind))) it.offKind = raw.offKind as Item['offKind'];
  if (raw.twoHanded) it.twoHanded = true;
  if (typeof raw.set === 'string') it.set = str(raw.set);
  if (isObj(raw.stat)) {
    const st: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.stat).slice(0, 16)) if (typeof v === 'number' && Number.isFinite(v)) st[str(k, 12)] = Math.min(40, Math.max(-40, v));
    it.stat = st;
  }
  if (isObj(raw.ench) && ENCHANT_BY_ID[String(raw.ench.id)]) it.ench = { id: String(raw.ench.id), lvl: Math.round(num(raw.ench.lvl, 1, 3, 1)) };
  return it;
}

const flags = (v: unknown) => {
  const o: Record<string, 1> = {};
  if (isObj(v)) for (const k of Object.keys(v).slice(0, 120)) if (v[k]) o[str(k, 40)] = 1;
  return o;
};

/** Converte a ficha declarada em um PlayerState seguro; null se for inválida. */
export function sanitizeSheet(m: SheetMsg): PlayerState | null {
  if (!isObj(m) || !CLASS_BY_ID[String(m.classId)] || !RACE_BY_ID[String(m.raceId)]) return null;
  const p: PlayerState = {
    v: 3, name: '', raceId: String(m.raceId), classId: String(m.classId), tone: '',
    level: Math.round(num(m.level, 1, MAX_LEVEL, 1)), xp: 0, gold: 0, hp: 1, en: 1, items: [], equipped: {},
    potions: { heal: 0, energy: 0 }, quests: {}, kills: 0, pos: { x: 0, y: 0 }, story: { fragments: [], seen: {}, ended: false },
    skills: flags(m.skills), attrs: flags(m.attrs),
  };
  const eq = isObj(m.equipped) ? m.equipped : {};
  for (const sl of SLOTS) {
    const it = cleanItem(sl, eq[sl]);
    if (it && !equipBlock(p, it)) p.equipped[sl] = it;      // item que a classe/nível não pode usar é ignorado
  }
  return p;
}
