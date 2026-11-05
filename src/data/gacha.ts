import { ClassDef } from './classes';
import { Item, Rarity, Slot, allowedOff, genItem } from './items';
import { rand } from './rules';

/** Baús (gacha): 1% de chance nos monstros comuns (Baú de Madeira) e 100% nos chefes (Baú Dourado). */
export type ChestTier = 'wood' | 'gold';
export interface ChestInfo { name: string; icon: string; items: number; weights: number[]; pityEvery: number; pityMin: Rarity; color: string; goldMul: [number, number] }
export const CHEST_INFO: Record<ChestTier, ChestInfo> = {
  wood: { name: 'Baú de Madeira', icon: '📦', items: 1, weights: [38, 30, 22, 9, 1], pityEvery: 10, pityMin: 3, color: '#bfe0ff', goldMul: [8, 20] },
  gold: { name: 'Baú Dourado', icon: '🎁', items: 3, weights: [0, 0, 52, 37, 11], pityEvery: 5, pityMin: 4, color: '#ffd23f', goldMul: [40, 90] },
};

function rollRarityW(w: number[]): Rarity {
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i as Rarity; }
  return 2;
}

export interface ChestResult { items: Item[]; gold: number; pityHit: boolean; potions: number }

export function openChest(tier: ChestTier, level: number, cls: ClassDef, pity: number): ChestResult {
  const info = CHEST_INFO[tier];
  const off = allowedOff(cls);
  const lv = Math.min(10, level + (tier === 'gold' ? 2 : 1));
  const guaranteed = pity + 1 >= info.pityEvery;
  const rolls: Rarity[] = Array.from({ length: info.items }, () => rollRarityW(info.weights));
  if (guaranteed && !rolls.some((r) => r >= info.pityMin)) rolls[Math.floor(Math.random() * rolls.length)] = info.pityMin;
  const slotRoll = (): Slot => {
    const r = Math.random();
    return r < 0.22 ? 'mainhand' : r < 0.38 ? 'body' : r < 0.5 ? 'head' : r < 0.62 ? 'legs' : r < 0.76 && off.length ? 'offhand' : 'accessory';
  };
  const items = rolls.map((rarity) => genItem({ slot: slotRoll(), level: lv, style: cls.style, rarity, armorMax: cls.armor, off, cid: cls.id }));
  const pityHit = rolls.some((r) => r >= info.pityMin);
  return { items, gold: Math.round(rand(info.goldMul[0], info.goldMul[1]) * Math.max(1, level)), pityHit, potions: tier === 'gold' ? 2 : Math.random() < 0.3 ? 1 : 0 };
}
