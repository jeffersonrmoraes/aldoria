import { CLASS_POWER } from '../data/balance';
import { ABILITIES, Ability, Bonus, addBonus, levelFromXp, mod, prof, XP_TABLE, MAX_LEVEL } from '../data/rules';
import { treeTotals } from '../data/progression';
import { weaponBonus } from '../data/weapontree';
import { activeSets } from '../data/sets';
import { enchBonus } from '../data/enchants';
import { ARMOR_RANK, CLASS_BY_ID, Style } from '../data/classes';
import { RACE_BY_ID } from '../data/races';
import { STARTER_WEAPONS, MONK_ONLY_RE, MONK_WEAPON_RE, allowedOff, findBase, ItemStat, Item, Slot, migrateItem, starterArmor, starterShield } from '../data/items';
import { bus } from './bus';
import { Look, sanitizeLook } from '../data/looks';
import type { Mats } from '../data/materials';

export interface QuestProgress { progress: number; state: 'active' | 'ready' | 'done'; got?: string[] }   // got: objetos já recolhidos (missões de encontrar coisas)

export interface PlayerState {
  v: number;
  name: string;
  raceId: string;
  classId: string;
  tone: string;
  look?: Look;                // aparência (cabelo, olhos, roupa…); ausente em saves antigos
  level: number;
  xp: number;
  gold: number;
  hp: number;
  en: number;
  items: Item[];
  equipped: Partial<Record<Slot, Item>>;
  potions: { heal: number; energy: number };
  mats?: Mats;                 // materiais de forja (ferro, madeira, pedra, ouro, diamante)
  quests: Record<string, QuestProgress>;
  kills: number;
  pos: { x: number; y: number };
  story: { fragments: string[]; seen: Record<string, boolean>; ended: boolean };
  /** células do mapa já exploradas ('0'/'1') */
  explored?: string;
  /** nós comprados nas árvores de habilidade e de atributos */
  skills?: Record<string, 1>;
  /** nós comprados na árvore de armas (`familia:no`) */
  wskills?: Record<string, 1>;
  attrs?: Record<string, 1>;
  /** instante do último salvamento (resolve conflito entre o save local e o da nuvem) */
  sv?: number;
}

export const BAG_SIZE = 24;

export interface Derived {
  ab: Record<Ability, number>;
  md: Record<Ability, number>;
  prof: number;
  maxHp: number;
  maxEn: number;
  ac: number;
  atk: number;
  dmgBonus: number;
  dice: [number, number];
  interval: number;
  range: number;
  style: Style;
  speed: number;
  crit: number;
  regenEn: number;
  regenHp: number;
  /** ataque extra da mão esquerda (arma leve): dados e bônus mágico, sem modificador de atributo (SRD) */
  offDice?: [number, number];
  offPlus: number;
  /** bônus percentuais e efeitos (itens, conjuntos, árvores e encantamentos) */
  critPct: number; dmgPct: number; lifesteal: number; manaKill: number; goldPct: number; xpPct: number;
  bonus: Bonus;
}

/** Multiplicador de dano de uma arma fora das armas da classe (qualquer classe pode empunhar qualquer arma, mas rende menos). */
export function weaponPenalty(classId: string, w?: Item): number {
  if (!w || w.slot !== 'mainhand') return 1;
  const cls = CLASS_BY_ID[classId];
  if (w.style !== cls.style) return 0.55;                      // estilo errado (corpo a corpo × distância × magia)
  if (cls.style === 'melee') {
    if (classId === 'monk' ? !MONK_WEAPON_RE.test(w.name) : MONK_ONLY_RE.test(w.name)) return 0.75;   // o Monge só rende com armas de monge (e as armas de monge, só com ele)
  }
  return 1;
}
export function equipWarn(p: PlayerState, i: Item): string | null {
  const m = weaponPenalty(p.classId, i);
  return m < 1 ? `⚠ Fora das armas da sua classe: dano −${Math.round((1 - m) * 100)}%` : null;
}

