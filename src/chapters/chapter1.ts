import { BUILDINGS, VILLAGES, doorTile, townOf } from './town';
import { F } from '../art/atlas';
import { DUNGEONS } from './story1';

// CAPÍTULO 1 — O DESPERTAR
// Cada capítulo futuro será um arquivo como este: mapa, zonas, monstros e quests.

export interface ZoneDef {
  id: string;
  name: string;
  levels: string;
  mobs: [string, number][]; // [id do monstro, peso]
  count: number;            // quantidade de pontos de spawn
  safe?: boolean;
  /** bioma do terreno (vilas) */
  biome?: string;
}

export interface Quest {
  id: string;
  title: string;
  desc: string;
  mob: string;
  count: number;
  minLevel: number;
  xp: number;
  gold: number;
  potion?: 'heal' | 'energy';
  item?: boolean;
  /** missão de achar objetos espalhados pelo mundo (zona 'any' = qualquer região perigosa) */
  find?: { name: string; icon: string; color: number; zone: string; hint: string };
}

export interface SpawnPoint { mob: string; x: number; y: number; boss?: boolean }
export interface NpcDef { id: string; name: string; x: number; y: number; path?: { x: number; y: number }[]; face?: number }

import { TILE, W, H, CX, CY, TOWN_R, FOUNTAIN } from './mapdims';
export { TILE, W, H, CX, CY };

// índices do tileset = frames do atlas gerado (ver tools/build_art.py)
export const T = { ...F, swamp: 100, swamp_tree: 101, dune: 102, dune2: 103, cactus: 104, sandrock: 105 };
export const BLOCKED: number[] = [
  F.water, F.tree, F.tree2, F.bush, F.ftree, F.ftree2, F.red_rock, F.red_tree,
  F.grave, F.grave2, 101, 104, 105, F.roof_l, F.roof, F.roof_r, F.wall_l, F.wall, F.wall_w, F.wall_r,
];

const GATE = 2; // portões: meia-largura em tiles
export const GATE_HALF = GATE;
export const ZONES: Record<string, ZoneDef> = {
  town: { id: 'town', name: 'Pouso do Viajante', levels: 'Zona segura', mobs: [], count: 0, safe: true },
  v_floresta: { id: 'v_floresta', name: 'Passo da Clareira', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'forest' },
  v_cripta: { id: 'v_cripta', name: 'Vigília dos Sinos', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'crypt' },
  v_orcs: { id: 'v_orcs', name: 'Forte Cinzaferro', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'orcs' },
  v_pantano: { id: 'v_pantano', name: 'Palafitas do Brejo', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'swamp' },
  v_deserto: { id: 'v_deserto', name: 'Oásis do Escaravelho', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'desert' },
  v_ogro: { id: 'v_ogro', name: 'Último Refúgio', levels: 'Zona segura', mobs: [], count: 0, safe: true, biome: 'ogre' },
  fields: { id: 'fields', name: 'Campos Verdes', levels: 'Nível 1–2', mobs: [['rat', 28], ['kobold', 25], ['slime', 17], ['jackal', 15], ['bandit', 15]], count: 405 },
  forest: { id: 'forest', name: 'Floresta Sombria', levels: 'Nível 3–4', mobs: [['goblin', 40], ['wolf', 30], ['worg', 15], ['hobgoblin', 15]], count: 350 },
  crypt: { id: 'crypt', name: 'Cripta Esquecida', levels: 'Nível 5–6', mobs: [['skeleton', 35], ['zombie', 25], ['ghoul', 20], ['shadow', 20]], count: 270 },
  orcs: { id: 'orcs', name: 'Colinas dos Orcs', levels: 'Nível 7–8', mobs: [['orc', 35], ['bugbear', 25], ['orcshaman', 15], ['gnoll', 25]], count: 270 },
  ogre: { id: 'ogre', name: 'Covil do Ogro', levels: 'Nível 9–10', mobs: [['ogre', 60], ['troll', 40]], count: 150 },
  swamp: { id: 'swamp', name: 'Pântano Abandonado', levels: 'Nível 11–13', mobs: [['lizardfolk', 28], ['giantfrog', 24], ['crocodile', 16], ['willowisp', 12], ['shambler', 12], ['greenhag', 8]], count: 200 },
  desert: { id: 'desert', name: 'Deserto de Anauroch', levels: 'Nível 14–16', mobs: [['scorpion', 28], ['vulture', 24], ['dustmephit', 18], ['mummy', 20], ['wight', 10]], count: 200 },
};

