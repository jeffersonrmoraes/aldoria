// CAPÍTULO 1 — HISTÓRIA, MASMORRAS E MISSÕES PRINCIPAIS
// O vilão (o Rei Cinzento) NÃO aparece neste capítulo: o jogador só encontra marcas, ecos e seus servos.

import type { Quest } from './chapter1';

export interface Fragment { id: string; name: string; lore: string }

export interface DungeonDef {
  id: string;
  name: string;
  levels: string;
  minLevel: number;
  zone: string;                 // zona do mundo onde fica a entrada
  entrance: { tx: number; ty: number };
  needs?: number;               // fragmentos exigidos para entrar
  seed: number;
  rooms: number;
  perRoom: [number, number];
  mobs: [string, number][];
  boss: string;
  theme: { floor: string; wall: string; sky: string; fog: string; light: string; ambient: number; portal: string };
  intro: string;
}

export const FRAGMENTS: Fragment[] = [
  { id: 'f1', name: 'Fragmento de Ferro', lore: 'Um caco de metal frio, gravado com uma mão aberta de dedos longos demais: a Marca Cinzenta. Os ratos do moinho a carregavam no pelo, como se alguém os tivesse "assinado".' },
  { id: 'f2', name: 'Fragmento de Osso', lore: 'Osso polido com runas da Ordem da Aurora. Snaggle usava-o como coroa. Um mensageiro encapuzado lhe prometera "um reino de ouro" em troca de guardá-lo... e de não perguntar quem mandava.' },
  { id: 'f3', name: 'Fragmento de Sepulcro', lore: 'Sir Aldric foi um dos Cinco Heróis que selaram a Sombra. Em suas últimas palavras: "Ele conhece cada um de nós pelo nome. Não deixe que diga o seu."' },
  { id: 'f4', name: 'Fragmento de Sangue', lore: 'Ainda quente ao toque. Grukthar não saqueava por glória: obedecia a cultistas de manto cinza que marcaram a fortaleza com o mesmo símbolo — e desenharam um mapa até uma câmara ao sul.' },
  { id: 'f5', name: 'Fragmento de Cinza', lore: 'O último pedaço do Selo de Aldoria. Dentro dele, algo sussurra em uma língua que ninguém ensinou ao Arauto. O fragmento parece... decepcionado.' },
];
export const FRAGMENT_BY_ID: Record<string, Fragment> = Object.fromEntries(FRAGMENTS.map((f) => [f.id, f]));

const dark = { portal: '#8a5cff' };
export const DUNGEONS: DungeonDef[] = [
  {
    id: 'moinho', name: 'Catacumbas do Moinho Velho', levels: 'Nível 2–3', minLevel: 2, zone: 'fields', entrance: { tx: 251, ty: 212 },
    seed: 11, rooms: 4, perRoom: [3, 4], mobs: [['rat', 60], ['slime', 25], ['kobold', 15]], boss: 'ratking',
    theme: { floor: '#6b6258', wall: '#4b443c', sky: '#1a1612', fog: '#241d17', light: '#ffb86a', ambient: 0.6, ...dark },
    intro: 'Sob o moinho abandonado, túneis úmidos ecoam com guinchos. Algo comanda os ratos.',
  },
  {
    id: 'goblin', name: 'Toca do Rei Goblin', levels: 'Nível 4–5', minLevel: 4, zone: 'forest', entrance: { tx: 69, ty: 127 },
    seed: 23, rooms: 5, perRoom: [3, 5], mobs: [['goblin', 55], ['wolf', 30], ['kobold', 15]], boss: 'goblinking',
    theme: { floor: '#5a5a3c', wall: '#3a3a26', sky: '#10160e', fog: '#1a2314', light: '#ffd070', ambient: 0.55, ...dark },
    intro: 'Cavernas cobertas de musgo, fogueiras e ossos. Um trono de sucata aguarda no fundo.',
  },
  {
    id: 'cripta', name: 'Cripta dos Condenados', levels: 'Nível 6–7', minLevel: 6, zone: 'crypt', entrance: { tx: 229, ty: 42 },
    seed: 37, rooms: 5, perRoom: [3, 5], mobs: [['skeleton', 50], ['zombie', 30], ['cultist', 20]], boss: 'skelknight',
    theme: { floor: '#4d4f66', wall: '#33354a', sky: '#0d0e1a', fog: '#15162a', light: '#9fb4ff', ambient: 0.55, ...dark },
    intro: 'Jazigos violados e brasões da Ordem da Aurora. Um cavaleiro ergue-se onde deveria repousar.',
  },
  {
    id: 'fortaleza', name: 'Fortaleza Quebra-Osso', levels: 'Nível 8–9', minLevel: 8, zone: 'orcs', entrance: { tx: 343, ty: 142 },
    seed: 41, rooms: 6, perRoom: [3, 5], mobs: [['orc', 55], ['bugbear', 30], ['cultist', 15]], boss: 'warlord',
    theme: { floor: '#6a4a3c', wall: '#442d26', sky: '#1a0f0c', fog: '#2a1812', light: '#ff9a5a', ambient: 0.6, ...dark },
    intro: 'Muralhas de ossos e estandartes rasgados. Tambores de guerra batem sob a pedra.',
  },
  {
    id: 'camara', name: 'Câmara do Selo Partido', levels: 'Nível 10', minLevel: 9, zone: 'ogre', entrance: { tx: 271, ty: 269 }, needs: 4,
    seed: 53, rooms: 6, perRoom: [4, 5], mobs: [['cultist', 45], ['skeleton', 30], ['zombie', 25]], boss: 'herald',
    theme: { floor: '#3e3a52', wall: '#27243a', sky: '#08060f', fog: '#100c1c', light: '#b08cff', ambient: 0.5, portal: '#ff5a8a' },
    intro: 'Aqui o Selo foi forjado. As paredes sangram cinza e uma mão aberta brilha no chão.',
  },
];
export const DUNGEON_BY_ID: Record<string, DungeonDef> = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