export function derive(p: PlayerState): Derived {
  const cls = CLASS_BY_ID[p.classId];
  const race = RACE_BY_ID[p.raceId];
  const std = [15, 14, 13, 12, 10, 8];
  const ab = {} as Record<Ability, number>;
  cls.priority.forEach((a, i) => (ab[a] = std[i]));
  for (const a of ABILITIES) ab[a] += race.bonus[a] ?? 0;
  ab[cls.primary] += 2 * Math.floor(p.level / 4); // aumento de atributo nos níveis 4 e 8
  const tt = treeTotals(p);
  for (const a of ABILITIES) ab[a] += tt.ab[a] ?? 0;
  const md = {} as Record<Ability, number>;
  for (const a of ABILITIES) md[a] = mod(ab[a]);

  const w = p.equipped.mainhand;
  const ar = p.equipped.body;
  const off = p.equipped.offhand;
  // bônus de todas as peças (elmo, pernas, mão esquerda e acessório)
  const tr: Bonus = {};
  for (const sl of ['head', 'legs', 'offhand', 'accessory', 'body', 'mainhand'] as Slot[]) addBonus(tr, p.equipped[sl]?.stat);
  for (const st of activeSets(p.equipped)) addBonus(tr, st.bonus);   // conjuntos de armadura
  addBonus(tr, enchBonus(w?.ench));                                  // encantamento da arma
  addBonus(tr, weaponBonus(p));                                      // árvore de armas (tipo empunhado)
  addBonus(tr, tt.bonus);                                            // árvores de habilidade/atributos
  const pieceAc = (p.equipped.head?.ac ?? 0) + (p.equipped.legs?.ac ?? 0) + (off?.offKind === 'shield' ? off.ac ?? 0 : 0);

  const hpPer = Math.max(1, Math.floor(cls.hit / 2) + 1 + md.con) + (race.mods.hpLevel ?? 0);
  const maxHp = Math.max(1, cls.hit + md.con + (race.mods.hpLevel ?? 0)) + (p.level - 1) * hpPer + (tr.hp ?? 0);
  const maxEn = Math.round((60 + p.level * 6 + md[cls.primary] * 4) * (1 + (race.mods.energy ?? 0)) + (tr.energy ?? 0));

  let ac: number;
  if (ar) ac = (ar.ac ?? 10) + Math.min(md.dex, ar.dexCap ?? 99);
  else ac = 10 + md.dex;
  if (!ar || ar.armorType === 'cloth') {
    if (cls.unarmored === 'monk') ac += Math.max(0, md.wis);
    if (cls.unarmored === 'barb') ac += Math.max(0, md.con);
  }
  ac += (tr.ac ?? 0) + pieceAc;

  const pr = prof(p.level);
  const plus = w?.plus ?? 0;
  const lvlSpeed = p.level >= 9 ? 0.75 : p.level >= 5 ? 0.85 : 1;
  return {
    ab, md, prof: pr, maxHp, maxEn, ac,
    atk: pr + md[cls.primary] + plus,
    dmgBonus: md[cls.primary] + plus + (tr.dmg ?? 0),
    critPct: tr.crit ?? 0, dmgPct: (1 + (tr.dmgPct ?? 0)) * (CLASS_POWER[cls.id] ?? 1) * weaponPenalty(p.classId, w) - 1, lifesteal: tr.lifesteal ?? 0, manaKill: tr.manaKill ?? 0, goldPct: tr.goldPct ?? 0, xpPct: tr.xpPct ?? 0, bonus: tr,
    dice: w?.dice ?? [1, 4],
    interval: 1000 * cls.speedMod * (w?.speed ?? 1) * lvlSpeed * (1 - Math.min(0.5, tr.atkSpeed ?? 0)),
    range: cls.range,
    style: cls.style,
    speed: 70 * (1 + (race.mods.speed ?? 0) + (tr.speed ?? 0)),
    crit: race.mods.crit ? 19 : 20,
    regenEn: 2.5 + pr * 0.3 + (tr.regenEn ?? 0),
    regenHp: 0.4 + p.level * 0.15 + (tr.regenHp ?? 0),
    offDice: off?.offKind === 'weapon' ? off.dice : undefined,
    offPlus: off?.offKind === 'weapon' ? off.plus ?? 0 : 0,
  };
}

/** Retorna o motivo pelo qual o item não pode ser equipado, ou null se pode. */
export function equipBlock(p: PlayerState, i: Item): string | null {
  const cls = CLASS_BY_ID[p.classId];
  if (p.level < i.minLevel) return `Requer nível ${i.minLevel}`;
  if ((i.slot === 'body' || i.slot === 'head' || i.slot === 'legs') && i.armorType && ARMOR_RANK[i.armorType] > ARMOR_RANK[cls.armor]) return 'Sua classe não sabe usar essa armadura';
  if (i.slot === 'offhand') {
    if (!i.offKind || !allowedOff(cls).includes(i.offKind)) {
      return i.offKind === 'shield' ? 'Sua classe não tem proficiência com escudos' : i.offKind === 'weapon' ? 'Sua classe não luta com duas armas' : 'Sua classe não usa focos de conjuração';
    }
    if (p.equipped.mainhand?.twoHanded) return 'A arma de duas mãos ocupa a mão esquerda';
  }
  return null;
}

export let player: PlayerState;
export const setPlayer = (p: PlayerState) => { player = p; };

