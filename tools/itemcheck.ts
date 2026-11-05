// Verifica que itemProblem aceita tudo o que o gerador cria e recusa itens forjados.
// npx esbuild tools/itemcheck.ts --bundle --platform=node --outfile=/tmp/itemcheck.cjs && node /tmp/itemcheck.cjs
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = globalThis;
import { CLASSES } from '../src/data/classes';
import { genItem, genShopStock, itemProblem, allowedOff, migrateItem, Slot, Item } from '../src/data/items';

let ok = 0; const bad = new Map<string, number>(); const ex: string[] = [];
const check = (it: Item, tag: string) => { const p = itemProblem(it); if (p) { bad.set(p, (bad.get(p) ?? 0) + 1); if (ex.length < 12) ex.push(`${tag} ${it.slot} ${it.name} r${it.rarity}: ${p}`); } else ok++; };
for (const cls of CLASSES) for (let L = 1; L <= 30; L += 3) for (const rarity of [0, 1, 2, 3, 4] as const)
  for (const slot of ['mainhand', 'body', 'head', 'legs', 'offhand', 'accessory'] as Slot[]) for (let n = 0; n < 6; n++) {
    try { check(genItem({ slot, level: L, style: cls.style, rarity, armorMax: cls.armor, off: allowedOff(cls), cid: cls.id }), cls.id); } catch { /* sem item */ }
  }
for (const shop of ['forge', 'tower', 'archer', 'monk', 'rogue', 'emporium'] as any[]) for (let L = 1; L <= 30; L += 4) { try { for (const it of genShopStock(L, shop)) check(it, shop); } catch { /* */ } }
console.log('aceitos', ok, 'recusados', [...bad.entries()], ex);
// forjados
const base = genItem({ slot: 'mainhand', level: 5, style: 'melee', rarity: 1, armorMax: 'heavy', off: allowedOff(CLASSES[0]), cid: CLASSES[0].id });
const forged: [string, Item][] = [
  ['dados', { ...base, dice: [6, 20] }], ['plus', { ...base, plus: 12 }], ['raridade', { ...base, rarity: 9 as any }],
  ['nome', { ...base, name: 'Espada do Deus' }], ['stat', { ...base, stat: { str: 40 } }], ['encanto em corpo', { ...genItem({ slot: 'body', level: 5, style: 'melee', rarity: 1, armorMax: 'heavy', off: [], cid: CLASSES[0].id }), ench: { id: 'vamp', lvl: 3 } }],
];
for (const [n, it] of forged) console.log('forjado', n, '->', itemProblem(it));
