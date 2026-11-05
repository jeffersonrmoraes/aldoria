import { ArmorType, ARMOR_RANK, Style } from './classes';
import { Bonus, Dice, rand, addBonus, bonusLines } from './rules';
import { setForBase, SET_BY_ID } from './sets';
import { ENCHANTS, enchLine, Ench } from './enchants';

/** Espaços de equipamento (inspirados nas regras de D&D 5e: armadura, escudo, armas, foco arcano e itens mágicos). */
export type Slot = 'head' | 'body' | 'legs' | 'mainhand' | 'offhand' | 'accessory';
export const SLOT_ORDER: Slot[] = ['head', 'body', 'legs', 'mainhand', 'offhand', 'accessory'];
export const SLOT_LABEL: Record<Slot, string> = { head: 'Elmo', body: 'Corpo', legs: 'Pernas', mainhand: 'Mão Direita', offhand: 'Mão Esquerda', accessory: 'Acessório' };
/** O que a mão esquerda pode segurar: escudo (+CA), arma leve (ataque extra) ou foco (símbolo sagrado, orbe, grimório, totem). */
export type OffKind = 'shield' | 'weapon' | 'focus';
export type Rarity = 0 | 1 | 2 | 3 | 4;
export const RARITY_NAMES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];
export const RARITY_COLORS = ['#cfcfcf', '#4ade80', '#60a5fa', '#c084fc', '#fb923c'];

export type ItemStat = Bonus;

export interface Item {
  uid: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  minLevel: number;
  value: number;
  icon: string;
  style?: Style;
  dice?: Dice;
  speed?: number;      // multiplicador do intervalo de ataque
  plus?: number;       // bônus de ataque/dano
  armorType?: ArmorType;
  ac?: number;         // CA base da armadura (já inclui bônus)
  dexCap?: number;
  stat?: ItemStat;
  offKind?: OffKind;   // mão esquerda: tipo do item
  twoHanded?: boolean; // arma de duas mãos (ocupa também a mão esquerda)
  set?: string;        // conjunto de armadura (ver sets.ts)
  ench?: Ench;         // encantamento da arma (ver enchants.ts)
}

interface WBase { name: string; dice: Dice; speed: number; min: number; icon: string; two?: boolean }
const TWO_HANDED_RE = /^(machado grande|montante|arco|besta(?! de pulso)|cajado|bord[ãa]o)/i;
export const isTwoHanded = (name: string) => TWO_HANDED_RE.test(name);
const WEAPONS: Record<Style, WBase[]> = {
  melee: [
    { name: 'Adaga', dice: [1, 4], speed: 0.8, min: 1, icon: '🗡️' },
    { name: 'Espada Curta', dice: [1, 6], speed: 0.9, min: 1, icon: '⚔️' },
    { name: 'Maça', dice: [1, 6], speed: 1, min: 1, icon: '🔨' },
    { name: 'Machadinha', dice: [1, 6], speed: 0.95, min: 1, icon: '🪓' },
    { name: 'Espada Longa', dice: [1, 8], speed: 1, min: 3, icon: '⚔️' },
    { name: 'Machado de Batalha', dice: [1, 8], speed: 1, min: 3, icon: '🪓' },
    { name: 'Martelo de Guerra', dice: [1, 10], speed: 1.1, min: 5, icon: '🔨' },
    { name: 'Machado Grande', dice: [1, 12], speed: 1.25, min: 6, icon: '🪓' },
    { name: 'Montante', dice: [2, 6], speed: 1.2, min: 7, icon: '⚔️' },
    { name: 'Lâmina Vorpal', dice: [2, 8], speed: 1.1, min: 10, icon: '⚔️' },
    { name: 'Rapieira', dice: [1, 8], speed: 0.95, min: 3, icon: '🗡️' },
    { name: 'Rapieira de Mithral', dice: [1, 10], speed: 0.9, min: 8, icon: '🗡️' },
    { name: 'Manoplas de Couro', dice: [1, 4], speed: 0.7, min: 1, icon: '🥊' },
    { name: 'Bastão de Combate', dice: [1, 6], speed: 0.85, min: 1, icon: '🥢' },
    { name: 'Manoplas de Ferro', dice: [1, 6], speed: 0.75, min: 3, icon: '🥊' },
    { name: 'Kama', dice: [1, 8], speed: 0.8, min: 5, icon: '🌙' },
    { name: 'Manoplas de Mithral', dice: [1, 10], speed: 0.7, min: 8, icon: '🥊' },
    { name: 'Punhos do Dragão Ancião', dice: [2, 6], speed: 0.7, min: 10, icon: '🥊' },
    { name: 'Bordão de Carvalho', dice: [1, 8], speed: 0.9, min: 2, icon: '🥢' },
    { name: 'Bordão Ferrado', dice: [1, 10], speed: 0.9, min: 6, icon: '🥢' },
    { name: 'Bordão do Mestre Ki', dice: [2, 6], speed: 0.85, min: 10, icon: '🥢' },
    { name: 'Machado do Berserker', dice: [1, 8], speed: 0.95, min: 3, icon: '🪓' },
    { name: 'Machado Rúnico', dice: [1, 10], speed: 1, min: 6, icon: '🪓' },
  ],
  ranged: [
    { name: 'Arco Curto', dice: [1, 6], speed: 1, min: 1, icon: '🏹' },
    { name: 'Besta Leve', dice: [1, 8], speed: 1.1, min: 3, icon: '🏹' },
    { name: 'Arco Longo', dice: [1, 8], speed: 0.95, min: 4, icon: '🏹' },
    { name: 'Besta Pesada', dice: [1, 10], speed: 1.2, min: 6, icon: '🏹' },
    { name: 'Arco Composto', dice: [1, 10], speed: 0.9, min: 7, icon: '🏹' },
    { name: 'Arco Élfico', dice: [1, 12], speed: 0.95, min: 9, icon: '🏹' },
    { name: 'Arco do Caçador de Dragões', dice: [2, 6], speed: 0.9, min: 10, icon: '🏹' },
    { name: 'Besta de Pulso', dice: [1, 6], speed: 0.85, min: 1, icon: '🦾' },
    { name: 'Besta de Pulso Rúnica', dice: [1, 8], speed: 0.85, min: 5, icon: '🦾' },
    { name: 'Besta de Pulso Élfica', dice: [1, 10], speed: 0.8, min: 8, icon: '🦾' },
    { name: 'Braçadeira do Caçador de Dragões', dice: [2, 4], speed: 0.75, min: 10, icon: '🦾' },
  ],
  magic: [
    { name: 'Cajado Simples', dice: [1, 6], speed: 1, min: 1, icon: '🪄' },
    { name: 'Varinha de Carvalho', dice: [1, 6], speed: 0.9, min: 1, icon: '🪄' },
    { name: 'Cajado de Ébano', dice: [1, 8], speed: 1, min: 3, icon: '🪄' },
    { name: 'Varinha de Cristal', dice: [1, 8], speed: 0.9, min: 4, icon: '🪄' },
    { name: 'Cajado Arcano', dice: [1, 10], speed: 1, min: 6, icon: '🪄' },
    { name: 'Cajado Rúnico', dice: [1, 12], speed: 1.05, min: 8, icon: '🪄' },
    { name: 'Cajado do Arquimago', dice: [2, 6], speed: 1, min: 10, icon: '🪄' },
    { name: 'Varinha Rúnica', dice: [1, 10], speed: 0.9, min: 7, icon: '🪄' },
    { name: 'Varinha do Arquimago', dice: [2, 4], speed: 0.85, min: 10, icon: '🪄' },
    { name: 'Livro de Feitiços', dice: [1, 6], speed: 0.95, min: 1, icon: '📘' },
    { name: 'Grimório de Guerra', dice: [1, 8], speed: 0.95, min: 4, icon: '📕' },
    { name: 'Tomo Arcano', dice: [1, 10], speed: 0.95, min: 7, icon: '📖' },
    { name: 'Livro do Arquimago', dice: [2, 4], speed: 0.9, min: 10, icon: '📚' },
    { name: 'Cetro de Osso', dice: [1, 6], speed: 0.9, min: 1, icon: '🦴' },
    { name: 'Cetro Sepulcral', dice: [1, 8], speed: 0.9, min: 5, icon: '🦴' },
    { name: 'Cetro da Lich', dice: [1, 10], speed: 0.85, min: 9, icon: '🦴' },
    { name: 'Cajado de Ossos', dice: [1, 10], speed: 1, min: 6, icon: '💀' },
    { name: 'Livro dos Mortos', dice: [1, 8], speed: 0.95, min: 4, icon: '📗' },
    { name: 'Foice Lunar', dice: [1, 8], speed: 0.9, min: 3, icon: '🌙' },
    { name: 'Foice de Prata Lunar', dice: [1, 10], speed: 0.88, min: 8, icon: '🌙' },
    { name: 'Cajado Druídico', dice: [1, 8], speed: 1, min: 3, icon: '🌿' },
    { name: 'Alaúde de Carvalho', dice: [1, 6], speed: 0.9, min: 1, icon: '🎸' },
    { name: 'Alaúde Élfico', dice: [1, 8], speed: 0.9, min: 5, icon: '🎸' },
    { name: 'Alaúde Encantado', dice: [1, 10], speed: 0.85, min: 8, icon: '🎸' },
    { name: 'Harpa dos Feéricos', dice: [2, 4], speed: 0.8, min: 10, icon: '🪕' },
  ],
};

