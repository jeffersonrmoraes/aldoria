import { Dice } from './rules';

export interface MobDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  ac: number;
  atk: number;
  dmg: Dice;
  dmgBonus: number;
  speed: number;       // px/s
  aggro: number;       // raio de agressão (px)
  atkInterval: number; // ms
  xp: number;
  scale: number;
  boss?: boolean;
  elite?: boolean;     // versão elite (mais forte, drop garantido)
  fragment?: string;   // fragmento do Selo concedido ao ser derrotado
}

// Monstros do SRD 5.1 (CC-BY-4.0), com números ajustados para o ritmo de MMO.
export const MOBS: MobDef[] = [
  { id: 'rat', name: 'Rato Gigante', level: 1, hp: 14, ac: 10, atk: 2, dmg: [1, 4], dmgBonus: 0, speed: 46, aggro: 70, atkInterval: 1500, xp: 9, scale: 1 },
  { id: 'kobold', name: 'Kobold', level: 1, hp: 18, ac: 12, atk: 3, dmg: [1, 4], dmgBonus: 1, speed: 42, aggro: 75, atkInterval: 1500, xp: 12, scale: 1 },
  { id: 'slime', name: 'Gosma Cinzenta', level: 2, hp: 30, ac: 8, atk: 3, dmg: [1, 6], dmgBonus: 0, speed: 24, aggro: 55, atkInterval: 1800, xp: 16, scale: 1 },
  { id: 'goblin', name: 'Goblin', level: 3, hp: 38, ac: 13, atk: 4, dmg: [1, 6], dmgBonus: 2, speed: 50, aggro: 90, atkInterval: 1400, xp: 22, scale: 1 },
  { id: 'wolf', name: 'Lobo', level: 4, hp: 45, ac: 13, atk: 4, dmg: [1, 8], dmgBonus: 2, speed: 72, aggro: 100, atkInterval: 1300, xp: 28, scale: 1 },
  { id: 'skeleton', name: 'Esqueleto', level: 5, hp: 60, ac: 13, atk: 5, dmg: [1, 8], dmgBonus: 2, speed: 45, aggro: 95, atkInterval: 1500, xp: 36, scale: 1 },
  { id: 'zombie', name: 'Zumbi', level: 6, hp: 95, ac: 8, atk: 4, dmg: [1, 10], dmgBonus: 3, speed: 28, aggro: 80, atkInterval: 1800, xp: 46, scale: 1 },
  { id: 'orc', name: 'Orc', level: 7, hp: 85, ac: 13, atk: 6, dmg: [1, 10], dmgBonus: 3, speed: 52, aggro: 105, atkInterval: 1500, xp: 58, scale: 1 },
  { id: 'bugbear', name: 'Bugbear', level: 8, hp: 120, ac: 15, atk: 6, dmg: [2, 6], dmgBonus: 3, speed: 50, aggro: 105, atkInterval: 1600, xp: 74, scale: 1.5 },
  { id: 'ogre', name: 'Ogro', level: 9, hp: 170, ac: 11, atk: 7, dmg: [2, 8], dmgBonus: 4, speed: 40, aggro: 100, atkInterval: 1900, xp: 98, scale: 2 },
  { id: 'jackal', name: 'Chacal', level: 1, hp: 16, ac: 12, atk: 3, dmg: [1, 4], dmgBonus: 1, speed: 64, aggro: 85, atkInterval: 1300, xp: 11, scale: 0.85 },
  { id: 'bandit', name: 'Bandido', level: 2, hp: 28, ac: 12, atk: 3, dmg: [1, 6], dmgBonus: 1, speed: 52, aggro: 95, atkInterval: 1500, xp: 18, scale: 1 },
  { id: 'worg', name: 'Worg', level: 4, hp: 58, ac: 13, atk: 5, dmg: [1, 8], dmgBonus: 2, speed: 78, aggro: 105, atkInterval: 1300, xp: 30, scale: 1.3 },
  { id: 'hobgoblin', name: 'Hobgoblin', level: 4, hp: 52, ac: 14, atk: 5, dmg: [1, 8], dmgBonus: 2, speed: 50, aggro: 95, atkInterval: 1500, xp: 30, scale: 1.1 },
  { id: 'ghoul', name: 'Carniçal', level: 6, hp: 78, ac: 12, atk: 5, dmg: [1, 8], dmgBonus: 2, speed: 55, aggro: 95, atkInterval: 1400, xp: 46, scale: 1 },
  { id: 'shadow', name: 'Sombra', level: 6, hp: 70, ac: 12, atk: 5, dmg: [1, 8], dmgBonus: 3, speed: 60, aggro: 100, atkInterval: 1400, xp: 48, scale: 1.1 },
  { id: 'orcshaman', name: 'Xamã Orc', level: 8, hp: 90, ac: 12, atk: 7, dmg: [1, 10], dmgBonus: 3, speed: 50, aggro: 110, atkInterval: 1600, xp: 76, scale: 1.1 },
  { id: 'gnoll', name: 'Gnoll', level: 8, hp: 100, ac: 13, atk: 6, dmg: [1, 10], dmgBonus: 3, speed: 60, aggro: 105, atkInterval: 1400, xp: 74, scale: 1.15 },
  { id: 'troll', name: 'Troll', level: 10, hp: 200, ac: 13, atk: 8, dmg: [2, 8], dmgBonus: 4, speed: 46, aggro: 105, atkInterval: 1700, xp: 118, scale: 2 },
  // Pântano Abandonado (nível 11–13) e Deserto (nível 14–16) — SRD 5.1
  { id: 'lizardfolk', name: 'Homem-Lagarto', level: 11, hp: 240, ac: 14, atk: 9, dmg: [1, 10], dmgBonus: 4, speed: 52, aggro: 105, atkInterval: 1500, xp: 150, scale: 1.15 },
  { id: 'giantfrog', name: 'Sapo Gigante', level: 11, hp: 190, ac: 12, atk: 8, dmg: [1, 8], dmgBonus: 3, speed: 62, aggro: 90, atkInterval: 1300, xp: 130, scale: 1.2 },
  { id: 'crocodile', name: 'Crocodilo', level: 12, hp: 290, ac: 13, atk: 10, dmg: [2, 8], dmgBonus: 4, speed: 56, aggro: 100, atkInterval: 1700, xp: 170, scale: 1.5 },
  { id: 'willowisp', name: 'Fogo-Fátuo', level: 12, hp: 220, ac: 15, atk: 10, dmg: [2, 6], dmgBonus: 4, speed: 66, aggro: 115, atkInterval: 1400, xp: 175, scale: 0.9 },
  { id: 'shambler', name: 'Monte Movediço', level: 13, hp: 380, ac: 12, atk: 10, dmg: [2, 10], dmgBonus: 5, speed: 34, aggro: 95, atkInterval: 1900, xp: 210, scale: 2 },
  { id: 'greenhag', name: 'Bruxa Verde', level: 13, hp: 300, ac: 17, atk: 11, dmg: [2, 8], dmgBonus: 5, speed: 50, aggro: 115, atkInterval: 1600, xp: 220, scale: 1.15 },
  { id: 'scorpion', name: 'Escorpião Gigante', level: 14, hp: 360, ac: 15, atk: 12, dmg: [2, 8], dmgBonus: 5, speed: 58, aggro: 100, atkInterval: 1500, xp: 260, scale: 1.6 },
  { id: 'vulture', name: 'Abutre Gigante', level: 14, hp: 330, ac: 13, atk: 12, dmg: [2, 6], dmgBonus: 5, speed: 76, aggro: 115, atkInterval: 1300, xp: 255, scale: 1.4 },
  { id: 'dustmephit', name: 'Mefit de Poeira', level: 15, hp: 300, ac: 14, atk: 12, dmg: [2, 6], dmgBonus: 5, speed: 68, aggro: 115, atkInterval: 1300, xp: 270, scale: 0.8 },
  { id: 'mummy', name: 'Múmia', level: 15, hp: 440, ac: 15, atk: 13, dmg: [2, 10], dmgBonus: 6, speed: 38, aggro: 100, atkInterval: 1800, xp: 300, scale: 1.15 },
  { id: 'wight', name: 'Aparição', level: 16, hp: 460, ac: 16, atk: 13, dmg: [2, 8], dmgBonus: 6, speed: 52, aggro: 110, atkInterval: 1500, xp: 330, scale: 1.1 },
  { id: 'gnarlmaw', name: 'Gnarlmaw, o Ogro Ancião', level: 10, hp: 1100, ac: 14, atk: 8, dmg: [2, 8], dmgBonus: 4, speed: 44, aggro: 210, atkInterval: 1500, xp: 400, scale: 3, boss: true },
  // chefes e monstros de masmorra
  { id: 'cultist', name: 'Cultista Cinzento', level: 6, hp: 80, ac: 12, atk: 5, dmg: [1, 8], dmgBonus: 2, speed: 55, aggro: 100, atkInterval: 1500, xp: 40, scale: 1 },
  { id: 'ratking', name: 'Dentes-de-Ferro, Rei dos Ratos', level: 3, hp: 300, ac: 12, atk: 4, dmg: [1, 6], dmgBonus: 2, speed: 52, aggro: 210, atkInterval: 1400, xp: 130, scale: 2.4, boss: true, fragment: 'f1' },
  { id: 'goblinking', name: 'Snaggle, o Rei Goblin', level: 5, hp: 540, ac: 14, atk: 6, dmg: [1, 8], dmgBonus: 3, speed: 58, aggro: 210, atkInterval: 1300, xp: 240, scale: 1.4, boss: true, fragment: 'f2' },
  { id: 'skelknight', name: 'Sir Aldric, o Condenado', level: 7, hp: 800, ac: 17, atk: 7, dmg: [2, 6], dmgBonus: 3, speed: 48, aggro: 210, atkInterval: 1500, xp: 340, scale: 1.5, boss: true, fragment: 'f3' },
  { id: 'warlord', name: 'Grukthar Quebra-Osso', level: 9, hp: 1100, ac: 16, atk: 8, dmg: [2, 6], dmgBonus: 4, speed: 54, aggro: 210, atkInterval: 1500, xp: 500, scale: 1.7, boss: true, fragment: 'f4' },
  { id: 'herald', name: 'Vessk, Arauto Cinzento', level: 10, hp: 1600, ac: 15, atk: 9, dmg: [2, 6], dmgBonus: 4, speed: 58, aggro: 210, atkInterval: 1300, xp: 750, scale: 1.55, boss: true, fragment: 'f5' },
];

export const MOB_BY_ID: Record<string, MobDef> = Object.fromEntries(MOBS.map((m) => [m.id, m]));

/** Versão elite de um monstro: mais vida e dano, XP triplo e item garantido. */
export function eliteOf(d: MobDef): MobDef {
  return { ...d, name: 'Elite: ' + d.name, hp: Math.round(d.hp * 2.4), atk: d.atk + 1, dmgBonus: d.dmgBonus + 2, xp: d.xp * 3, scale: d.scale * 1.25, elite: true };
}
