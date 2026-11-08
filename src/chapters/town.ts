// Pouso do Viajante: edifícios com interior. Coordenadas em tiles relativas ao centro da vila.
import { CX, CY } from './mapdims';
export type BuildingKind = 'tavern' | 'forge' | 'church' | 'shop' | 'barracks' | 'tower';
export interface BuildingNpc { id: string; name: string }
export interface BuildingDef {
  id: string; name: string; kind: BuildingKind;
  x0: number; y0: number; w: number; h: number;   // pegada no mapa
  facing: 'S' | 'N' | 'E' | 'W';                   // lado da porta (w,h = pegada no mapa)
  npcs: BuildingNpc[];
  /** vila a que pertence ('pouso' = cidade principal) */
  town?: string;
}

export const BUILDINGS: BuildingDef[] = [
  // igreja no centro, porta voltada para a praça (sul)
  { id: 'igreja', name: 'Catedral da Aurora', kind: 'church', x0: CX - 4, y0: CY - 12, w: 8, h: 9, facing: 'S', npcs: [{ id: 'priest', name: 'Padre Anselmo' }, { id: 'healer', name: 'Irmã Elowen' }] },
  // demais edifícios espalhados pelo anel, voltados para o centro
  { id: 'forja', name: 'Forja do Martelo Rubro', kind: 'forge', x0: CX - 12, y0: CY - 22, w: 5, h: 7, facing: 'S', npcs: [{ id: 'smith', name: 'Ferreira Durga' }] },
  { id: 'torre', name: 'Torre do Sábio', kind: 'tower', x0: CX + 6, y0: CY - 22, w: 6, h: 7, facing: 'S', npcs: [{ id: 'sage', name: 'Sábio Orin' }] },
  { id: 'taverna', name: 'Taverna do Dragão Dourado', kind: 'tavern', x0: CX - 23, y0: CY - 10, w: 7, h: 7, facing: 'E', npcs: [{ id: 'innkeeper', name: 'Taverneiro Bram' }] },
  { id: 'quartel', name: 'Quartel da Guarda', kind: 'barracks', x0: CX + 17, y0: CY - 9, w: 7, h: 5, facing: 'W', npcs: [{ id: 'captain', name: 'Capitão Brann' }] },
  { id: 'emporio', name: 'Empório da Sildra', kind: 'shop', x0: CX - 23, y0: CY + 4, w: 7, h: 7, facing: 'E', npcs: [{ id: 'merchant', name: 'Mercadora Sildra' }] },
  ];
