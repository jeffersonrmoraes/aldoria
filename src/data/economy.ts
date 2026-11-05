import { Item, SHOP_INFO, ShopId, shopPrice } from './items';
import { mod } from './rules';

/**
 * Economia (regra da casa):
 *  - O comerciante PAGA MAIS por mercadoria do seu ofício (o arqueiro paga bem por arcos, o ferreiro por espadas...).
 *    Fora do ofício o preço é o de um comprador qualquer.
 *  - Carisma (Persuasão): +2% ao vender e -1,5% ao comprar por ponto de modificador (máx. +5 / mín. -2).
 *  - Saturação: vender várias peças do mesmo tipo à mesma loja derruba o preço (-5% por venda, recupera com o tempo).
 *  - Ouro extra: itens, encantamentos e conjuntos podem dar +% de ouro dos monstros.
 */
export const GENERIC_RATE = 0.8;
export const SPECIALIST_BASE = 1.6;

export function buysItem(shop: ShopId, it: Item): boolean {
  return SHOP_INFO[shop].lines.some((l) =>
    l.slot === it.slot &&
    (!l.style || it.slot !== 'mainhand' || l.style === it.style) &&
    (!l.types || (!!it.armorType && l.types.includes(it.armorType))) &&
    (!l.off || (!!it.offKind && l.off.includes(it.offKind))) &&
    (!l.only || l.only.test(it.name)));
}
/** Qual a melhor loja da cidade para vender este item (para dicas na mochila). */
export function bestShopFor(it: Item): ShopId | null {
  const order: ShopId[] = ['smith', 'sage', 'archer', 'monk', 'rogue', 'cleric', 'druid', 'bard', 'necro', 'barbarian'];
  return order.find((s) => buysItem(s, it)) ?? null;
}

const demand: Record<string, { n: number; t: number }> = {};
function saturation(shop: ShopId, it: Item, now = Date.now()): number {
  const d = demand[`${shop}:${it.slot}`];
  if (!d) return 1;
  const n = Math.max(0, d.n - (now - d.t) / 40000);
  return Math.max(0.55, 1 - 0.05 * n);
}
export const chaMod = (cha: number) => Math.max(-2, Math.min(5, mod(cha)));

export function sellOffer(it: Item, shop: ShopId, cha = 10): { price: number; special: boolean; sat: number } {
  const special = buysItem(shop, it);
  const rate = special ? SPECIALIST_BASE + 0.12 * it.rarity : GENERIC_RATE;
  const sat = saturation(shop, it);
  return { price: Math.max(1, Math.round(it.value * rate * sat * (1 + 0.02 * chaMod(cha)))), special, sat };
}
export function registerSale(shop: ShopId, it: Item) {
  const k = `${shop}:${it.slot}`, now = Date.now();
  const d = demand[k];
  const cur = d ? Math.max(0, d.n - (now - d.t) / 40000) : 0;
  demand[k] = { n: cur + 1, t: now };
}
/** Preço de compra com desconto de Carisma. */
export const buyPrice = (it: Item, cha = 10) => Math.max(1, Math.round(shopPrice(it) * (1 - 0.015 * chaMod(cha))));
export const potionPrice = (level: number, cha = 10) => Math.max(10, Math.round((30 + level * 8) * (1 - 0.015 * chaMod(cha))));
/** Venda de emergência (mochila cheia) usa a taxa genérica. */
export const dumpValue = (it: Item) => Math.max(1, Math.round(it.value * GENERIC_RATE));
export const fmtGold = (n: number) => Math.floor(n).toLocaleString('pt-BR');