interface ABase { name: string; type: ArmorType; ac: number; dexCap: number; min: number }
const ARMORS: ABase[] = [
  { name: 'Túnica Simples', type: 'cloth', ac: 10, dexCap: 99, min: 1 },
  { name: 'Robe Rúnico', type: 'cloth', ac: 11, dexCap: 99, min: 4 },
  { name: 'Manto Arcano', type: 'cloth', ac: 12, dexCap: 99, min: 7 },
  { name: 'Vestes Estelares', type: 'cloth', ac: 13, dexCap: 99, min: 9 },
  { name: 'Manto do Arquimago', type: 'cloth', ac: 14, dexCap: 99, min: 10 },
  { name: 'Couro de Dragão Verde', type: 'light', ac: 14, dexCap: 99, min: 10 },
  { name: 'Brunea de Mithral', type: 'medium', ac: 16, dexCap: 2, min: 10 },
  { name: 'Placas de Adamantina', type: 'heavy', ac: 19, dexCap: 0, min: 10 },
  { name: 'Manto do Necromante', type: 'cloth', ac: 11, dexCap: 99, min: 3 },
  { name: 'Manto da Lich', type: 'cloth', ac: 13, dexCap: 99, min: 9 },
  { name: 'Gibão do Menestrel', type: 'light', ac: 12, dexCap: 99, min: 2 },
  { name: 'Casaco do Trovador', type: 'light', ac: 13, dexCap: 99, min: 7 },
  { name: 'Casca de Carvalho', type: 'medium', ac: 14, dexCap: 2, min: 3 },
  { name: 'Casca de Carvalho Antigo', type: 'medium', ac: 16, dexCap: 2, min: 8 },
  { name: 'Peles de Urso', type: 'medium', ac: 14, dexCap: 2, min: 4 },
  { name: 'Couraça do Sol', type: 'heavy', ac: 17, dexCap: 0, min: 6 },
  { name: 'Armadura Radiante', type: 'heavy', ac: 19, dexCap: 0, min: 10 },
  { name: 'Vestes de Monge', type: 'cloth', ac: 11, dexCap: 99, min: 2 },
  { name: 'Hábito do Mosteiro', type: 'cloth', ac: 12, dexCap: 99, min: 6 },
  { name: 'Vestes do Punho Celestial', type: 'cloth', ac: 14, dexCap: 99, min: 9 },
  { name: 'Gibão de Couro', type: 'light', ac: 11, dexCap: 99, min: 1 },
  { name: 'Couro Batido', type: 'light', ac: 12, dexCap: 99, min: 3 },
  { name: 'Couro Reforçado', type: 'light', ac: 13, dexCap: 99, min: 7 },
  { name: 'Camisão de Malha', type: 'medium', ac: 13, dexCap: 2, min: 3 },
  { name: 'Brunea', type: 'medium', ac: 14, dexCap: 2, min: 5 },
  { name: 'Peitoral de Aço', type: 'medium', ac: 15, dexCap: 2, min: 7 },
  { name: 'Cota de Malha', type: 'heavy', ac: 16, dexCap: 0, min: 5 },
  { name: 'Loriga Segmentada', type: 'heavy', ac: 17, dexCap: 0, min: 7 },
  { name: 'Armadura de Placas', type: 'heavy', ac: 18, dexCap: 0, min: 9 },
];