export function zoneAt(tx: number, ty: number): string {
  for (const v of VILLAGES) if ((tx - v.cx) ** 2 + (ty - v.cy) ** 2 <= v.r * v.r) return v.zone;
  if ((tx - CX) ** 2 + (ty - CY) ** 2 <= TOWN_R * TOWN_R) return 'town';
  const fx = tx / W, fy = ty / H;
  if (fx <= 0.3 && fy < 0.3) return 'swamp';
  if (fx >= 0.7 && fy >= 0.7) return 'desert';
  if (fy < 0.27 && fx > 0.3 && fx < 0.7) return 'crypt';
  if (fx >= 0.7) return 'orcs';
  if (fx <= 0.3) return 'forest';
  if (fy >= 0.744) return 'ogre';
  return 'fields';
}

export const QUESTS: Quest[] = [
  { id: 'q1', title: 'Pragas nos Campos', desc: 'Ratos gigantes invadem as plantações. Elimine 6 deles.', mob: 'rat', count: 6, minLevel: 1, xp: 60, gold: 25, potion: 'heal' },
  { id: 'q2', title: 'Kobolds Ladrões', desc: 'Kobolds roubam suprimentos da vila. Derrote 6.', mob: 'kobold', count: 6, minLevel: 1, xp: 80, gold: 35, potion: 'energy' },
  { id: 'q3', title: 'Ameaça na Floresta', desc: 'Goblins emboscam viajantes na Floresta Sombria. Elimine 8.', mob: 'goblin', count: 8, minLevel: 3, xp: 220, gold: 70, potion: 'heal' },
  { id: 'q4', title: 'Os Mortos Inquietos', desc: 'Esqueletos vagam pela Cripta Esquecida. Destrua 8.', mob: 'skeleton', count: 8, minLevel: 5, xp: 380, gold: 110, potion: 'heal' },
  { id: 'q5', title: 'Guerra nas Colinas', desc: 'Os orcs se reúnem a leste. Derrote 8 deles.', mob: 'orc', count: 8, minLevel: 7, xp: 650, gold: 180, item: true },
  // ---- missões de encontrar coisas (objetos brilhando pelo mundo; ande até perto para recolher) ----
  { id: 'f1', title: 'Ervas Lunares', desc: 'A curandeira precisa de ervas lunares, que brilham de azul nos Campos Verdes. Encontre 5.', mob: '', count: 5, minLevel: 1, xp: 90, gold: 30, potion: 'heal',
    find: { name: 'Erva Lunar', icon: '🌿', color: 0x6ad0ff, zone: 'fields', hint: 'Campos Verdes' } },
  { id: 'f2', title: 'Cogumelos Luminosos', desc: 'Alquimistas pagam bem por cogumelos que brilham na Floresta Sombria. Colha 6.', mob: '', count: 6, minLevel: 3, xp: 260, gold: 70, potion: 'energy',
    find: { name: 'Cogumelo Luminoso', icon: '🍄', color: 0xb0ff6a, zone: 'forest', hint: 'Floresta Sombria' } },
  { id: 'f3', title: 'Relicários dos Mortos', desc: 'Famílias imploram que os relicários de seus ancestrais sejam resgatados da Cripta Esquecida. Traga 5.', mob: '', count: 5, minLevel: 5, xp: 420, gold: 120, potion: 'heal',
    find: { name: 'Relicário Antigo', icon: '⚱️', color: 0xffe08a, zone: 'crypt', hint: 'Cripta Esquecida' } },
  { id: 'f4', title: 'Estandartes Roubados', desc: 'Os orcs tomaram estandartes da guarda. Recupere 5 nas Colinas dos Orcs.', mob: '', count: 5, minLevel: 7, xp: 700, gold: 190, item: true,
    find: { name: 'Estandarte da Guarda', icon: '🚩', color: 0xff6a5a, zone: 'orcs', hint: 'Colinas dos Orcs' } },
  { id: 'f5', title: 'Cristais Rúnicos', desc: 'Cristais rúnicos soltos pelo Covil do Ogro ainda guardam magia do Selo. Reúna 5.', mob: '', count: 5, minLevel: 9, xp: 1500, gold: 450, item: true,
    find: { name: 'Cristal Rúnico', icon: '💎', color: 0xc08aff, zone: 'ogre', hint: 'Covil do Ogro' } },
  { id: 'f6', title: 'Pedras da Alma', desc: 'Fragmentos de alma de heróis caídos jazem nas terras selvagens, em qualquer região. Encontre 8.', mob: '', count: 8, minLevel: 12, xp: 4200, gold: 900, item: true,
    find: { name: 'Pedra da Alma', icon: '🔮', color: 0x7affd0, zone: 'any', hint: 'qualquer região selvagem' } },
  { id: 'f7', title: 'Selos Esquecidos', desc: 'Selos menores da Ordem da Aurora ainda brilham em ruínas espalhadas por Aldoria. Recolha 10.', mob: '', count: 10, minLevel: 16, xp: 8000, gold: 1800, item: true,
    find: { name: 'Selo Esquecido', icon: '📿', color: 0xffd23f, zone: 'any', hint: 'qualquer região selvagem' } },
  { id: 'f8', title: 'Orquídeas Fantasmas', desc: 'Herbalistas das Palafitas pagam bem por orquídeas fantasmas, que brilham de verde no Pântano Abandonado. Colha 6.', mob: '', count: 6, minLevel: 11, xp: 2600, gold: 600, potion: 'energy',
    find: { name: 'Orquídea Fantasma', icon: '🌺', color: 0x8affb8, zone: 'swamp', hint: 'Pântano Abandonado' } },
  { id: 'f9', title: 'Relíquias das Dunas', desc: 'Caravaneiros juram que relíquias de um império esquecido jazem sob as areias do Deserto de Anauroch. Recupere 6.', mob: '', count: 6, minLevel: 14, xp: 5200, gold: 1200, item: true,
    find: { name: 'Relíquia Dourada', icon: '🏺', color: 0xffc94a, zone: 'desert', hint: 'Deserto de Anauroch' } },
  { id: 'q7', title: 'Senhores do Brejo', desc: 'Homens-lagarto dominam o Pântano Abandonado e atacam as Palafitas. Derrote 10.', mob: 'lizardfolk', count: 10, minLevel: 11, xp: 2800, gold: 700, item: true },
  { id: 'q8', title: 'A Maldição das Dunas', desc: 'Múmias despertaram nas areias do Deserto de Anauroch. Destrua 10.', mob: 'mummy', count: 10, minLevel: 14, xp: 5600, gold: 1300, item: true },
  { id: 'q6', title: 'A Queda do Ogro Ancião', desc: 'Gnarlmaw lidera os ogros no Covil ao sul. Derrote-o (recomendado em grupo).', mob: 'gnarlmaw', count: 1, minLevel: 9, xp: 1400, gold: 500, item: true },
];