export interface MainQuest extends Quest { main: true; giver: 'sage'; requires?: string; story: string; outro: string }

export const MAIN_QUESTS: MainQuest[] = [
  {
    id: 'm1', main: true, giver: 'sage', title: 'O Murmúrio sob o Moinho', mob: 'ratking', count: 1, minLevel: 2, xp: 220, gold: 80, potion: 'heal',
    desc: 'Desça às Catacumbas do Moinho Velho e derrote Dentes-de-Ferro, o Rei dos Ratos. Traga o fragmento que ele guarda.',
    story: 'Orin desenrola um pergaminho amarelado: "Há séculos, cinco heróis da Ordem da Aurora selaram uma Sombra sob Aldoria. O Selo se partiu em cinco fragmentos, escondidos em cinco covis. Agora o Selo racha, as bestas enlouquecem e fazendeiros ouvem sussurros no moinho. Recupere o primeiro fragmento."',
    outro: 'Orin gira o Fragmento de Ferro e empalidece. "A Marca Cinzenta... a mão aberta. Quem a desenhou queria que os ratos fossem vistos. Isto é um aviso, ou um convite." Ele não diz mais nada.',
  },
  {
    id: 'm2', main: true, giver: 'sage', requires: 'm1', title: 'A Coroa de Osso', mob: 'goblinking', count: 1, minLevel: 4, xp: 420, gold: 140, potion: 'energy',
    desc: 'Na Floresta Sombria, o Rei Goblin Snaggle usa algo da Ordem como coroa. Entre na Toca do Rei Goblin e tome o fragmento.',
    story: '"Goblins que nunca saíram da floresta agora marcham em formação", diz Orin. "Alguém os organiza. Snaggle guarda o segundo fragmento. Cuidado: ele não é tão tolo quanto parece."',
    outro: '"Um mensageiro encapuzado prometeu um reino a Snaggle", Orin lê nas runas. "Ele nunca viu o rosto. Só ouviu uma voz que cheirava a cinzas." Orin guarda o fragmento em silêncio.',
  },
  {
    id: 'm3', main: true, giver: 'sage', requires: 'm2', title: 'O Cavaleiro Esquecido', mob: 'skelknight', count: 1, minLevel: 6, xp: 700, gold: 220, item: true,
    desc: 'Na Cripta dos Condenados jaz Sir Aldric, um dos Cinco Heróis, agora erguido pela Marca. Liberte-o e recupere o fragmento de Sepulcro.',
    story: '"Sir Aldric foi meu mestre", sussurra Orin. "Se a Marca o ergueu, a Sombra já alcança os mortos. Dê-lhe descanso, e traga o que ele guardava."',
    outro: 'Orin demora a falar. "Antes de cair, Aldric disse: \'Ele conhece cada um de nós pelo nome.\' Quem é ele? Os registros da Ordem foram arrancados... exatamente nas páginas sobre o prisioneiro."',
  },
  {
    id: 'm4', main: true, giver: 'sage', requires: 'm3', title: 'Guerra de Ossos', mob: 'warlord', count: 1, minLevel: 8, xp: 1000, gold: 320, item: true,
    desc: 'Grukthar Quebra-Osso unifica as tribos orcs na Fortaleza Quebra-Osso e guarda o quarto fragmento. Derrote-o.',
    story: '"Orcs não se unem por vontade própria", diz Orin. "Grukthar recebe ordens de cultistas de manto cinza. Corte a cabeça da guerra, e descubra para onde eles apontam."',
    outro: 'Entre os restos da fortaleza há um mapa até uma câmara ao sul, sob o Covil do Ogro. Orin sela o quarto fragmento. "Faltam o último e o lugar onde tudo começou. A Câmara do Selo Partido."',
  },
  {
    id: 'm5', main: true, giver: 'sage', requires: 'm4', title: 'A Câmara do Selo Partido', mob: 'herald', count: 1, minLevel: 9, xp: 2000, gold: 700, item: true,
    desc: 'Com quatro fragmentos, a porta da Câmara do Selo Partido se abre. Derrote Vessk, o Arauto Cinzento, e recupere o último fragmento.',
    story: '"A Câmara fica sob o Covil do Ogro. O Arauto de Cinza a ocupa. É um servo, não o mestre... mas fale pouco com ele. Ele sabe coisas que machucam." Orin lhe entrega a chave rúnica.',
    outro: '',
  },
];
export const ALL_MAIN = MAIN_QUESTS;

export const SAGE_INTRO = 'Sou Orin, guardião dos registros da Ordem da Aurora. Aldoria dorme sobre um segredo, aventureiro. Há algo selado sob estas terras, e o Selo está falhando.';

export const EPILOGUE = {
  title: 'Fim do Capítulo 1 — O Despertar',
  paras: [
    'Os cinco fragmentos brilham juntos nas mãos de Orin e o Selo de Aldoria se refaz, pulsando como um coração antigo.',
    'Vessk, caído, sorri entre os dentes: "Vocês selaram uma cela vazia. Ele nunca esteve preso aqui... ele só deixou que acreditassem nisso."',
    'Longe dali, além das montanhas, um trono de cinzas range. Uma mão aberta, de dedos longos demais, fecha-se devagar.',
    'O Rei Cinzento caminha. E agora sabe o seu nome.',
    'Capítulo 2 — "O Trono de Cinzas" — em breve.',
  ],
};
