// Mecânicas de chefe: habilidades com tempo de conjuração e áreas telegrafadas (desviáveis), fases e invocações.
export type AbilityKind = 'circle' | 'meteor' | 'cone' | 'line' | 'charge' | 'donut' | 'volley' | 'summon';

export interface BossAbility {
  id: string;
  name: string;
  kind: AbilityKind;
  cast: number;                    // ms de conjuração (barra de cast)
  cd: number;                      // recarga (ms)
  dmg: [number, number, number];   // [dados, faces, bônus]
  r?: number;                      // raio / alcance (px)
  inner?: number;                  // raio seguro interno (donut)
  half?: number;                   // meio-ângulo do cone (rad)
  len?: number;                    // comprimento (linha/investida)
  w?: number;                      // largura (linha/investida)
  n?: number;                      // quantidade (meteoros, círculos, invocações)
  add?: string;                    // monstro invocado
  phase?: number;                  // fase mínima (0 = desde o início)
}

export interface BossDef {
  abilities: BossAbility[];
  lines: [string, string];         // falas ao entrar nas fases 2 e 3
}

const C = (id: string, name: string, cast: number, cd: number, dmg: [number, number, number], r: number, phase = 0): BossAbility => ({ id, name, kind: 'circle', cast, cd, dmg, r, phase });

export const BOSSES: Record<string, BossDef> = {
  ratking: {
    lines: ['Dentes-de-Ferro guincha e chama seu bando!', 'Dentes-de-Ferro enlouquece de fúria!'],
    abilities: [
      { id: 'bite', name: 'Mordida Selvagem', kind: 'cone', cast: 1100, cd: 5000, dmg: [2, 6, 2], r: 80, half: 0.65 },
      { id: 'rush', name: 'Investida de Roedor', kind: 'charge', cast: 1200, cd: 9000, dmg: [2, 6, 3], len: 220, w: 30, phase: 1 },
      { id: 'squeal', name: 'Guincho do Bando', kind: 'summon', cast: 1500, cd: 20000, dmg: [0, 0, 0], n: 3, add: 'rat', phase: 1 },
      C('slam', 'Pisão Imundo', 1300, 8000, [2, 6, 2], 62, 2),
    ],
  },
  goblinking: {
    lines: ['Snaggle ri e assobia: "Matem ele!"', 'Snaggle arranca a coroa e ataca enlouquecido!'],
    abilities: [
      { id: 'slice', name: 'Corte Duplo', kind: 'cone', cast: 1000, cd: 5000, dmg: [2, 8, 3], r: 90, half: 0.7 },
      { id: 'knives', name: 'Chuva de Facas', kind: 'volley', cast: 3000, cd: 11000, dmg: [2, 6, 3], r: 28, n: 6 },
      { id: 'band', name: 'Convocar Bando', kind: 'summon', cast: 1600, cd: 22000, dmg: [0, 0, 0], n: 3, add: 'goblin', phase: 1 },
      { id: 'dash', name: 'Facada Relâmpago', kind: 'charge', cast: 1100, cd: 9000, dmg: [2, 8, 4], len: 240, w: 30, phase: 2 },
    ],
  },
  skelknight: {
    lines: ['Sir Aldric ergue a espada: "Eu... lembro do Selo..."', 'Sir Aldric: "Ele conhece o seu nome!"'],
    abilities: [
      { id: 'sepul', name: 'Golpe Sepulcral', kind: 'cone', cast: 1500, cd: 6000, dmg: [3, 8, 4], r: 110, half: 0.6 },
      C('stomp', 'Pisão Fúnebre', 1400, 8000, [3, 6, 4], 80),
      { id: 'call', name: 'Chamado dos Mortos', kind: 'summon', cast: 1700, cd: 24000, dmg: [0, 0, 0], n: 3, add: 'skeleton', phase: 1 },
      { id: 'souls', name: 'Almas Penadas', kind: 'volley', cast: 3200, cd: 12000, dmg: [2, 8, 4], r: 30, n: 7, phase: 2 },
    ],
  },
  warlord: {
    lines: ['Grukthar ruge: "VOCÊ NÃO PASSA!"', 'Grukthar entra em frenesi de guerra!'],
    abilities: [
      C('spin', 'Machadada Giratória', 1400, 7000, [3, 8, 5], 88),
      { id: 'charge', name: 'Investida Brutal', kind: 'charge', cast: 1300, cd: 9000, dmg: [3, 8, 5], len: 280, w: 36 },
      { id: 'axes', name: 'Chuva de Machados', kind: 'volley', cast: 3000, cd: 12000, dmg: [2, 8, 5], r: 30, n: 6, phase: 1 },
      { id: 'horde', name: 'Convocar a Horda', kind: 'summon', cast: 1700, cd: 24000, dmg: [0, 0, 0], n: 3, add: 'orc', phase: 1 },
      { id: 'cleave', name: 'Golpe Devastador', kind: 'cone', cast: 1500, cd: 6000, dmg: [4, 8, 5], r: 120, half: 0.55, phase: 2 },
    ],
  },
  herald: {
    lines: ['Vessk sussurra: "Ele já ouviu seus passos..."', 'Vessk: "Deixe a cinza tomar conta de tudo!"'],
    abilities: [
      { id: 'meteor', name: 'Meteoro Cinzento', kind: 'meteor', cast: 1800, cd: 7000, dmg: [4, 8, 6], r: 52, n: 1 },
      { id: 'ash', name: 'Anel de Cinza', kind: 'donut', cast: 2200, cd: 11000, dmg: [4, 6, 6], r: 190, inner: 56 },
      { id: 'ray', name: 'Raio Cinzento', kind: 'line', cast: 1500, cd: 8000, dmg: [4, 8, 5], len: 300, w: 40 },
      { id: 'servants', name: 'Conjurar Servos', kind: 'summon', cast: 1800, cd: 26000, dmg: [0, 0, 0], n: 3, add: 'cultist', phase: 1 },
      { id: 'prison', name: 'Prisão de Sombras', kind: 'volley', cast: 3600, cd: 13000, dmg: [2, 8, 6], r: 32, n: 8, phase: 1 },
      { id: 'storm', name: 'Tempestade de Meteoros', kind: 'meteor', cast: 2200, cd: 16000, dmg: [4, 8, 6], r: 46, n: 3, phase: 2 },
    ],
  },
  gnarlmaw: {
    lines: ['Gnarlmaw urra e o chão treme!', 'Gnarlmaw bate no peito, enfurecido!'],
    abilities: [
      C('slam', 'Pisão do Ancião', 1500, 7000, [3, 8, 4], 105),
      { id: 'club', name: 'Clavada', kind: 'cone', cast: 1300, cd: 6000, dmg: [3, 8, 4], r: 110, half: 0.6 },
      { id: 'charge', name: 'Investida do Ogro', kind: 'charge', cast: 1300, cd: 10000, dmg: [3, 8, 5], len: 280, w: 40, phase: 1 },
      { id: 'brood', name: 'Chamar a Ninhada', kind: 'summon', cast: 1700, cd: 26000, dmg: [0, 0, 0], n: 2, add: 'bugbear', phase: 1 },
      { id: 'quake', name: 'Tremor', kind: 'donut', cast: 2000, cd: 12000, dmg: [4, 6, 5], r: 200, inner: 54, phase: 2 },
    ],
  },
};
