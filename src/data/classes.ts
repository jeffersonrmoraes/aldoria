import { Ability, Dice, SkillDef } from './rules';

export type Style = 'melee' | 'ranged' | 'magic';
export type ArmorType = 'cloth' | 'light' | 'medium' | 'heavy';
export const ARMOR_RANK: Record<ArmorType, number> = { cloth: 0, light: 1, medium: 2, heavy: 3 };
export const ARMOR_NAMES: Record<ArmorType, string> = { cloth: 'Tecido', light: 'Leve', medium: 'Média', heavy: 'Pesada' };

export type Hat = 'none' | 'helm' | 'horns' | 'wizard' | 'hood' | 'band' | 'circlet' | 'crown' | 'feather';
export type WeaponArt = 'sword' | 'axe' | 'staff' | 'bow' | 'mace' | 'dagger' | 'fists' | 'wand' | 'lute';

export interface ClassDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  hit: number;
  primary: Ability;
  priority: Ability[];
  style: Style;
  range: number;          // alcance do ataque básico (px)
  speedMod: number;       // multiplicador do intervalo de ataque
  armor: ArmorType;       // maior armadura que sabe usar
  unarmored?: 'monk' | 'barb';
  startWeapon: string;
  atkColor: number;
  art: { body: string; dark: string; hat: Hat; weapon: WeaponArt; accent: string; shield?: boolean };
  skills: SkillDef[];     // 3 habilidades: níveis 1, 3, 5
}

const S = (s: SkillDef) => s;