// ---------------------------------------------------------------- vilas dos biomas
export interface VillageDef { id: string; zone: string; name: string; biome: string; cx: number; cy: number; r: number }
export const VILLAGE_R = 17;
export const VILLAGES: VillageDef[] = [
  { id: 'clareira', zone: 'v_floresta', name: 'Passo da Clareira', biome: 'forest', cx: 75, cy: CY, r: VILLAGE_R },
  { id: 'sinos', zone: 'v_cripta', name: 'Vigília dos Sinos', biome: 'crypt', cx: CX, cy: 78, r: VILLAGE_R },
  { id: 'cinzaferro', zone: 'v_orcs', name: 'Forte Cinzaferro', biome: 'orcs', cx: 468, cy: CY, r: VILLAGE_R },
  { id: 'refugio', zone: 'v_ogro', name: 'Último Refúgio', biome: 'ogre', cx: CX, cy: 357, r: VILLAGE_R },
  { id: 'palafitas', zone: 'v_pantano', name: 'Palafitas do Brejo', biome: 'swamp', cx: 110, cy: 68, r: VILLAGE_R },
  { id: 'oasis', zone: 'v_deserto', name: 'Oásis do Escaravelho', biome: 'desert', cx: 500, cy: 382, r: VILLAGE_R },
];
type VB = [string, string, BuildingKind, string, string];   // id, nome, tipo, id do NPC, nome do NPC
const QUAD: { x0: number; y0: number; facing: 'S' | 'N' }[] = [
  { x0: -11, y0: -10, facing: 'S' }, { x0: 5, y0: -10, facing: 'S' }, { x0: -11, y0: 5, facing: 'N' }, { x0: 5, y0: 5, facing: 'N' },
];
const VILLAGE_BUILDINGS: Record<string, VB[]> = {
  clareira: [
    ['clareira-taverna', 'Hospedaria do Corvo Verde', 'tavern', 'innkeeper', 'Taverneira Maelis'],
    ['clareira-forja', 'Forja do Lenhador', 'forge', 'smith', 'Ferreiro Brenn'],
    ['clareira-torre', 'Torre da Clareira', 'tower', 'sage', 'Sábio Faelan'],
    ['clareira-armazem', 'Armazém do Lenhador', 'shop', 'merchant', 'Mercador Torben'],
  ],
  sinos: [
    ['sinos-taverna', 'Taverna do Último Suspiro', 'tavern', 'innkeeper', 'Taverneiro Osric'],
    ['sinos-capela', 'Capela da Luz Perdida', 'church', 'priest', 'Padre Calanthe'],
    ['sinos-torre', 'Torre do Coveiro', 'tower', 'sage', 'Sábio Vael'],
    ['sinos-posto', 'Posto dos Caça-Mortos', 'barracks', 'captain', 'Sentinela Marwen'],
  ],
  cinzaferro: [
    ['cinza-taverna', 'Taverna do Machado Partido', 'tavern', 'innkeeper', 'Taverneira Hilde'],
    ['cinza-forja', 'Forja Cinzaferro', 'forge', 'smith', 'Ferreiro Dagan'],
    ['cinza-emporio', 'Empório do Forte', 'shop', 'merchant', 'Mercador Thrukk'],
    ['cinza-quartel', 'Quartel de Cinzaferro', 'barracks', 'captain', 'Capitã Ruvia'],
  ],
  refugio: [
    ['refugio-taverna', 'Abrigo do Último Fôlego', 'tavern', 'innkeeper', 'Taverneiro Gorm'],
    ['refugio-torre', 'Torre do Vigia', 'tower', 'sage', 'Sábia Ysolde'],
    ['refugio-capela', 'Capela do Último Refúgio', 'church', 'priest', 'Padre Lucan'],
    ['refugio-emporio', 'Empório do Refúgio', 'shop', 'merchant', 'Mercadora Brisa'],
  ],
  palafitas: [
    ['palafitas-taverna', 'Taverna do Sapo Dourado', 'tavern', 'innkeeper', 'Taverneiro Mordo'],
    ['palafitas-torre', 'Torre da Herbalista', 'tower', 'sage', 'Sábia Morwenna'],
    ['palafitas-capela', 'Capela da Maré Sagrada', 'church', 'priest', 'Padre Ilmar'],
    ['palafitas-emporio', 'Empório das Palafitas', 'shop', 'merchant', 'Mercadora Sula'],
  ],
  oasis: [
    ['oasis-estalagem', 'Estalagem do Oásis', 'tavern', 'innkeeper', 'Taverneiro Zahir'],
    ['oasis-forja', 'Forja do Sol Ardente', 'forge', 'smith', 'Ferreiro Khalid'],
    ['oasis-bazar', 'Bazar das Dunas', 'shop', 'merchant', 'Mercadora Samira'],
    ['oasis-posto', 'Posto dos Caravaneiros', 'barracks', 'captain', 'Capitão Idris'],
  ],
};
for (const v of VILLAGES) {
  VILLAGE_BUILDINGS[v.id].forEach(([id, name, kind, nid, nname], i) => {
    const q = QUAD[i];
    BUILDINGS.push({ id, name, kind, x0: v.cx + q.x0, y0: v.cy + q.y0, w: 6, h: 5, facing: q.facing, npcs: [{ id: nid, name: nname }, ...(kind === 'church' ? [{ id: 'healer', name: 'Irmã Elowen' }] : [])], town: v.id });
  });
}
export const townOf = (b: BuildingDef) => b.town ?? 'pouso';
export const villageAt = (tx: number, ty: number) => VILLAGES.find((v) => (tx - v.cx) ** 2 + (ty - v.cy) ** 2 <= v.r * v.r);

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, BuildingDef>;

/** tile da porta (na rua, em frente à entrada) */
export const doorTile = (b: BuildingDef) => {
  if (b.facing === 'S') return { tx: b.x0 + Math.floor(b.w / 2), ty: b.y0 + b.h };
  if (b.facing === 'N') return { tx: b.x0 + Math.floor(b.w / 2), ty: b.y0 - 1 };
  if (b.facing === 'E') return { tx: b.x0 + b.w, ty: b.y0 + Math.floor(b.h / 2) };
  return { tx: b.x0 - 1, ty: b.y0 + Math.floor(b.h / 2) };
};
/** deslocamento (tiles) da saída do edifício para a rua */
export const FACE_VEC = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] } as const;
