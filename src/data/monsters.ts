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