export const CLASSES: ClassDef[] = [
  {
    id: 'barbarian', name: 'Bárbaro', role: 'Dano corpo a corpo', hit: 12, primary: 'str',
    desc: 'Guerreiro selvagem movido pela fúria. Muita vida e golpes devastadores.',
    priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], style: 'melee', range: 24, speedMod: 1, armor: 'medium', unarmored: 'barb',
    startWeapon: 'Machadinha', atkColor: 0xffffff,
    art: { body: '#8a4b2a', dark: '#5c2f18', hat: 'horns', weapon: 'axe', accent: '#c0392b' },
    skills: [
      S({ id: 'brutal', name: 'Golpe Brutal', desc: 'Golpe devastador (dano x2,2).', icon: '🪓', unlock: 1, cd: 5000, cost: 18, kind: 'strike', mult: 2.2, range: 30 }),
      S({ id: 'rage', name: 'Fúria', desc: '+4 de dano e +10% velocidade de ataque por 14s.', icon: '😡', unlock: 3, cd: 24000, cost: 25, kind: 'buff', dur: 14000, buff: { dmg: 4, atkSpeed: 0.1 } }),
      S({ id: 'charge', name: 'Investida', desc: 'Avança e golpeia os inimigos próximos.', icon: '🐗', unlock: 5, cd: 9000, cost: 22, kind: 'dash', mult: 1.6, range: 30 }),
    ],
  },
  {
    id: 'bard', name: 'Bardo', role: 'Suporte / dano mágico', hit: 8, primary: 'cha',
    desc: 'Artista mágico que inspira aliados e fere inimigos com palavras afiadas.',
    priority: ['cha', 'dex', 'con', 'wis', 'int', 'str'], style: 'magic', range: 105, speedMod: 1, armor: 'light',
    startWeapon: 'Varinha de Carvalho', atkColor: 0xff7ad9,
    art: { body: '#7a2e8f', dark: '#4b1c5a', hat: 'feather', weapon: 'lute', accent: '#e74c3c' },
    skills: [
      S({ id: 'mockery', name: 'Zombaria Viciosa', desc: 'Insulto mágico (dano x1,6).', icon: '🎭', unlock: 1, cd: 4000, cost: 14, kind: 'bolt', mult: 1.6, range: 130, color: 0xff7ad9 }),
      S({ id: 'rest', name: 'Canção de Descanso', desc: 'Cura ferimentos.', icon: '🎶', unlock: 3, cd: 12000, cost: 24, kind: 'heal', mult: 1 }),
      S({ id: 'inspire', name: 'Inspiração Bárdica', desc: '+2 dano, +2 CA e regeneração por 16s.', icon: '🎵', unlock: 5, cd: 26000, cost: 28, kind: 'buff', dur: 16000, buff: { dmg: 2, ac: 2, regen: 2 } }),
    ],
  },
  {
    id: 'cleric', name: 'Clérigo', role: 'Curandeiro / resistente', hit: 8, primary: 'wis',
    desc: 'Servo divino que cura aliados e castiga inimigos com poder sagrado.',
    priority: ['wis', 'con', 'str', 'cha', 'dex', 'int'], style: 'melee', range: 24, speedMod: 1, armor: 'medium',
    startWeapon: 'Maça', atkColor: 0xfff2a8,
    art: { body: '#e8e8f4', dark: '#a9a9c4', hat: 'circlet', weapon: 'mace', accent: '#f1c40f', shield: true },
    skills: [
      S({ id: 'sacred', name: 'Chama Sagrada', desc: 'Raio radiante (dano x1,8).', icon: '✨', unlock: 1, cd: 4500, cost: 15, kind: 'bolt', mult: 1.8, range: 120, color: 0xfff2a8 }),
      S({ id: 'cure', name: 'Curar Ferimentos', desc: 'Cura poderosa.', icon: '💖', unlock: 3, cd: 9000, cost: 22, kind: 'heal', mult: 1.3 }),
      S({ id: 'guardians', name: 'Guardiões Espirituais', desc: 'Espíritos ferem e retardam inimigos próximos.', icon: '👼', unlock: 5, cd: 12000, cost: 28, kind: 'nova', mult: 1.2, radius: 70, slow: true, color: 0xfff2a8 }),
    ],
  },
  {
    id: 'druid', name: 'Druida', role: 'Mágico / controle', hit: 8, primary: 'wis',
    desc: 'Guardião da natureza que domina as forças selvagens.',
    priority: ['wis', 'con', 'dex', 'int', 'cha', 'str'], style: 'magic', range: 110, speedMod: 1, armor: 'medium',
    startWeapon: 'Cajado Simples', atkColor: 0x7ae07a,
    art: { body: '#3f7a3a', dark: '#285225', hat: 'hood', weapon: 'staff', accent: '#7ae07a' },
    skills: [
      S({ id: 'thorn', name: 'Chicote Espinhoso', desc: 'Espinhos mágicos (dano x1,6).', icon: '🌿', unlock: 1, cd: 4000, cost: 14, kind: 'bolt', mult: 1.6, range: 130, color: 0x7ae07a }),
      S({ id: 'heal', name: 'Cura Natural', desc: 'Cura com energia da natureza.', icon: '🍃', unlock: 3, cd: 10000, cost: 22, kind: 'heal', mult: 1.2 }),
      S({ id: 'swarm', name: 'Enxame de Espinhos', desc: 'Área ao redor, retarda inimigos.', icon: '🌵', unlock: 5, cd: 11000, cost: 26, kind: 'nova', mult: 1.3, radius: 75, slow: true, color: 0x7ae07a }),
    ],
  },
  {
    id: 'fighter', name: 'Guerreiro', role: 'Dano / tanque', hit: 10, primary: 'str',
    desc: 'Mestre de armas e armaduras. Simples, confiável e letal.',
    priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'], style: 'melee', range: 24, speedMod: 1, armor: 'heavy',
    startWeapon: 'Espada Curta', atkColor: 0xffffff,
    art: { body: '#6a7a8f', dark: '#46525f', hat: 'helm', weapon: 'sword', accent: '#c0392b', shield: true },
    skills: [
      S({ id: 'power', name: 'Golpe Poderoso', desc: 'Ataque preciso e forte (dano x1,9).', icon: '⚔️', unlock: 1, cd: 4500, cost: 15, kind: 'strike', mult: 1.9, range: 30 }),
      S({ id: 'wind', name: 'Retomar o Fôlego', desc: 'Recupera vida.', icon: '💨', unlock: 3, cd: 14000, cost: 18, kind: 'heal', mult: 1.1 }),
      S({ id: 'surge', name: 'Surto de Ação', desc: '+3 dano e +20% velocidade de ataque por 10s.', icon: '⚡', unlock: 5, cd: 22000, cost: 25, kind: 'buff', dur: 10000, buff: { dmg: 3, atkSpeed: 0.2 } }),
    ],
  },
  {
    id: 'monk', name: 'Monge', role: 'Dano rápido / mobilidade', hit: 8, primary: 'dex',
    desc: 'Lutador disciplinado que canaliza energia interior em golpes velozes.',
    priority: ['dex', 'wis', 'con', 'str', 'cha', 'int'], style: 'melee', range: 22, speedMod: 0.65, armor: 'cloth', unarmored: 'monk',
    startWeapon: 'Manoplas de Couro', atkColor: 0xffe08a,
    art: { body: '#e08a2a', dark: '#a8601a', hat: 'band', weapon: 'fists', accent: '#c0392b' },
    skills: [
      S({ id: 'flurry', name: 'Rajada de Golpes', desc: 'Três golpes rápidos (x0,8 cada).', icon: '👊', unlock: 1, cd: 5000, cost: 16, kind: 'strike', mult: 0.8, hits: 3, range: 28 }),
      S({ id: 'step', name: 'Passo do Vento', desc: 'Corrida veloz que atinge quem estiver perto.', icon: '🌀', unlock: 3, cd: 8000, cost: 18, kind: 'dash', mult: 1.2, range: 28 }),
      S({ id: 'stun', name: 'Punho Atordoante', desc: 'Golpe que atordoa por 2s (x1,6).', icon: '💫', unlock: 5, cd: 12000, cost: 24, kind: 'strike', mult: 1.6, range: 28, stun: 2000 }),
    ],
  },
  {
    id: 'paladin', name: 'Paladino', role: 'Tanque / dano sagrado', hit: 10, primary: 'str',
    desc: 'Cavaleiro sagrado que une força marcial e poder divino.',
    priority: ['str', 'cha', 'con', 'wis', 'dex', 'int'], style: 'melee', range: 24, speedMod: 1, armor: 'heavy',
    startWeapon: 'Espada Curta', atkColor: 0xfff2a8,
    art: { body: '#d8d8e8', dark: '#9a9ab4', hat: 'helm', weapon: 'sword', accent: '#f1c40f', shield: true },
    skills: [
      S({ id: 'smite', name: 'Punição Divina', desc: 'Golpe radiante (dano x2).', icon: '🌟', unlock: 1, cd: 5000, cost: 18, kind: 'strike', mult: 2, range: 30 }),
      S({ id: 'hands', name: 'Imposição de Mãos', desc: 'Cura poderosa.', icon: '🙌', unlock: 3, cd: 13000, cost: 24, kind: 'heal', mult: 1.4 }),
      S({ id: 'aura', name: 'Aura de Proteção', desc: '+3 CA e regeneração por 15s.', icon: '🛡️', unlock: 5, cd: 24000, cost: 26, kind: 'buff', dur: 15000, buff: { ac: 3, regen: 2 } }),
    ],
  },
  {
    id: 'ranger', name: 'Patrulheiro', role: 'Dano à distância', hit: 10, primary: 'dex',
    desc: 'Caçador e rastreador das terras selvagens, mortal com seu arco.',
    priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'], style: 'ranged', range: 140, speedMod: 1, armor: 'medium',
    startWeapon: 'Arco Curto', atkColor: 0xd9c08a,
    art: { body: '#4d7a45', dark: '#2f5028', hat: 'hood', weapon: 'bow', accent: '#a8c060' },
    skills: [
      S({ id: 'double', name: 'Tiro Duplo', desc: 'Duas flechas (x0,9 cada).', icon: '🏹', unlock: 1, cd: 4500, cost: 15, kind: 'bolt', mult: 0.9, hits: 2, range: 150, color: 0xd9c08a }),
      S({ id: 'mark', name: 'Marca do Caçador', desc: '+3 de dano por 16s.', icon: '🎯', unlock: 3, cd: 20000, cost: 20, kind: 'buff', dur: 16000, buff: { dmg: 3 } }),
      S({ id: 'rain', name: 'Chuva de Flechas', desc: 'Cone de flechas (x1,5).', icon: '🌧️', unlock: 5, cd: 11000, cost: 26, kind: 'cone', mult: 1.5, radius: 95, color: 0xd9c08a }),
    ],
  },
  {
    id: 'rogue', name: 'Ladino', role: 'Dano explosivo', hit: 8, primary: 'dex',
    desc: 'Mestre das sombras e dos golpes certeiros.',
    priority: ['dex', 'con', 'cha', 'int', 'wis', 'str'], style: 'melee', range: 22, speedMod: 0.8, armor: 'light',
    startWeapon: 'Adaga', atkColor: 0xffffff,
    art: { body: '#3b3b4f', dark: '#22222f', hat: 'hood', weapon: 'dagger', accent: '#8a8aa8' },
    skills: [
      S({ id: 'sneak', name: 'Ataque Furtivo', desc: 'Golpe mortal (dano x2,5).', icon: '🗡️', unlock: 1, cd: 5500, cost: 18, kind: 'strike', mult: 2.5, range: 28 }),
      S({ id: 'cunning', name: 'Ação Astuta', desc: 'Corrida rápida que fere de raspão.', icon: '💨', unlock: 3, cd: 8000, cost: 16, kind: 'dash', mult: 1.2, range: 28 }),
      S({ id: 'evasion', name: 'Esquiva Prodigiosa', desc: '+4 CA e +15% velocidade por 8s.', icon: '🌫️', unlock: 5, cd: 22000, cost: 22, kind: 'buff', dur: 8000, buff: { ac: 4, speed: 0.15 } }),
    ],
  },
  {
    id: 'sorcerer', name: 'Feiticeiro', role: 'Dano mágico explosivo', hit: 6, primary: 'cha',
    desc: 'Magia inata no sangue: poder bruto e imprevisível.',
    priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'], style: 'magic', range: 115, speedMod: 1, armor: 'cloth',
    startWeapon: 'Varinha de Carvalho', atkColor: 0xff7a1a,
    art: { body: '#b0302f', dark: '#701c1c', hat: 'none', weapon: 'wand', accent: '#ff7a1a' },
    skills: [
      S({ id: 'firebolt', name: 'Raio de Fogo', desc: 'Projétil flamejante (dano x2).', icon: '🔥', unlock: 1, cd: 4500, cost: 16, kind: 'bolt', mult: 2, range: 140, color: 0xff7a1a }),
      S({ id: 'hands', name: 'Mãos Flamejantes', desc: 'Cone de fogo (x1,7).', icon: '🖐️', unlock: 3, cd: 8000, cost: 22, kind: 'cone', mult: 1.7, radius: 80, color: 0xff7a1a }),
      S({ id: 'shield', name: 'Escudo Arcano', desc: '+4 CA por 10s.', icon: '🔮', unlock: 5, cd: 20000, cost: 20, kind: 'buff', dur: 10000, buff: { ac: 4 } }),
    ],
  },
  {
    id: 'warlock', name: 'Bruxo', role: 'Dano mágico sustentado', hit: 8, primary: 'cha',
    desc: 'Pactuou com uma entidade misteriosa em troca de poder.',
    priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'], style: 'magic', range: 120, speedMod: 1, armor: 'light',
    startWeapon: 'Varinha de Carvalho', atkColor: 0xb06aff,
    art: { body: '#4a2c82', dark: '#2c1850', hat: 'hood', weapon: 'wand', accent: '#b06aff' },
    skills: [
      S({ id: 'eldritch', name: 'Rajada Agonizante', desc: 'Raio sombrio (dano x1,9).', icon: '👁️', unlock: 1, cd: 4500, cost: 16, kind: 'bolt', mult: 1.9, range: 140, color: 0xb06aff }),
      S({ id: 'hadar', name: 'Braços de Hadar', desc: 'Tentáculos ferem e retardam em volta.', icon: '🐙', unlock: 3, cd: 10000, cost: 24, kind: 'nova', mult: 1.3, radius: 65, slow: true, color: 0xb06aff }),
      S({ id: 'pact', name: 'Pacto das Trevas', desc: 'Drena energia sombria para se curar.', icon: '🩸', unlock: 5, cd: 14000, cost: 24, kind: 'heal', mult: 1.3 }),
    ],
  },
  {
    id: 'wizard', name: 'Mago', role: 'Dano mágico em área', hit: 6, primary: 'int',
    desc: 'Estudioso das artes arcanas. Frágil, porém devastador.',
    priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'], style: 'magic', range: 120, speedMod: 1, armor: 'cloth',
    startWeapon: 'Cajado Simples', atkColor: 0x6ab0ff,
    art: { body: '#2c4a9a', dark: '#1a2c64', hat: 'wizard', weapon: 'staff', accent: '#6ab0ff' },
    skills: [
      S({ id: 'missiles', name: 'Mísseis Mágicos', desc: 'Três mísseis certeiros (x0,8 cada).', icon: '💠', unlock: 1, cd: 4500, cost: 16, kind: 'bolt', mult: 0.8, hits: 3, range: 150, color: 0x6ab0ff }),
      S({ id: 'fireball', name: 'Bola de Fogo', desc: 'Explosão ao redor (dano x2,2).', icon: '☄️', unlock: 3, cd: 9000, cost: 28, kind: 'nova', mult: 2.2, radius: 85, color: 0xff7a1a }),
      S({ id: 'arcshield', name: 'Escudo Arcano', desc: '+5 CA por 9s.', icon: '🔮', unlock: 5, cd: 22000, cost: 22, kind: 'buff', dur: 9000, buff: { ac: 5 } }),
    ],
  },
  {
    id: 'necromancer', name: 'Necromante', role: 'Dano sombrio / invocador', hit: 6, primary: 'int',
    desc: 'Estudioso da escola de Necromancia: drena a vida dos inimigos e levanta mortos-vivos para lutar a seu lado.',
    priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'], style: 'magic', range: 120, speedMod: 1, armor: 'cloth',
    startWeapon: 'Cetro de Osso', atkColor: 0x6aff9a,
    art: { body: '#1f3d30', dark: '#10241b', hat: 'hood', weapon: 'wand', accent: '#6aff9a' },
    skills: [
      S({ id: 'vampiric', name: 'Toque Vampírico', desc: 'Drena a vida do alvo (x1,7) e cura você pela metade do dano.', icon: '🩸', unlock: 1, cd: 4500, cost: 16, kind: 'drain', mult: 1.7, range: 140, color: 0x6aff9a }),
      S({ id: 'animate', name: 'Reanimar Mortos', desc: 'Levanta um esqueleto aliado por 24s.', icon: '💀', unlock: 3, cd: 28000, cost: 30, kind: 'summon', dur: 24000, mult: 1, color: 0x6aff9a }),
      S({ id: 'deathcircle', name: 'Círculo da Morte', desc: 'Onda de energia negativa ao redor (dano x2,4).', icon: '☠️', unlock: 5, cd: 12000, cost: 30, kind: 'nova', mult: 2.4, radius: 90, color: 0x4aff7a }),
    ],
  },
  {
    id: 'eldknight', name: 'Cavaleiro Arcano', role: 'Guerreiro com magia', hit: 10, primary: 'str',
    desc: 'Guerreiro que mistura aço e feitiços: golpes carregados de energia arcana.',
    priority: ['str', 'int', 'con', 'dex', 'wis', 'cha'], style: 'melee', range: 24, speedMod: 1, armor: 'heavy',
    startWeapon: 'Espada Longa', atkColor: 0x6ab0ff,
    art: { body: '#34498f', dark: '#1e2c5c', hat: 'helm', weapon: 'sword', accent: '#6ab0ff', shield: true },
    skills: [
      S({ id: 'booming', name: 'Lâmina Trovejante', desc: 'Golpe carregado de trovão (dano x2,1).', icon: '⚡', unlock: 1, cd: 4500, cost: 16, kind: 'strike', mult: 2.1, range: 30 }),
      S({ id: 'arcward', name: 'Escudo Arcano', desc: '+4 CA por 10s.', icon: '🔮', unlock: 3, cd: 18000, cost: 20, kind: 'buff', dur: 10000, buff: { ac: 4 } }),
      S({ id: 'misty', name: 'Passo Nebuloso', desc: 'Teletransporte curto que fere quem estiver perto.', icon: '🌫️', unlock: 5, cd: 9000, cost: 18, kind: 'dash', mult: 1.4, range: 30 }),
    ],
  },
  {
    id: 'bladesinger', name: 'Dançarino das Lâminas', role: 'Dano rápido / mágico', hit: 8, primary: 'dex',
    desc: 'Duelista élfico que dança entre golpes e feitiços, de armadura leve e passo ágil.',
    priority: ['dex', 'int', 'con', 'wis', 'cha', 'str'], style: 'melee', range: 24, speedMod: 0.8, armor: 'cloth',
    startWeapon: 'Rapieira', atkColor: 0xc78bff,
    art: { body: '#6a3aa0', dark: '#40226a', hat: 'circlet', weapon: 'dagger', accent: '#c78bff' },
    skills: [
      S({ id: 'arcslash', name: 'Talho Arcano', desc: 'Dois cortes imbuídos de magia (x1,0 cada).', icon: '🗡️', unlock: 1, cd: 4500, cost: 15, kind: 'strike', mult: 1, hits: 2, range: 28 }),
      S({ id: 'bladesong', name: 'Canção da Lâmina', desc: '+3 CA, +15% vel. de ataque e +15% velocidade por 12s.', icon: '🎶', unlock: 3, cd: 24000, cost: 22, kind: 'buff', dur: 12000, buff: { ac: 3, atkSpeed: 0.15, speed: 0.15 } }),
      S({ id: 'bladestorm', name: 'Tempestade de Lâminas', desc: 'Giro devastador ao redor (dano x1,9).', icon: '🌪️', unlock: 5, cd: 10000, cost: 24, kind: 'nova', mult: 1.9, radius: 55, color: 0xc78bff }),
    ],
  },
  {
    id: 'illusionist', name: 'Ilusionista', role: 'Controle / dano mágico', hit: 6, primary: 'int',
    desc: 'Mestre da escola de Ilusão: engana os sentidos, confunde inimigos e cria cópias de si mesmo.',
    priority: ['int', 'dex', 'con', 'cha', 'wis', 'str'], style: 'magic', range: 120, speedMod: 1, armor: 'cloth',
    startWeapon: 'Varinha de Carvalho', atkColor: 0xff7ae0,
    art: { body: '#8a2f86', dark: '#561a54', hat: 'wizard', weapon: 'wand', accent: '#ff7ae0' },
    skills: [
      S({ id: 'prismatic', name: 'Raio Prismático', desc: 'Raio de sete cores (dano x2).', icon: '🌈', unlock: 1, cd: 4500, cost: 16, kind: 'bolt', mult: 2, range: 140, color: 0xff7ae0 }),
      S({ id: 'mirror', name: 'Imagem Espelhada', desc: 'Cópias ilusórias: +5 CA por 10s.', icon: '🪞', unlock: 3, cd: 22000, cost: 22, kind: 'buff', dur: 10000, buff: { ac: 5 } }),
      S({ id: 'phantasm', name: 'Terror Fantasmagórico', desc: 'Pesadelo em área: dano x1,5 e atordoa por 1,5s.', icon: '👻', unlock: 5, cd: 13000, cost: 28, kind: 'nova', mult: 1.5, radius: 80, stun: 1500, color: 0xff7ae0 }),
    ],
  },
];

export const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
export const BASE_DICE: Record<Style, Dice> = { melee: [1, 6], ranged: [1, 6], magic: [1, 6] };
