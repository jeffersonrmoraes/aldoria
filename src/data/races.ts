import { Ability, SkillDef } from './rules';

export interface RaceDef {
  id: string;
  name: string;
  desc: string;
  bonus: Partial<Record<Ability, number>>;
  trait: string;
  traitDesc: string;
  skin: string;
  tones: string[]; // tons de pele/escamas disponíveis na criação (o primeiro é o padrão)
  mods: {
    speed?: number; hpLevel?: number; crit?: boolean; luck?: boolean;
    energy?: number; xp?: number; relentless?: boolean;
  };
  look: { ears?: boolean; beard?: boolean; horns?: boolean; tusks?: boolean; snout?: boolean; bigNose?: boolean; scale?: number };
  racial?: SkillDef;
}

export const RACES: RaceDef[] = [
  {
    id: 'human', name: 'Humano', desc: 'Versáteis e ambiciosos, aprendem rápido em qualquer caminho.',
    bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    trait: 'Versátil', traitDesc: '+10% de XP ganho.',
    skin: '#e8b88a', tones: ['#f7c282', '#e8b88a', '#d99a6c', '#b97a56', '#8d5a3b', '#5e3a26'], mods: { xp: 0.1 }, look: {},
  },
  {
    id: 'elf', name: 'Elfo', desc: 'Graciosos e atentos, com sentidos afiados e movimentos precisos.',
    bonus: { dex: 2 },
    trait: 'Sentidos Aguçados', traitDesc: 'Acerto crítico com 19–20 no d20.',
    skin: '#f2d6b8', tones: ['#fbe0c4', '#f7c282', '#e8c9a0', '#d0c4b8', '#b8c8a0', '#9aa8c8'], mods: { crit: true }, look: { ears: true },
  },
  {
    id: 'dwarf', name: 'Anão', desc: 'Robustos e teimosos, forjados nas montanhas.',
    bonus: { con: 2 },
    trait: 'Resiliência Anã', traitDesc: '+1 PV extra por nível.',
    skin: '#d9a070', tones: ['#f0b88a', '#d99a6c', '#c4825a', '#a86a46', '#7e4e34', '#5e3a26'], mods: { hpLevel: 1 }, look: { beard: true, scale: 0.92 },
  },
  {
    id: 'halfling', name: 'Halfling', desc: 'Pequenos, ágeis e surpreendentemente sortudos.',
    bonus: { dex: 2 },
    trait: 'Sortudo', traitDesc: 'Rerrola um 1 natural nos ataques.',
    skin: '#e8b88a', tones: ['#f7c282', '#e8b88a', '#d99a6c', '#b97a56', '#8d5a3b', '#f2d6b8'], mods: { luck: true }, look: { scale: 0.82 },
  },
  {
    id: 'dragonborn', name: 'Draconato', desc: 'Orgulhosos descendentes de dragões, com escamas e sopro elemental.',
    bonus: { str: 2, cha: 1 },
    trait: 'Sopro Dracônico', traitDesc: 'Habilidade racial [4]: cone de fogo.',
    skin: '#3aa86a', tones: ['#3aa86a', '#c0392b', '#2e6fb5', '#c9a24a', '#7a4cb0', '#707880'], mods: {}, look: { snout: true },
    racial: {
      id: 'breath', name: 'Sopro Dracônico', desc: 'Sopra um cone de fogo à frente.', icon: '🔥',
      unlock: 1, cd: 9000, cost: 20, kind: 'cone', mult: 1.4, radius: 78, color: 0xff7a1a,
    },
  },
  {
    id: 'gnome', name: 'Gnomo', desc: 'Curiosos e inventivos, com uma mente brilhante.',
    bonus: { int: 2 },
    trait: 'Astúcia Gnômica', traitDesc: '+25% de energia máxima.',
    skin: '#e0b080', tones: ['#f0b88a', '#e8a878', '#d99a6c', '#c47a56', '#f7c282', '#b8c8e0'], mods: { energy: 0.25 }, look: { bigNose: true, scale: 0.84 },
  },
  {
    id: 'halfelf', name: 'Meio-Elfo', desc: 'Carismáticos, entre dois mundos, adaptáveis.',
    bonus: { cha: 2, dex: 1, con: 1 },
    trait: 'Pés Ligeiros', traitDesc: '+6% de velocidade de movimento.',
    skin: '#ecc7a2', tones: ['#f7c282', '#ecc7a2', '#d99a6c', '#b97a56', '#8d5a3b', '#fbe0c4'], mods: { speed: 0.06 }, look: { ears: true },
  },
  {
    id: 'halforc', name: 'Meio-Orc', desc: 'Fortes e ferozes, vivem para a batalha.',
    bonus: { str: 2, con: 1 },
    trait: 'Resistência Implacável', traitDesc: 'Uma vez a cada 90s, sobrevive com 1 PV ao receber golpe fatal.',
    skin: '#7aa860', tones: ['#7aa860', '#6a9a50', '#8aa070', '#8a9a8a', '#b0a070', '#6b7a5a'], mods: { relentless: true }, look: { tusks: true },
  },
  {
    id: 'tiefling', name: 'Tiferino', desc: 'Marcados por uma herança infernal, com chifres e carisma sombrio.',
    bonus: { cha: 2, int: 1 },
    trait: 'Herança Infernal', traitDesc: 'Habilidade racial [4]: onda de fogo infernal.',
    skin: '#b04a6a', tones: ['#b04a6a', '#c0392b', '#7a4cb0', '#4a6ab0', '#9a3a8a', '#8a8a96'], mods: {}, look: { horns: true },
    racial: {
      id: 'hellfire', name: 'Repreensão Infernal', desc: 'Uma onda de fogo infernal explode ao seu redor.', icon: '😈',
      unlock: 1, cd: 10000, cost: 20, kind: 'nova', mult: 1.3, radius: 58, color: 0xd0194a,
    },
  },
];

export const RACE_BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((r) => [r.id, r]));