export function newPlayer(name: string, raceId: string, classId: string, tone: string, look?: Look, startWeapon?: string): PlayerState {
  const cls = CLASS_BY_ID[classId];
  const pick = STARTER_WEAPONS.find((w) => w.name === startWeapon);
  const weapon = pick ? findBase(pick.style, pick.name) : findBase(cls.style, cls.startWeapon);
  const armor = starterArmor(cls.armor === 'cloth' ? 'cloth' : 'light');
  const offhand = cls.art.shield && !weapon.twoHanded ? starterShield() : undefined;
  const p: PlayerState = {
    v: 3, name, raceId, classId, tone, ...(look ? { look: sanitizeLook(look) } : {}), level: 1, xp: 0, gold: 20, hp: 1, en: 1,
    items: [], equipped: { mainhand: weapon, body: armor, ...(offhand ? { offhand } : {}) }, potions: { heal: 3, energy: 1 }, mats: {}, quests: {}, kills: 0,
    pos: { x: 0, y: 0 }, story: { fragments: [], seen: {}, ended: false },
  };
  const d = derive(p);
  p.hp = d.maxHp; p.en = d.maxEn;
  return p;
}

/** Vários personagens: cada slot é um save independente. */
export const SLOTS = 3;
const LEGACY_KEY = 'aldoria-save-v1';
const slotKey = (n: number) => `aldoria-save-slot-${n}`;
let activeSlot = 0;
export const getSlot = () => activeSlot;
export const setSlot = (n: number) => { activeSlot = n; };

/** O save único antigo vira o personagem do slot 1. */
function migrateLegacy() {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old && !localStorage.getItem(slotKey(0))) { localStorage.setItem(slotKey(0), old); }
    if (old) localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}

export const hasSave = (n = activeSlot) => { migrateLegacy(); return !!localStorage.getItem(slotKey(n)); };
/** ganchos da conta online (src/net/account.ts) */
export const hooks: { save: ((n: number, p: PlayerState) => void) | null; del: ((n: number) => void) | null } = { save: null, del: null };
export function save() {
  if (!player) return;
  player.sv = Date.now();
  try { localStorage.setItem(slotKey(activeSlot), JSON.stringify(player)); } catch { /* quota */ }
  hooks.save?.(activeSlot, player);
}
export const exportSlot = (n: number) => { try { return localStorage.getItem(slotKey(n)); } catch { return null; } };
export const importSlot = (n: number, json: string) => { try { localStorage.setItem(slotKey(n), json); } catch { /* quota */ } };
export function listSaves(): (PlayerState | null)[] {
  migrateLegacy();
  return Array.from({ length: SLOTS }, (_, n) => loadSave(n));
}
export function loadSave(n = activeSlot): PlayerState | null {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    const p = JSON.parse(raw) as PlayerState & { hair?: string };
    const race = RACE_BY_ID[p.raceId];
    if (!p.tone || !race.tones.includes(p.tone)) p.tone = race.tones[0]; // migra saves anteriores à nova arte
    delete p.hair;
    if (p.look) p.look = sanitizeLook(p.look);
    migrateEquipment(p);
    p.mats ??= {};
    if (!p.story) p.story = { fragments: [], seen: {}, ended: false };
    if (p.v < 2) { p.pos = { x: 0, y: 0 }; p.v = 2; }
    if (p.v < 3) { p.pos = { x: 0, y: 0 }; delete p.explored; p.v = 3; } // mapa muito maior: reposiciona na vila e refaz a exploração
    return p;
  } catch { return null; }
}
/** Saves antigos tinham arma/armadura/berloque: converte para os novos espaços. */
function migrateEquipment(p: PlayerState) {
  const eq = p.equipped as Record<string, Item>;
  const map: Record<string, Slot> = { weapon: 'mainhand', armor: 'body', trinket: 'accessory' };
  for (const [o, n] of Object.entries(map)) if (eq[o]) { eq[n] = eq[o]; delete eq[o]; }
  for (const k of Object.keys(eq)) migrateItem(eq[k]);
  p.items.forEach((it) => migrateItem(it));
}
export const deleteSave = (n = activeSlot) => { localStorage.removeItem(slotKey(n)); hooks.del?.(n); };

export const xpForNext = (level: number) => (level >= MAX_LEVEL ? XP_TABLE[MAX_LEVEL - 1] : XP_TABLE[level]);
export const xpForCurrent = (level: number) => XP_TABLE[level - 1];

export function gainXp(amount: number) {
  if (player.level >= MAX_LEVEL) return;
  const before = player.level;
  player.xp += amount;
  player.level = levelFromXp(player.xp);
  if (player.level > before) {
    const d = derive(player);
    player.hp = d.maxHp; player.en = d.maxEn;
    bus.emit('levelup', player.level);
  }
}

export function addItem(i: Item): boolean {
  if (player.items.length >= BAG_SIZE) return false;
  player.items.push(i);
  return true;
}
