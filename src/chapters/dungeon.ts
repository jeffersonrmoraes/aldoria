// Gerador procedural (determinístico por semente) de masmorras: salas em cadeia, corredores e encontros.
import { TILE } from './chapter1';
import type { DungeonDef } from './story1';

export interface Room { x: number; y: number; w: number; h: number }
export interface DungeonMap {
  w: number; h: number;
  floor: Uint8Array;           // 1 = piso
  rooms: Room[];
  start: { x: number; y: number };       // px
  exit: { x: number; y: number };        // px
  spawns: { mob: string; x: number; y: number; boss?: boolean }[];
  braziers: { x: number; y: number }[];  // tiles
  pillars: { x: number; y: number }[];   // tiles sólidos no salão do chefe
}

function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateDungeon(def: DungeonDef): DungeonMap {
  const r = rng(def.seed);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const w = 100, h = 76;
  const floor = new Uint8Array(w * h);
  const rooms: Room[] = [];
  const total = def.rooms + 1; // + sala do chefe
  const overlaps = (a: Room, b: Room, m = 3) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

  const BW = 24, BH = 18;
  const bossRoom: Room = { x: ri(3, w - BW - 4), y: ri(3, h - BH - 4), w: BW, h: BH };
  for (let i = 0; i < total - 1; i++) {
    const first = i === 0;
    for (let tries = 0; tries < 500; tries++) {
      const rw = first ? 8 : ri(7, 11), rh = first ? 8 : ri(6, 9);
      const room = { x: ri(3, w - rw - 4), y: ri(3, h - rh - 4), w: rw, h: rh };
      if (overlaps(room, bossRoom) || rooms.some((o) => overlaps(room, o))) continue;
      rooms.push(room);
      break;
    }
  }
  rooms.push(bossRoom);
  // garante a cadeia mesmo se alguma sala não coube
  const carveRoom = (o: Room) => { for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) floor[y * w + x] = 1; };
  const cx = (o: Room) => Math.floor(o.x + o.w / 2), cy = (o: Room) => Math.floor(o.y + o.h / 2);
  const carve = (x: number, y: number) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) floor[(y + dy) * w + x + dx] = 1; };
  rooms.forEach(carveRoom);
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = cx(a), y = cy(a);
    const tx = cx(b), ty = cy(b);
    if (r() < 0.5) { while (x !== tx) { carve(x, y); x += Math.sign(tx - x); } while (y !== ty) { carve(x, y); y += Math.sign(ty - y); } }
    else { while (y !== ty) { carve(x, y); y += Math.sign(ty - y); } while (x !== tx) { carve(x, y); x += Math.sign(tx - x); } }
  }

  const first = rooms[0], last = rooms[rooms.length - 1];
  const start = { x: (cx(first)) * TILE + 8, y: (cy(first) + 1) * TILE + 8 };
  const exit = { x: cx(first) * TILE + 8, y: (first.y + 1) * TILE + 8 };
  const spawns: DungeonMap['spawns'] = [];
  const pickMob = () => {
    const tot = def.mobs.reduce((a, b) => a + b[1], 0);
    let v = r() * tot;
    for (const [id, wt] of def.mobs) { v -= wt; if (v <= 0) return id; }
    return def.mobs[0][0];
  };
  for (let i = 1; i < rooms.length - 1; i++) {
    const o = rooms[i];
    const n = ri(def.perRoom[0], def.perRoom[1]);
    for (let k = 0; k < n; k++) {
      spawns.push({ mob: pickMob(), x: (o.x + 1 + Math.floor(r() * (o.w - 2))) * TILE + 8, y: (o.y + 1 + Math.floor(r() * (o.h - 2))) * TILE + 8 });
    }
  }
  // o chefe espera sozinho no centro do salão amplo
  const pillars = [[last.x + 5, last.y + 4], [last.x + last.w - 6, last.y + 4], [last.x + 5, last.y + last.h - 5], [last.x + last.w - 6, last.y + last.h - 5]].map(([x, y]) => ({ x, y }));
  spawns.push({ mob: def.boss, x: cx(last) * TILE + 8, y: (last.y + 5) * TILE + 8, boss: true });

  const braziers: DungeonMap['braziers'] = [];
  for (const o of rooms) {
    for (const [bx, by] of [[o.x, o.y], [o.x + o.w - 1, o.y], [o.x, o.y + o.h - 1], [o.x + o.w - 1, o.y + o.h - 1]]) braziers.push({ x: bx, y: by });
  }
  return { w, h, floor, rooms, start, exit, spawns, braziers, pillars };
}