interface PBase { name: string; type: ArmorType; ac: number; min: number; stat?: ItemStat }
const HEADS: PBase[] = [
  { name: 'Chapéu de Aprendiz', type: 'cloth', ac: 0, min: 1, stat: { energy: 8 } },
  { name: 'Capuz Arcano', type: 'cloth', ac: 0, min: 4, stat: { energy: 16 } },
  { name: 'Chapéu do Arquimago', type: 'cloth', ac: 1, min: 9, stat: { energy: 26 } },
  { name: 'Faixa de Monge', type: 'cloth', ac: 0, min: 1, stat: { hp: 5 } },
  { name: 'Capuz do Mosteiro', type: 'cloth', ac: 1, min: 6, stat: { hp: 10 } },
  { name: 'Coroa do Mestre Ki', type: 'cloth', ac: 1, min: 10, stat: { energy: 20, hp: 10 } },
  { name: 'Capuz de Couro', type: 'light', ac: 0, min: 1, stat: { hp: 5 } },
  { name: 'Capelo Reforçado', type: 'light', ac: 1, min: 4 },
  { name: 'Capuz de Couro de Dragão', type: 'light', ac: 2, min: 9 },
  { name: 'Elmo de Ferro', type: 'medium', ac: 1, min: 2 },
  { name: 'Elmo de Aço', type: 'medium', ac: 1, min: 5, stat: { hp: 6 } },
  { name: 'Elmo de Mithral', type: 'medium', ac: 2, min: 9 },
  { name: 'Elmo Grande', type: 'heavy', ac: 2, min: 5 },
  { name: 'Elmo de Placas', type: 'heavy', ac: 2, min: 8, stat: { hp: 8 } },
  { name: 'Elmo de Adamantina', type: 'heavy', ac: 3, min: 10 },
  { name: 'Capuz Sepulcral', type: 'cloth', ac: 0, min: 3, stat: { energy: 12 } },
  { name: 'Coroa da Lich', type: 'cloth', ac: 1, min: 9, stat: { energy: 22, dmg: 1 } },
  { name: 'Chapéu de Menestrel', type: 'light', ac: 0, min: 2, stat: { energy: 8 } },
  { name: 'Coroa de Folhas', type: 'medium', ac: 1, min: 3, stat: { hp: 6 } },
  { name: 'Elmo de Chifres', type: 'medium', ac: 1, min: 4, stat: { hp: 8 } },
  { name: 'Elmo do Sol', type: 'heavy', ac: 2, min: 6, stat: { hp: 10 } },
];
const LEGS: PBase[] = [
  { name: 'Calças de Viagem', type: 'cloth', ac: 0, min: 1, stat: { hp: 5 } },
  { name: 'Calças Rúnicas', type: 'cloth', ac: 0, min: 4, stat: { energy: 12 } },
  { name: 'Calças Estelares', type: 'cloth', ac: 1, min: 9, stat: { energy: 20 } },
  { name: 'Calças de Monge', type: 'cloth', ac: 0, min: 2, stat: { hp: 6 } },
  { name: 'Faixas de Combate do Mosteiro', type: 'cloth', ac: 1, min: 7, stat: { speed: 0.03 } },
  { name: 'Calças do Punho Celestial', type: 'cloth', ac: 1, min: 10, stat: { speed: 0.04, hp: 10 } },
  { name: 'Perneiras de Couro', type: 'light', ac: 0, min: 1, stat: { speed: 0.02 } },
  { name: 'Perneiras Batidas', type: 'light', ac: 1, min: 4 },
  { name: 'Perneiras de Couro de Dragão', type: 'light', ac: 2, min: 9, stat: { speed: 0.03 } },
  { name: 'Grevas de Malha', type: 'medium', ac: 1, min: 2 },
  { name: 'Grevas de Aço', type: 'medium', ac: 1, min: 5, stat: { hp: 6 } },
  { name: 'Grevas de Mithral', type: 'medium', ac: 2, min: 9 },
  { name: 'Grevas de Placas', type: 'heavy', ac: 2, min: 5 },
  { name: 'Grevas Segmentadas', type: 'heavy', ac: 2, min: 8, stat: { hp: 8 } },
  { name: 'Grevas de Adamantina', type: 'heavy', ac: 3, min: 10 },
  { name: 'Calças Sepulcrais', type: 'cloth', ac: 0, min: 3, stat: { energy: 10 } },
  { name: 'Calças da Lich', type: 'cloth', ac: 1, min: 9, stat: { energy: 18 } },
  { name: 'Botas de Menestrel', type: 'light', ac: 0, min: 2, stat: { speed: 0.02 } },
  { name: 'Perneiras de Casca', type: 'medium', ac: 1, min: 3 },
  { name: 'Calças de Pele', type: 'medium', ac: 1, min: 4, stat: { hp: 6 } },
  { name: 'Grevas do Sol', type: 'heavy', ac: 2, min: 6, stat: { hp: 8 } },
];
const SHIELDS: { name: string; min: number; stat?: ItemStat }[] = [
  { name: 'Escudo de Madeira', min: 1 },
  { name: 'Escudo de Aço', min: 4, stat: { hp: 5 } },
  { name: 'Escudo do Guardião', min: 7, stat: { hp: 10 } },
  { name: 'Escudo de Mithral', min: 10, stat: { hp: 16 } },
];
const OFFWEAPONS: WBase[] = [
  { name: 'Adaga', dice: [1, 4], speed: 1, min: 1, icon: '🗡️' },
  { name: 'Espada Curta', dice: [1, 6], speed: 1, min: 1, icon: '⚔️' },
  { name: 'Machadinha', dice: [1, 6], speed: 1, min: 2, icon: '🪓' },
  { name: 'Cimitarra', dice: [1, 6], speed: 1, min: 4, icon: '⚔️' },
  { name: 'Punhal Sombrio', dice: [1, 8], speed: 1, min: 8, icon: '🗡️' },
];
interface FBase { name: string; icon: string; min: number; stat: ItemStat }
const FOCI: FBase[] = [
  { name: 'Símbolo Sagrado', icon: '☀️', min: 1, stat: { hp: 8, energy: 6 } },
  { name: 'Orbe de Cristal', icon: '🔮', min: 1, stat: { energy: 12 } },
  { name: 'Grimório do Aprendiz', icon: '📕', min: 3, stat: { energy: 10, dmg: 1 } },
  { name: 'Totem Druídico', icon: '🪵', min: 3, stat: { hp: 6, energy: 10 } },
  { name: 'Tomo Proibido', icon: '📖', min: 7, stat: { energy: 18, dmg: 1 } },
  { name: 'Orbe do Arquimago', icon: '🔮', min: 10, stat: { energy: 30, dmg: 2 } },
  { name: 'Crânio Ritual', icon: '💀', min: 3, stat: { energy: 12, hp: 4 } },
  { name: 'Filactério', icon: '🏺', min: 9, stat: { energy: 24, dmg: 1 } },
  { name: 'Símbolo do Sol', icon: '☀️', min: 6, stat: { hp: 14, energy: 12 } },
];