export interface WorldData {
  tiles: number[][];
  spawns: SpawnPoint[];
  npcs: NpcDef[];
  start: { x: number; y: number };
  dungeons: { id: string; x: number; y: number }[];
  /** casas de moradores: centro em tiles e direção da porta (vetor unitário) */
  villageHouses: { cx: number; cz: number; fx: number; fz: number }[];
  /** objetos de missões de encontrar coisas: q = id da missão, i = número do objeto */
  finds: { q: string; i: number; x: number; y: number }[];
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateWorld(): WorldData {
  const rnd = mulberry32(20261104);
  const pick = (a: number[]) => a[Math.floor(rnd() * a.length)];
  const tiles: number[][] = [];
  const obstacle: Record<string, [number[], number][]> = {
    fields: [[[T.tree, T.tree2], 0.03], [[T.bush], 0.025]],
    forest: [[[T.ftree, T.ftree2], 0.22]],
    crypt: [[[T.grave, T.grave2], 0.07]],
    orcs: [[[T.red_rock], 0.06], [[T.red_tree], 0.02]],
    ogre: [[[T.red_rock], 0.05], [[T.red_tree], 0.07]],
    swamp: [[[T.swamp_tree], 0.13]],
    desert: [[[T.cactus], 0.012], [[T.sandrock], 0.028]],
  };
  const borderOf = (z: string) =>
    z === 'swamp' ? T.swamp_tree : z === 'desert' ? T.sandrock : z === 'forest' ? pick([T.ftree, T.ftree2]) : z === 'crypt' ? pick([T.grave, T.grave2]) : z === 'orcs' || z === 'ogre' ? pick([T.red_tree, T.red_rock]) : pick([T.tree, T.tree2]);
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) {
      const z = zoneAt(x, y);
      const zr = zoneAt(x + Math.floor(rnd() * 5) - 2, y + Math.floor(rnd() * 5) - 2); // mistura as bordas do piso
      const zg = ZONES[zr]?.biome ?? zr;
      let t: number = T.grass;
      if (zg === 'town' || zg === 'fields') t = rnd() < 0.07 ? T.flowers : rnd() < 0.5 ? T.grass : T.grass2;
      else if (zg === 'forest') t = T.forest;
      else if (zg === 'crypt') t = T.stone;
      else if (zg === 'swamp') t = T.swamp;
      else if (zg === 'desert') t = rnd() < 0.5 ? T.dune : T.dune2;
      else t = T.red;
      if (z !== 'town' && obstacle[z]) for (const [ot, p] of obstacle[z]) if (rnd() < p) { t = pick(ot); break; }
      row.push(t);
    }
    tiles.push(row);
  }
  // lagos: um na floresta e um açude nos campos
  for (const [lx, ly, rx, ry] of [[88, 352, 38, 27], [234, 318, 21, 14], [495, 90, 17, 11], [135, 60, 14, 10], [60, 105, 11, 7], [165, 105, 13, 8], [45, 35, 8, 5], [440, 345, 9, 6]]) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - lx) / rx, dy = (y - ly) / ry;
      if (dx * dx + dy * dy <= 1) tiles[y][x] = T.water;
      else if (dx * dx + dy * dy <= 1.3 && !BLOCKED.includes(tiles[y][x])) tiles[y][x] = zoneAt(x, y) === 'swamp' ? T.swamp : T.sand;
    }
  }
  // borda do mapa
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) tiles[y][x] = borderOf(zoneAt(Math.min(W - 3, Math.max(2, x)), Math.min(H - 3, Math.max(2, y))));
  }
  // estradas (+) saindo da vila
  const dirtTile = () => (rnd() < 0.85 ? T.dirt : pick([T.dirt2, T.dirt3]));
  const carve = (x: number, y: number) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2) tiles[y][x] = dirtTile(); };
  for (let x = 2; x < W - 2; x++) for (let d = -1; d <= 1; d++) carve(x, CY + d);
  for (let y = 2; y < H - 2; y++) for (let d = -1; d <= 1; d++) carve(CX + d, y);
  // estradas de terra ligando as vilas dos cantos (pântano e deserto) à estrada principal
  for (const [rx, ry0, ry1] of [[110, 68, CY], [500, CY, 382]] as [number, number, number][]) {
    for (let y = Math.min(ry0, ry1); y <= Math.max(ry0, ry1); y++) for (let d = -1; d <= 1; d++) carve(rx + d, y);
  }
  // vila circular: igreja ao centro, praça com fonte na frente, anel de ruas de pedra, edifícios espalhados e muralha
  const paved = () => (rnd() < 0.8 ? T.plaza : pick([T.plaza2, T.plaza3]));
  const dist = (x: number, y: number) => Math.hypot(x - CX, y - CY);
  const pave = (x: number, y: number) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2 && !BLOCKED.includes(tiles[y][x])) tiles[y][x] = paved(); };
  for (let y = CY - TOWN_R; y <= CY + TOWN_R; y++) for (let x = CX - TOWN_R; x <= CX + TOWN_R; x++) {
    if (dist(x, y) >= 13 && dist(x, y) <= 15.7) pave(x, y);                                                   // rua em anel
    if (((x - FOUNTAIN.x) / 8.5) ** 2 + ((y - FOUNTAIN.y) / 7.5) ** 2 <= 1) pave(x, y);                       // praça
    const roadN = Math.abs(x - CX) <= 1 && y < CY - 12, roadS = Math.abs(x - CX) <= 1 && y > CY + 9;
    const roadW = Math.abs(y - CY) <= 1 && x < CX - 12, roadE = Math.abs(y - CY) <= 1 && x > CX + 12;
    if ((roadN || roadS || roadW || roadE) && dist(x, y) <= TOWN_R) pave(x, y);                                // ruas até os portões
  }
  // vilas dos biomas: praça central, ruas em cruz e muralha com 4 portões
  for (const v of VILLAGES) {
    for (let y = v.cy - v.r - 1; y <= v.cy + v.r + 1; y++) for (let x = v.cx - v.r - 1; x <= v.cx + v.r + 1; x++) {
      const d = Math.hypot(x - v.cx, y - v.cy);
      if (d > v.r) continue;
      if (d <= 5) pave(x, y);
      else if (Math.abs(x - v.cx) <= 1 || Math.abs(y - v.cy) <= 1) pave(x, y);
    }
  }
  for (const b of BUILDINGS) {
    for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) tiles[y][x] = T.wall;
    const d = doorTile(b);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) pave(d.tx + ox, d.ty + oy);
    if (townOf(b) !== 'pouso') {
      const v = VILLAGES.find((q) => q.id === townOf(b))!;
      let vx = d.tx + 0.5, vy = d.ty + 0.5;
      for (let i = 0; i < 40 && Math.hypot(vx - v.cx, vy - v.cy) > 5; i++) {
        const dx = v.cx + 0.5 - vx, dy = v.cy + 0.5 - vy, l = Math.hypot(dx, dy);
        vx += (dx / l) * 0.7; vy += (dy / l) * 0.7;
        for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) pave(Math.floor(vx) + ox, Math.floor(vy) + oy);
      }
      continue;
    }
    // caminho de pedra da porta até o anel de ruas
    let fx = d.tx + 0.5, fy = d.ty + 0.5;
    for (let i = 0; i < 80 && dist(Math.floor(fx), Math.floor(fy)) > 15.7; i++) {
      const dx = CX + 0.5 - fx, dy = CY + 0.5 - fy, l = Math.hypot(dx, dy);
      fx += (dx / l) * 0.7; fy += (dy / l) * 0.7;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) pave(Math.floor(fx) + ox, Math.floor(fy) + oy);
    }
  }
  // casas de moradores: viradas naturalmente para a rua mais próxima, com vielas de pedra ligando à rua
  const villageHouses: { cx: number; cz: number; fx: number; fz: number }[] = [];
  const HX = 2.1, HZ = 1.1;               // meia-largura / meia-profundidade da casa
  const tileFree = (x: number, y: number) => { const t = tiles[y]?.[x]; return t !== undefined && !BLOCKED.includes(t) && t !== T.plaza && t !== T.plaza2 && t !== T.plaza3; };
  const roadDist = (x: number, y: number) => Math.min(
    Math.abs(dist(x, y) - 14.4) - 1.4,                         // anel
    Math.abs(x - CX) <= 36 ? Math.max(0, Math.abs(x - CX) - 1) : 99,
    Math.abs(y - CY) <= 36 ? Math.max(0, Math.abs(y - CY) - 1) : 99);
  const tryHouse = (cx: number, cz: number, fx: number, fz: number) => {
    const l = Math.hypot(fx, fz); fx /= l; fz /= l;
    if (dist(cx, cz) + 2.6 > TOWN_R - 2.5 || dist(cx, cz) < 18) return false;
    // área ocupada pela casa (rotacionada) + folga, e a área em frente à porta
    for (let y = Math.floor(cz - 5); y <= Math.ceil(cz + 5); y++) for (let x = Math.floor(cx - 5); x <= Math.ceil(cx + 5); x++) {
      const rx = x + 0.5 - cx, rz = y + 0.5 - cz;
      const u = rx * -fz + rz * fx, v = rx * fx + rz * fz;       // u: lateral, v: frente
      const inBody = Math.abs(u) <= HX + 0.9 && v >= -HZ - 0.9 && v <= HZ + 0.9;
      const inFront = Math.abs(u) <= 1.2 && v > HZ && v <= HZ + 1.6;
      const core = Math.abs(u) <= HX + 0.3 && Math.abs(v) <= HZ + 0.3;
      if (core && !tileFree(x, y)) return false;
      if ((inBody || inFront) && tiles[y]?.[x] !== undefined && BLOCKED.includes(tiles[y][x])) return false;
    }
    for (const h of villageHouses) if (Math.hypot(h.cx - cx, h.cz - cz) < 4.8) return false;
    for (const b of BUILDINGS) if (cx > b.x0 - 3.2 && cx < b.x0 + b.w + 3.2 && cz > b.y0 - 3.2 && cz < b.y0 + b.h + 3.2) return false;
    villageHouses.push({ cx, cz, fx, fz });
    for (let y = Math.floor(cz - 4); y <= Math.ceil(cz + 4); y++) for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++) {
      const rx = x + 0.5 - cx, rz = y + 0.5 - cz;
      if (Math.abs(rx * -fz + rz * fx) <= HX + 0.1 && Math.abs(rx * fx + rz * fz) <= HZ + 0.1) tiles[y][x] = T.wall;
    }
    // viela de pedra (2 tiles de largura) da porta até a rua mais próxima
    let px_ = cx + fx * (HZ + 0.7), pz_ = cz + fz * (HZ + 0.7);
    const nrm = (x: number, y: number) => ({ // direção até a rua mais próxima (gradiente numérico)
      x: roadDist(x + 0.5, y) - roadDist(x - 0.5, y), y: roadDist(x, y + 0.5) - roadDist(x, y - 0.5) });
    for (let i = 0; i < 40 && roadDist(px_, pz_) > 0.2; i++) {
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) { const tx = Math.floor(px_ - 0.5) + ox, ty = Math.floor(pz_ - 0.5) + oy; if (tileFree(tx, ty) || tiles[ty][tx] === T.grass || tiles[ty][tx] === T.grass2 || tiles[ty][tx] === T.flowers) tiles[ty][tx] = paved(); }
      let g = nrm(px_, pz_); let gl = Math.hypot(g.x, g.y);
      if (gl < 1e-3) { g = { x: fx, y: fz }; gl = 1; }
      px_ -= (g.x / gl) * 0.6; pz_ -= (g.y / gl) * 0.6;
    }
    return true;
  };
  // 1) casas ao longo do anel (porta para o centro); 2) casas ao longo das ruas radiais (porta para a rua)
  const order: number[] = [];
  for (let a = 0; a < 360; a += 6) order.push(a);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let placed = 0;
  for (const rr of [19.0, 22.0, 25.5, 29.0]) for (const a of order) {
    if (placed >= 40) break;
    const ang = (a * Math.PI) / 180, cx = CX + 0.5 + Math.cos(ang) * rr, cz = CY + 0.5 + Math.sin(ang) * rr;
    if (tryHouse(cx, cz, -Math.cos(ang), -Math.sin(ang))) placed++;
  }
  for (const sg of [-1, 1]) for (const along of [19.5, 23, 27, 31]) {
    tryHouse(CX + 0.5 + sg * 4.4, CY + 0.5 + along, -sg, 0);            // sul: viradas para a estrada
    tryHouse(CX + 0.5 + sg * 4.4, CY + 0.5 - along, -sg, 0);            // norte
    tryHouse(CX + 0.5 + along, CY + 0.5 + sg * 4.4, 0, -sg);            // leste
    tryHouse(CX + 0.5 - along, CY + 0.5 + sg * 4.4, 0, -sg);            // oeste
  }
  // muralha circular com 4 portões nas estradas
  for (let y = CY - TOWN_R - 2; y <= CY + TOWN_R + 2; y++) for (let x = CX - TOWN_R - 2; x <= CX + TOWN_R + 2; x++) {
    const d = dist(x, y);
    if (d < TOWN_R - 1.2 || d >= TOWN_R + 0.8) continue;
    const gate = (Math.abs(x - CX) <= GATE && Math.abs(y - CY) > 18) || (Math.abs(y - CY) <= GATE && Math.abs(x - CX) > 18);
    tiles[y][x] = gate ? paved() : T.wall;
  }
  for (const v of VILLAGES) {
    for (let y = v.cy - v.r - 2; y <= v.cy + v.r + 2; y++) for (let x = v.cx - v.r - 2; x <= v.cx + v.r + 2; x++) {
      const d = Math.hypot(x - v.cx, y - v.cy);
      if (d < v.r - 1.2 || d >= v.r + 0.8) continue;
      const gate = Math.abs(x - v.cx) <= GATE || Math.abs(y - v.cy) <= GATE;
      tiles[y][x] = gate ? paved() : T.wall;
    }
  }
  // covil do chefe
  const lair = { x: CX, y: 393 };
  for (let y = lair.y - 11; y <= lair.y + 11; y++) for (let x = lair.x - 11; x <= lair.x + 11; x++) {
    const d = Math.hypot(x - lair.x, y - lair.y);
    if (d <= 11 && x > 1 && y > 1 && x < W - 2 && y < H - 2) tiles[y][x] = rnd() < 0.05 ? T.bones : T.red;
  }
  // entradas de masmorra: pátio de pedra 5x5
  for (const d of DUNGEONS) {
    for (let y = d.entrance.ty - 2; y <= d.entrance.ty + 2; y++) for (let x = d.entrance.tx - 2; x <= d.entrance.tx + 2; x++) {
      tiles[y][x] = rnd() < 0.7 ? T.plaza : pick([T.plaza2, T.plaza3]);
    }
    // limpa obstáculos ao redor do pátio
    for (let y = d.entrance.ty - 3; y <= d.entrance.ty + 3; y++) for (let x = d.entrance.tx - 3; x <= d.entrance.tx + 3; x++) {
      if (BLOCKED.includes(tiles[y][x]) && tiles[y][x] !== T.water) tiles[y][x] = zoneAt(x, y) === 'swamp' ? T.swamp : zoneAt(x, y) === 'desert' ? T.dune : zoneAt(x, y) === 'forest' ? T.forest : zoneAt(x, y) === 'crypt' ? T.stone : zoneAt(x, y) === 'orcs' || zoneAt(x, y) === 'ogre' ? T.red : T.grass;
    }
  }
  // pontos de spawn
  const blocked = (x: number, y: number) => BLOCKED.includes(tiles[y][x]);
  const spawns: SpawnPoint[] = [];
  const weighted = (list: [string, number][]) => {
    const tot = list.reduce((a, b) => a + b[1], 0);
    let r = rnd() * tot;
    for (const [id, w] of list) { r -= w; if (r <= 0) return id; }
    return list[0][0];
  };
  for (const z of Object.values(ZONES)) {
    let n = 0, guard = 0;
    while (n < z.count && guard++ < 30000) {
      const x = 3 + Math.floor(rnd() * (W - 6)), y = 3 + Math.floor(rnd() * (H - 6));
      if (zoneAt(x, y) !== z.id) continue;
      if (blocked(x, y) || ([T.dirt, T.dirt2, T.dirt3] as number[]).includes(tiles[y][x]) || tiles[y][x] === T.water) continue;
      if (dist(x, y) <= TOWN_R + 6) continue; // nada nasce dentro nem junto da muralha
      if (VILLAGES.some((v) => Math.hypot(x - v.cx, y - v.cy) <= v.r + 5)) continue;
      if (DUNGEONS.some((d) => Math.hypot(x - d.entrance.tx, y - d.entrance.ty) < 7)) continue;
      if (z.id === 'ogre' && Math.hypot(x - lair.x, y - lair.y) < 14) continue;
      if (spawns.some((s) => Math.hypot(s.x / TILE - x, s.y / TILE - y) < 4)) continue;
      spawns.push({ mob: weighted(z.mobs), x: x * TILE + 8, y: y * TILE + 8 });
      n++;
    }
  }
  spawns.push({ mob: 'gnarlmaw', x: lair.x * TILE + 8, y: lair.y * TILE + 8, boss: true });
  // objetos das missões de achar coisas (gerador próprio: não altera a ordem dos spawns)
  const finds: WorldData['finds'] = [];
  const wild = ['fields', 'forest', 'crypt', 'orcs', 'ogre', 'swamp', 'desert'];
  for (const fq of QUESTS) {
    if (!fq.find) continue;
    const fr = mulberry32(9100 + fq.id.charCodeAt(1) * 31);
    let n = 0, guard = 0;
    const total = fq.count * 3;   // 3× mais objetos do que o necessário: fica fácil achar
    while (n < total && guard++ < 30000) {
      const x = 4 + Math.floor(fr() * (W - 8)), y = 4 + Math.floor(fr() * (H - 8));
      const zn = zoneAt(x, y);
      if (fq.find.zone === 'any' ? !wild.includes(zn) : zn !== fq.find.zone) continue;
      if (blocked(x, y) || tiles[y][x] === T.water) continue;
      if (dist(x, y) <= TOWN_R + 4 || VILLAGES.some((v) => Math.hypot(x - v.cx, y - v.cy) <= v.r + 3)) continue;
      if (DUNGEONS.some((d) => Math.hypot(x - d.entrance.tx, y - d.entrance.ty) < 6)) continue;
      if (finds.some((f) => f.q === fq.id && Math.hypot(f.x / TILE - x, f.y / TILE - y) < 5)) continue;
      finds.push({ q: fq.id, i: n, x: x * TILE + 8, y: y * TILE + 8 });
      n++;
    }
  }
  // guardas: dois em cada portão e três patrulhando as ruas (os demais NPCs vivem dentro dos edifícios)
  const npcs: NpcDef[] = [];
  const px = (t: number) => t * TILE + 8;
  const at = (r: number, a: number): [number, number] => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const nx = -Math.sin(a), ny = Math.cos(a);        // tangente: um guarda de cada lado do portão
    for (const sg of [-1, 1]) {
      const [gx, gy] = at(TOWN_R - 3, a);
      npcs.push({ id: 'guard', name: 'Guarda do Portão', x: px(gx + nx * sg * 3.2), y: px(gy + ny * sg * 3.2), face: Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI });
    }
  }
  for (const v of VILLAGES) {
    for (const [dx, dy, fc] of [[v.r - 3, 0, Math.PI / 2], [-(v.r - 3), 0, -Math.PI / 2], [0, v.r - 3, 0], [0, -(v.r - 3), Math.PI]] as [number, number, number][]) {
      const sx = dx === 0 ? 3 : 0, sy = dy === 0 ? 3 : 0;
      npcs.push({ id: 'guard', name: 'Guarda de ' + v.name, x: px(v.cx + dx + sx), y: px(v.cy + dy + sy), face: fc });
    }
  }
  const ringPath = (r: number, n: number, rev: boolean, off: number) => Array.from({ length: n }, (_, i) => { const a = ((rev ? -i : i) / n) * Math.PI * 2 + off; const [x, y] = at(r, a); return { x: px(x), y: px(y) }; });
  npcs.push({ id: 'guard', name: 'Guarda da Vila', x: px(CX + 14.4), y: px(CY), path: ringPath(14.4, 16, false, 0) });
  npcs.push({ id: 'guard', name: 'Guarda da Vila', x: px(CX - 14.4), y: px(CY), path: ringPath(14.4, 16, true, Math.PI) });
  npcs.push({ id: 'guard', name: 'Guarda da Vila', x: px(FOUNTAIN.x + 6), y: px(FOUNTAIN.y), path: ringPath(6, 10, false, 0).map((p) => ({ x: p.x - px(CX) + px(FOUNTAIN.x), y: p.y - px(CY) + px(FOUNTAIN.y) })) });
  return {
    villageHouses, finds, tiles, spawns, npcs, start: { x: CX * TILE + 8, y: (CY + 1) * TILE + 8 },
    dungeons: DUNGEONS.map((d) => ({ id: d.id, x: d.entrance.tx * TILE + 8, y: d.entrance.ty * TILE + 8 })),
  };
}
