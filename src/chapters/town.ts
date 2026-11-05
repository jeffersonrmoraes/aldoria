// Pouso do Viajante: edifícios com interior. Coordenadas em tiles relativas ao centro da vila.
import { CX, CY } from './mapdims';
export type BuildingKind = 'tavern' | 'forge' | 'church' | 'shop' | 'barracks' | 'tower' | 'archery' | 'monk' | 'rogue' | 'cleric' | 'druid' | 'bard' | 'necro' | 'barbarian';
export interface BuildingNpc { id: string; name: string }
export interface BuildingDef {
  id: string; name: string; kind: BuildingKind;
  x0: number; y0: number; w: number; h: number;   // pegada no mapa
  facing: 'S' | 'N' | 'E' | 'W';                   // lado da porta (w,h = pegada no mapa)
  npcs: BuildingNpc[];
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
  { id: 'arqueiro', name: 'Arco do Falcão', kind: 'archery', x0: CX + 17, y0: CY + 3, w: 7, h: 5, facing: 'W', npcs: [{ id: 'archer', name: 'Arqueira Lyra Folhaverde' }] },
  { id: 'monge', name: 'Mosteiro do Punho Sereno', kind: 'monk', x0: CX + 6, y0: CY + 17, w: 6, h: 5, facing: 'N', npcs: [{ id: 'monk', name: 'Mestre Kaelen' }] },
  { id: 'ladino', name: 'Adaga Silenciosa', kind: 'rogue', x0: CX - 12, y0: CY + 17, w: 6, h: 5, facing: 'N', npcs: [{ id: 'rogue', name: 'Nyx Mãos-Leves' }] },
  // anel externo (cidade ampliada)
  { id: 'ordem', name: 'Ordem do Sol Nascente', kind: 'cleric', x0: CX - 20, y0: CY - 27, w: 6, h: 6, facing: 'S', npcs: [{ id: 'cleric', name: 'Irmão Tomás Luzdourada' }] },
  { id: 'circulo', name: 'Círculo do Carvalho', kind: 'druid', x0: CX + 14, y0: CY - 27, w: 6, h: 6, facing: 'S', npcs: [{ id: 'druid', name: 'Druida Ilvandra' }] },
  { id: 'salao', name: 'Salão da Canção', kind: 'bard', x0: CX + 26, y0: CY - 13, w: 5, h: 6, facing: 'W', npcs: [{ id: 'bard', name: 'Menestrel Fenwick' }] },
  { id: 'cripta', name: 'Cripta Sombria', kind: 'necro', x0: CX - 31, y0: CY + 8, w: 5, h: 6, facing: 'E', npcs: [{ id: 'necro', name: 'Mortícia, a Coveira' }] },
  { id: 'machado', name: 'Salão do Machado Vermelho', kind: 'barbarian', x0: CX + 14, y0: CY + 23, w: 6, h: 5, facing: 'N', npcs: [{ id: 'barbarian', name: 'Grogna Punho-de-Pedra' }] },
];
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