/** Quais itens a mão esquerda aceita para a classe (regras do SRD: escudo só para quem tem proficiência). */
export function allowedOff(c: { id: string; style: Style; armor: ArmorType }): OffKind[] {
  const out: OffKind[] = [];
  if (ARMOR_RANK[c.armor] >= 2) out.push('shield');
  if (c.style === 'melee' && c.id !== 'monk') out.push('weapon');
  if (c.style === 'magic' || c.id === 'cleric' || c.id === 'paladin') out.push('focus');
  return out;
}

interface TBase { name: string; icon: string; stat: keyof ItemStat; per: number; min: number }
const TRINKETS: TBase[] = [
  { name: 'Anel de Proteção', icon: '💍', stat: 'ac', per: 1, min: 1 },
  { name: 'Amuleto de Vitalidade', icon: '📿', stat: 'hp', per: 8, min: 1 },
  { name: 'Anel de Fúria', icon: '💍', stat: 'dmg', per: 1, min: 2 },
  { name: 'Amuleto Arcano', icon: '📿', stat: 'energy', per: 14, min: 1 },
  { name: 'Botas Velozes', icon: '🥾', stat: 'speed', per: 0.04, min: 2 },
  { name: 'Anel do Mago', icon: '💍', stat: 'energy', per: 10, min: 3 },
  { name: 'Pingente de Cristal', icon: '🔮', stat: 'energy', per: 18, min: 6 },
  { name: 'Aljava do Caçador', icon: '🏹', stat: 'dmg', per: 1, min: 2 },
  { name: 'Flechas de Prata', icon: '➳', stat: 'dmg', per: 1, min: 4 },
  { name: 'Braçais do Arqueiro', icon: '🧤', stat: 'dmg', per: 1, min: 6 },
  { name: 'Aljava Élfica', icon: '🏹', stat: 'speed', per: 0.04, min: 5 },
  { name: 'Faixa do Punho de Ferro', icon: '🥋', stat: 'dmg', per: 1, min: 2 },
  { name: 'Anel de Ki', icon: '💍', stat: 'energy', per: 12, min: 3 },
  { name: 'Sandálias do Vento', icon: '👡', stat: 'speed', per: 0.04, min: 4 },
  { name: 'Capa Élfica', icon: '🧣', stat: 'speed', per: 0.04, min: 3 },
  { name: 'Anel do Gatuno', icon: '💍', stat: 'dmg', per: 1, min: 3 },
  { name: 'Ferramentas de Ladrão', icon: '🗝️', stat: 'hp', per: 8, min: 2 },
  { name: 'Amuleto Sagrado', icon: '📿', stat: 'hp', per: 10, min: 2 },
  { name: 'Folha de Carvalho Encantada', icon: '🍃', stat: 'regenHp', per: 0.4, min: 2 },
  { name: 'Colar de Presas', icon: '🦷', stat: 'dmgPct', per: 0.03, min: 3 },
  { name: 'Gema do Bardo', icon: '💎', stat: 'crit', per: 0.03, min: 3 },
  { name: 'Anel Necromântico', icon: '💍', stat: 'lifesteal', per: 0.02, min: 4 },
  { name: 'Amuleto de Ossos', icon: '🦴', stat: 'manaKill', per: 3, min: 5 },
  { name: 'Anel da Fortuna', icon: '💰', stat: 'goldPct', per: 0.08, min: 2 },
  { name: 'Anel do Estudioso', icon: '📘', stat: 'xpPct', per: 0.05, min: 3 },
];

const SUFFIX: string[][] = [
  [''],
  [' do Viajante', ' de Bronze', ' do Aprendiz'],
  [' do Caçador de Goblins', ' da Lua Pálida', ' do Guardião'],
  [' da Chama Eterna', ' do Rei Caído', ' da Tempestade'],
  [' de Bahamut', ' do Dragão Ancião', ' da Aurora Eterna', ' de Pelor'],
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const itemValue = (minLevel: number, plus: number) => Math.round((8 + 6 * minLevel) * (1 + plus * 0.8));

export interface GenOpts {
  slot: Slot; level: number; style: Style; rarity: Rarity; armorMax: ArmorType; off?: OffKind[];
  only?: RegExp;          // restringe a base pelo nome (usado pelas lojas)
  types?: ArmorType[];    // restringe os tipos de armadura (usado pelas lojas)
  cid?: string;           // classe (o Monge só recebe armas de monge, os demais não)
  noEnchant?: boolean;
}
export const MONK_WEAPON_RE = /^(manopla|bast[ãa]o|kama|punhos|bord[ãa]o|espada curta)/i;
const MONK_ONLY_RE = /^(manopla|bast[ãa]o|kama|punhos)/i;

/** Gera o item e aplica conjunto e (às vezes) um encantamento. */
export function genItem(o: GenOpts): Item {
  const it = genItemBase(o);
  if (it.slot !== 'mainhand' && it.slot !== 'accessory') it.set = setForBase(it.slot, it.name);
  if (it.slot === 'mainhand' && !o.noEnchant && it.rarity >= 2 && Math.random() < 0.1 + 0.1 * it.rarity) {
    const opts = ENCHANTS.filter((e) => e.minLevel <= Math.max(1, o.level));
    const e = opts[Math.floor(Math.random() * opts.length)];
    const lvl = it.rarity >= 4 ? 3 : it.rarity >= 3 ? 2 : 1;
    it.ench = { id: e.id, lvl };
    it.value = Math.round(it.value * (1 + 0.3 * lvl));
  }
  return it;
}

function genItemBase(o: GenOpts): Item {
  const lvl = o.level;
  const near = <T extends { min: number }>(list: T[]): T => {
    const ok = list.filter((b) => b.min <= lvl + 1 && b.min >= lvl - 3);
    if (ok.length) return pick(ok);
    const below = list.filter((b) => b.min <= lvl + 1);
    return below.length ? below[below.length - 1] : list[0];
  };
  const suffix = pick(SUFFIX[o.rarity]);
  const flt = <T extends { name: string }>(l: T[]): T[] => {
    const r = o.only ? l.filter((b) => o.only!.test(b.name)) : l;
    return r.length ? r : l;
  };
  const armorOk = (t: ArmorType) => (o.types ? o.types.includes(t) : ARMOR_RANK[t] <= ARMOR_RANK[o.armorMax]);
  if (o.slot === 'mainhand') {
    let wl = WEAPONS[o.style];
    if (!o.only && o.style === 'melee' && o.cid) wl = o.cid === 'monk' ? wl.filter((w) => MONK_WEAPON_RE.test(w.name)) : wl.filter((w) => !MONK_ONLY_RE.test(w.name));
    const b = near(flt(wl));
    return {
      uid: uid(), name: b.name + suffix, slot: 'mainhand', rarity: o.rarity, minLevel: b.min, icon: b.icon,
      style: o.style, dice: b.dice, speed: b.speed, plus: o.rarity, value: itemValue(b.min, o.rarity), twoHanded: isTwoHanded(b.name),
    };
  }
  if (o.slot === 'body') {
    const b = near(flt(ARMORS.filter((a) => armorOk(a.type))));
    return {
      uid: uid(), name: b.name + suffix, slot: 'body', rarity: o.rarity, minLevel: b.min, icon: b.type === 'cloth' ? '🥋' : b.type === 'light' ? '🧥' : '🛡️',
      armorType: b.type, ac: b.ac + o.rarity, dexCap: b.dexCap, plus: o.rarity, value: itemValue(b.min, o.rarity),
    };
  }
  if (o.slot === 'head' || o.slot === 'legs') {
    const b = near(flt((o.slot === 'head' ? HEADS : LEGS).filter((a) => armorOk(a.type))));
    const k = 1 + o.rarity * 0.4;
    const stat: ItemStat = {};
    if (b.stat) for (const [key, v] of Object.entries(b.stat) as [keyof ItemStat, number][]) stat[key] = key === 'speed' ? +(v * k).toFixed(2) : Math.round(v * k);
    const icons = o.slot === 'head' ? { cloth: '🎩', light: '🧢', medium: '🪖', heavy: '⛑️' } : { cloth: '👖', light: '🥾', medium: '🦵', heavy: '🦿' };
    return {
      uid: uid(), name: b.name + suffix, slot: o.slot, rarity: o.rarity, minLevel: b.min, icon: icons[b.type],
      armorType: b.type, ac: b.ac + (o.rarity >= 3 ? 1 : 0) + (o.rarity >= 4 ? 1 : 0), stat, plus: o.rarity, value: itemValue(b.min, o.rarity),
    };
  }
  if (o.slot === 'offhand') {
    const kinds = o.off && o.off.length ? o.off : (['shield'] as OffKind[]);
    const kind = pick(kinds);
    if (kind === 'shield') {
      const b = near(flt(SHIELDS));
      const k = 1 + o.rarity * 0.4, stat: ItemStat = {};
      if (b.stat) for (const [key, v] of Object.entries(b.stat) as [keyof ItemStat, number][]) stat[key] = Math.round(v * k);
      return {
        uid: uid(), name: b.name + suffix, slot: 'offhand', offKind: 'shield', rarity: o.rarity, minLevel: b.min, icon: '🛡️',
        ac: 2 + [0, 0, 1, 1, 2][o.rarity], stat, plus: o.rarity, value: itemValue(b.min, o.rarity),
      };
    }
    if (kind === 'weapon') {
      const b = near(flt(OFFWEAPONS));
      return {
        uid: uid(), name: b.name + suffix, slot: 'offhand', offKind: 'weapon', rarity: o.rarity, minLevel: b.min, icon: b.icon,
        style: 'melee', dice: b.dice, speed: 1, plus: o.rarity, value: itemValue(b.min, o.rarity),
      };
    }
    const b = near(flt(FOCI));
    const k = 1 + o.rarity * 0.4, stat: ItemStat = {};
    for (const [key, v] of Object.entries(b.stat) as [keyof ItemStat, number][]) stat[key] = key === 'dmg' ? v + Math.floor(o.rarity / 2) : Math.round(v * k);
    return {
      uid: uid(), name: b.name + suffix, slot: 'offhand', offKind: 'focus', rarity: o.rarity, minLevel: b.min, icon: b.icon,
      stat, plus: o.rarity, value: itemValue(b.min, o.rarity),
    };
  }
  const b = near(flt(TRINKETS));
  const r = Math.max(1, o.rarity);
  const stat: ItemStat = { [b.stat]: +(b.per * r).toFixed(2) };
  return {
    uid: uid(), name: b.name + (suffix || ' do Viajante'), slot: 'accessory', rarity: Math.max(1, o.rarity) as Rarity,
    minLevel: b.min, icon: b.icon, stat, value: itemValue(b.min, r + 1),
  };
}

export function findBase(style: Style, name: string): Item {
  const b = WEAPONS[style].find((w) => w.name === name) ?? WEAPONS[style][0];
  return {
    uid: uid(), name: b.name, slot: 'mainhand', rarity: 0, minLevel: b.min, icon: b.icon,
    style, dice: b.dice, speed: b.speed, plus: 0, value: itemValue(b.min, 0), twoHanded: isTwoHanded(b.name),
  };
}

export function starterShield(): Item {
  const b = SHIELDS[0];
  return { uid: uid(), name: b.name, slot: 'offhand', offKind: 'shield', rarity: 0, minLevel: 1, icon: '🛡️', ac: 2, plus: 0, value: itemValue(1, 0) };
}

/** Converte itens/saves antigos (arma/armadura/berloque) para os novos espaços. */
export function migrateItem<T extends { slot: string; name: string; twoHanded?: boolean }>(it: T): T {
  const map: Record<string, Slot> = { weapon: 'mainhand', armor: 'body', trinket: 'accessory' };
  if (map[it.slot]) (it as { slot: string }).slot = map[it.slot];
  if (it.slot === 'mainhand' && it.twoHanded === undefined) it.twoHanded = isTwoHanded(it.name);
  const x = it as unknown as Item;
  if (!x.set && (it.slot === 'head' || it.slot === 'body' || it.slot === 'legs' || it.slot === 'offhand')) x.set = setForBase(it.slot, it.name);
  return it;
}

export function starterArmor(type: ArmorType): Item {
  const b = ARMORS.find((x) => x.name === (type === 'cloth' ? 'Túnica Simples' : 'Gibão de Couro'))!;
  return {
    uid: uid(), name: b.name, slot: 'body', rarity: 0, minLevel: 1, icon: type === 'cloth' ? '🥋' : '🧥',
    armorType: b.type, ac: b.ac, dexCap: b.dexCap, plus: 0, value: itemValue(1, 0),
  };
}

export function rollRarity(boss = false, elite = false): Rarity {
  const r = Math.random() * 100;
  if (elite) return r < 8 ? 4 : r < 45 ? 3 : 2;
  if (boss) return r < 30 ? 3 : 2;
  if (r < 60) return 0;
  if (r < 88) return 1;
  if (r < 98) return 2;
  return 3;
}

export const randGold = (level: number) => rand(2 + level * 2, 6 + level * 5);

export function describeItem(i: Item): string {
  const lines: string[] = [];
  if ((i.slot === 'mainhand' || i.offKind === 'weapon') && i.dice) {
    lines.push(`Dano ${i.dice[0]}d${i.dice[1]}${i.plus ? ' +' + i.plus : ''}${i.slot === 'mainhand' ? ` · Velocidade ${(1 / (i.speed ?? 1)).toFixed(2)}x` : ' · ataque extra com a mão esquerda'}`);
    if (i.twoHanded) lines.push('Duas mãos (ocupa a mão esquerda)');
  }
  if (i.slot === 'body') lines.push(`CA ${i.ac} · Armadura ${i.armorType}`);
  if ((i.slot === 'head' || i.slot === 'legs') && i.armorType) lines.push(`${i.ac ? '+' + i.ac + ' CA · ' : ''}Armadura ${i.armorType}`);
  if (i.offKind === 'shield') lines.push(`Escudo: +${i.ac} CA`);
  if (i.offKind === 'focus') lines.push('Foco de conjuração');
  if (i.stat) lines.push(...bonusLines(i.stat));
  if (i.ench) lines.push('✨ ' + enchLine(i.ench));
  if (i.set && SET_BY_ID[i.set]) lines.push(`<span style="color:#ffd23f">${SET_BY_ID[i.set].icon} Conjunto: ${SET_BY_ID[i.set].name}</span>`);
  return lines.join('<br>');
}

// ---------- loja de itens raros (caros) ----------
export const shopPrice = (it: Item) => Math.round(it.value * (it.rarity >= 4 ? 16 : 10));

export type ShopId = 'smith' | 'sage' | 'archer' | 'monk' | 'rogue' | 'general' | 'cleric' | 'druid' | 'bard' | 'necro' | 'barbarian';
interface ShopLine { slot: Slot; r: Rarity[]; style?: Style; only?: RegExp; types?: ArmorType[]; off?: OffKind[] }
export interface ShopInfo { npc: string; quote: string; section: string; potions?: boolean; lines: ShopLine[] }
const NORMAL_ACC = /(Prote|Vitalidade|Fúria|Botas Velozes)/;
const MAGIC_ACC = /(Amuleto Arcano|Anel do Mago|Pingente de Cristal)/;
const MONK_GEAR = /(Monge|Mosteiro|Punho Celestial|Mestre Ki)/;
export const SHOP_INFO: Record<ShopId, ShopInfo> = {
  smith: {
    npc: 'Ferreira Durga', quote: '“Aço forjado com fogo de dragão. Barato não é, mas dura.”', section: 'Espadas, machados, escudos e armaduras',
    lines: [
      { slot: 'mainhand', style: 'melee', only: /^(adaga|espada|ma[çc]a|machad|martelo|montante|l[âa]mina)/i, r: [2, 3, 3, 3] },
      { slot: 'body', types: ['light', 'medium', 'heavy'], r: [2, 3, 3] },
      { slot: 'head', types: ['light', 'medium', 'heavy'], r: [2, 3] },
      { slot: 'legs', types: ['light', 'medium', 'heavy'], r: [2, 3] },
      { slot: 'offhand', off: ['shield'], r: [2, 3] },
      { slot: 'offhand', off: ['weapon'], r: [2] },
      { slot: 'accessory', only: NORMAL_ACC, r: [2, 3] },
    ],
  },
  sage: {
    npc: 'Sábio Orin', quote: '“Livros, orbes e cajados: o saber tem preço, aventureiro.”', section: 'Cajados, varinhas, grimórios, orbes e vestes mágicas',
    lines: [
      { slot: 'mainhand', style: 'magic', only: /^(cajado)/i, r: [2, 3] },
      { slot: 'mainhand', style: 'magic', only: /^(varinha|livro|grim[óo]rio de guerra|tomo arcano)/i, r: [2, 3, 3] },
      { slot: 'offhand', off: ['focus'], only: /^(orbe|grim[óo]rio|tomo)/i, r: [2, 3, 3] },
      { slot: 'body', types: ['cloth'], only: /(T[úu]nica|Robe|Manto|Vestes Estelares)/, r: [2, 3, 3] },
      { slot: 'head', types: ['cloth'], only: /(Chap[ée]u|Capuz Arcano)/, r: [2, 3] },
      { slot: 'legs', types: ['cloth'], only: /(Viagem|R[úu]nicas|Estelares)/, r: [2, 3] },
      { slot: 'accessory', only: MAGIC_ACC, r: [2, 3, 3] },
    ],
  },
  archer: {
    npc: 'Arqueira Lyra Folhaverde', quote: '“Um bom arco canta quando solta a corda. Escolha o seu.”', section: 'Arcos, bestas, aljavas, flechas e couros de caça',
    lines: [
      { slot: 'mainhand', style: 'ranged', only: /^(arco|besta(?! de pulso))/i, r: [2, 3, 3] },
      { slot: 'mainhand', style: 'ranged', only: /^(besta de pulso|bra[çc]adeira)/i, r: [2, 3, 3] },
      { slot: 'body', types: ['light', 'medium'], r: [2, 3, 3] },
      { slot: 'head', types: ['light', 'medium'], r: [2, 3] },
      { slot: 'legs', types: ['light', 'medium'], r: [2, 3] },
      { slot: 'accessory', only: /(Aljava|Flechas|Braçais)/, r: [2, 3, 3, 3] },
    ],
  },
  monk: {
    npc: 'Mestre Kaelen', quote: '“O punho e a mente são uma só arma. Vista-se leve e golpeie com o ki.”', section: 'Manoplas, bastões, vestes de monge e talismãs de ki',
    lines: [
      { slot: 'mainhand', style: 'melee', only: /^(manopla|kama|punhos|bast[ãa]o)/i, r: [2, 3, 3] },
      { slot: 'mainhand', style: 'melee', only: /^bord[ãa]o/i, r: [2, 3, 3] },
      { slot: 'body', types: ['cloth'], only: MONK_GEAR, r: [2, 3, 3] },
      { slot: 'head', types: ['cloth'], only: MONK_GEAR, r: [2, 3] },
      { slot: 'legs', types: ['cloth'], only: MONK_GEAR, r: [2, 3] },
      { slot: 'accessory', only: /(Faixa do Punho|Anel de Ki|Sand[áa]lias)/, r: [2, 3, 3] },
    ],
  },
  rogue: {
    npc: 'Nyx Mãos-Leves', quote: '“Psiu... lâminas leves, couro silencioso e nenhuma pergunta. Preço fechado.”', section: 'Adagas, rapieiras, couro leve e ferramentas de ladrão',
    lines: [
      { slot: 'mainhand', style: 'melee', only: /^(adaga|espada curta|rapieira)/i, r: [2, 3, 3] },
      { slot: 'mainhand', style: 'melee', only: /^bord[ãa]o/i, r: [2, 3] },
      { slot: 'offhand', off: ['weapon'], r: [2, 3] },
      { slot: 'body', types: ['light'], r: [2, 3, 3] },
      { slot: 'head', types: ['light'], r: [2, 3] },
      { slot: 'legs', types: ['light'], r: [2, 3] },
      { slot: 'accessory', only: /(Capa|Anel do Gatuno|Ferramentas|Botas Velozes)/, r: [2, 3, 3] },
    ],
  },
  cleric: {
    npc: 'Irmão Tomás Luzdourada', quote: '“Que Pelor guie a sua lâmina. Maças, escudos e a luz do sol — tudo abençoado.”', section: 'Maças, símbolos sagrados, escudos e armaduras abençoadas',
    lines: [
      { slot: 'mainhand', style: 'melee', only: /^(ma[çc]a|martelo|espada longa|montante)/i, r: [2, 3, 3] },
      { slot: 'offhand', off: ['shield'], r: [2, 3] },
      { slot: 'offhand', off: ['focus'], only: /^s[íi]mbolo/i, r: [2, 3] },
      { slot: 'body', types: ['medium', 'heavy'], only: /(Couraça|Radiante|Cota|Loriga|Brunea|Peitoral)/, r: [2, 3, 3] },
      { slot: 'head', types: ['medium', 'heavy'], only: /(Elmo do Sol|Elmo de Aço|Elmo Grande|Elmo de Placas)/, r: [2, 3] },
      { slot: 'legs', types: ['medium', 'heavy'], only: /(Grevas do Sol|Grevas de Aço|Grevas de Placas|Grevas Segmentadas)/, r: [2, 3] },
      { slot: 'accessory', only: /(Amuleto Sagrado|Vitalidade|Prote)/, r: [2, 3, 3] },
    ],
  },
  druid: {
    npc: 'Druida Ilvandra', quote: '“A floresta fornece. Foices de lua, totens e casca de carvalho antigo.”', section: 'Foices lunares, cajados druídicos, totens e cascas de carvalho',
    lines: [
      { slot: 'mainhand', style: 'magic', only: /^(foice|cajado dru|varinha de carv)/i, r: [2, 3, 3] },
      { slot: 'offhand', off: ['focus'], only: /^totem/i, r: [2, 3] },
      { slot: 'offhand', off: ['shield'], r: [2] },
      { slot: 'body', types: ['medium'], only: /(Casca)/, r: [2, 3, 3] },
      { slot: 'head', types: ['medium'], only: /(Coroa de Folhas)/, r: [2, 3] },
      { slot: 'legs', types: ['medium'], only: /(Perneiras de Casca)/, r: [2, 3] },
      { slot: 'accessory', only: /(Folha de Carvalho|Colar de Presas|Vitalidade)/, r: [2, 3, 3] },
    ],
  },
  bard: {
    npc: 'Menestrel Fenwick', quote: '“Nada como um bom alaúde e uma plateia! Compre um e eu componho uma balada sobre você.”', section: 'Alaúdes, harpas e trajes de menestrel',
    lines: [
      { slot: 'mainhand', style: 'magic', only: /^(alaúde|harpa)/i, r: [2, 3, 3, 3] },
      { slot: 'body', types: ['light'], only: /(Menestrel|Trovador)/, r: [2, 3, 3] },
      { slot: 'head', types: ['light'], only: /(Menestrel)/, r: [2, 3] },
      { slot: 'legs', types: ['light'], only: /(Menestrel)/, r: [2, 3] },
      { slot: 'accessory', only: /(Gema do Bardo|Botas Velozes|Capa Élfica)/, r: [2, 3, 3] },
    ],
  },
  necro: {
    npc: 'Mortícia, a Coveira', quote: '“Os mortos não reclamam do preço. Cetros de osso, grimórios dos mortos e mantos sepulcrais...”', section: 'Cetros de osso, livros dos mortos, crânios rituais e mantos sepulcrais',
    lines: [
      { slot: 'mainhand', style: 'magic', only: /^(cetro|cajado de ossos|livro dos mortos)/i, r: [2, 3, 3, 3] },
      { slot: 'offhand', off: ['focus'], only: /^(cr[âa]nio|filact|tomo)/i, r: [2, 3, 3] },
      { slot: 'body', types: ['cloth'], only: /(Necromante|Lich)/, r: [2, 3, 3] },
      { slot: 'head', types: ['cloth'], only: /(Sepulcral|Lich)/, r: [2, 3] },
      { slot: 'legs', types: ['cloth'], only: /(Sepulcrais|Lich)/, r: [2, 3] },
      { slot: 'accessory', only: /(Anel Necromântico|Amuleto de Ossos)/, r: [2, 3, 3] },
    ],
  },
  barbarian: {
    npc: 'Grogna Punho-de-Pedra', quote: '“Machado grande, golpe grande! Peles de urso para quem não tem medo de arranhão.”', section: 'Machados, martelos e peles de urso',
    lines: [
      { slot: 'mainhand', style: 'melee', only: /^(machad|martelo|montante)/i, r: [2, 3, 3, 3] },
      { slot: 'offhand', off: ['weapon'], only: /^machadinha/i, r: [2, 3] },
      { slot: 'body', types: ['medium'], only: /(Peles de Urso)/, r: [2, 3, 3] },
      { slot: 'head', types: ['medium'], only: /(Elmo de Chifres)/, r: [2, 3] },
      { slot: 'legs', types: ['medium'], only: /(Calças de Pele)/, r: [2, 3] },
      { slot: 'accessory', only: /(Colar de Presas|Fúria|Vitalidade)/, r: [2, 3, 3] },
    ],
  },
  general: {
    npc: 'Mercadora Sildra', quote: '“Poções, amuletos e curiosidades de terras distantes!”', section: 'Amuletos e anéis', potions: true,
    lines: [{ slot: 'accessory', only: /(Prote|Vitalidade|Fúria|Amuleto Arcano|Botas Velozes|Anel da Fortuna|Anel do Estudioso)/, r: [2, 2, 3, 3] }],
  },
};

/** Estoque da loja: depende da especialidade da loja (não da classe de quem compra) e do nível do jogador. */
export function genShopStock(level: number, shop: ShopId): Item[] {
  const lv = Math.min(10, level + 1);
  const info = SHOP_INFO[shop];
  const g = (l: ShopLine, rarity: Rarity) => genItem({ slot: l.slot, level: lv, style: l.style ?? 'melee', rarity, armorMax: 'heavy', off: l.off, only: l.only, types: l.types });
  const out: Item[] = [];
  for (const l of info.lines) for (const r of l.r) out.push(g(l, r));
  if (level >= 8 && shop !== 'general') {
    const seen = new Set<Slot>();
    for (const l of info.lines) if (!seen.has(l.slot) && l.slot !== 'accessory') { seen.add(l.slot); out.push(g(l, 4)); }
  }
  return out;
}

/**
 * Confere se um item está dentro do que o gerador (`genItem`) consegue produzir: mesma base, dados, velocidade,
 * CA, bônus e encanto. Usado pelo servidor online para não aceitar itens inventados na ficha do jogador.
 * Retorna o motivo da recusa, ou null se o item é plausível.
 */
export function itemProblem(it: Item): string | null {
  const r = it.rarity;
  if (!Number.isInteger(r) || r < 0 || r > 4) return 'raridade inválida';
  const longest = <T extends { name: string }>(l: T[]) => l.filter((b) => it.name.startsWith(b.name)).sort((a, b) => b.name.length - a.name.length)[0];
  const k = 1 + r * 0.4;
  const statOk = (base: ItemStat | undefined, scale: (key: keyof ItemStat, v: number) => number) => {
    const st = (it.stat ?? {}) as Record<string, number>;
    const b = (base ?? {}) as Record<string, number>;
    for (const key of Object.keys(st)) {
      if (!(key in b)) return false;
      if (!(st[key] <= scale(key as keyof ItemStat, b[key]) + 0.011)) return false;
    }
    return true;
  };
  if (it.slot === 'mainhand') {
    const b = longest(Object.values(WEAPONS).flat());
    if (!b) return 'arma desconhecida';
    if (!it.dice || it.dice[0] !== b.dice[0] || it.dice[1] !== b.dice[1]) return 'dados de dano alterados';
    if (it.speed !== b.speed) return 'velocidade alterada';
    if ((it.plus ?? 0) > r || (it.plus ?? 0) < 0) return 'bônus acima do permitido';
    if (it.minLevel !== b.min) return 'nível mínimo alterado';
    if (it.stat && Object.keys(it.stat).length) return 'bônus extras em arma';
  } else if (it.slot === 'body') {
    const b = longest(ARMORS);
    if (!b) return 'armadura desconhecida';
    if (it.armorType !== b.type || it.dexCap !== b.dexCap) return 'tipo de armadura alterado';
    if (!((it.ac ?? 0) <= b.ac + r)) return 'CA acima do permitido';
    if (it.minLevel !== b.min) return 'nível mínimo alterado';
  } else if (it.slot === 'head' || it.slot === 'legs') {
    const b = longest(it.slot === 'head' ? HEADS : LEGS);
    if (!b) return 'peça desconhecida';
    if (it.armorType !== b.type) return 'tipo de armadura alterado';
    if (!((it.ac ?? 0) <= b.ac + (r >= 3 ? 1 : 0) + (r >= 4 ? 1 : 0))) return 'CA acima do permitido';
    if (!statOk(b.stat, (key, v) => (key === 'speed' ? +(v * k).toFixed(2) : Math.round(v * k)))) return 'bônus acima do permitido';
    if (it.minLevel !== b.min) return 'nível mínimo alterado';
  } else if (it.slot === 'offhand') {
    if (it.offKind === 'shield') {
      const b = longest(SHIELDS);
      if (!b) return 'escudo desconhecido';
      if (!((it.ac ?? 0) <= 2 + [0, 0, 1, 1, 2][r])) return 'CA acima do permitido';
      if (!statOk(b.stat, (_k, v) => Math.round(v * k))) return 'bônus acima do permitido';
      if (it.minLevel !== b.min) return 'nível mínimo alterado';
    } else if (it.offKind === 'weapon') {
      const b = longest(OFFWEAPONS);
      if (!b) return 'arma leve desconhecida';
      if (!it.dice || it.dice[0] !== b.dice[0] || it.dice[1] !== b.dice[1]) return 'dados de dano alterados';
      if ((it.plus ?? 0) > r) return 'bônus acima do permitido';
      if (it.minLevel !== b.min) return 'nível mínimo alterado';
    } else if (it.offKind === 'focus') {
      const b = longest(FOCI);
      if (!b) return 'foco desconhecido';
      if (!statOk(b.stat, (key, v) => (key === 'dmg' ? v + Math.floor(r / 2) : Math.round(v * k)))) return 'bônus acima do permitido';
      if (it.minLevel !== b.min) return 'nível mínimo alterado';
    } else return 'tipo de mão esquerda inválido';
  } else if (it.slot === 'accessory') {
    const b = longest(TRINKETS);
    if (!b) return 'acessório desconhecido';
    const keys = Object.keys(it.stat ?? {});
    if (keys.length !== 1 || keys[0] !== b.stat) return 'bônus do acessório alterado';
    if (!(((it.stat as Record<string, number>)[b.stat]) <= b.per * Math.max(1, r) + 0.011)) return 'bônus acima do permitido';
    if (it.minLevel !== b.min) return 'nível mínimo alterado';
  } else return 'espaço inválido';
  if (it.ench && it.slot !== 'mainhand') return 'encanto fora da arma';
  return null;
}
