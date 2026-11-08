import { player } from './state';
import { W, H } from '../chapters/mapdims';
import type { WorldData } from '../chapters/chapter1';

/** Exploração do mapa: grade de células de 4×4 tiles, salva no jogador. */
export const MCELL = 4;
export const GW = Math.ceil(W / MCELL);
export const GH = Math.ceil(H / MCELL);

let ex = new Uint8Array(GW * GH);
let exFor: unknown = null;
export let exploredVersion = 0;

export function getExplored(): Uint8Array {
  if (exFor !== player) {
    exFor = player;
    ex = new Uint8Array(GW * GH);
    const s = player.explored;
    if (s && s.length === GW * GH) for (let i = 0; i < s.length; i++) ex[i] = s.charCodeAt(i) === 49 ? 1 : 0;
    exploredVersion++;
  }
  return ex;
}

/** Revela as células em volta (em tiles). Retorna true se algo novo foi descoberto. */
export function reveal(tx: number, ty: number, r = 12): boolean {
  const e = getExplored();
  let changed = false;
  const x0 = Math.max(0, Math.floor((tx - r) / MCELL)), x1 = Math.min(GW - 1, Math.floor((tx + r) / MCELL));
  const y0 = Math.max(0, Math.floor((ty - r) / MCELL)), y1 = Math.min(GH - 1, Math.floor((ty + r) / MCELL));
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const cx = gx * MCELL + MCELL / 2, cy = gy * MCELL + MCELL / 2;
    if ((cx - tx) ** 2 + (cy - ty) ** 2 <= (r + 1) * (r + 1) && !e[gy * GW + gx]) { e[gy * GW + gx] = 1; changed = true; }
  }
  if (changed) {
    exploredVersion++;
    let s = '';
    for (let i = 0; i < e.length; i++) s += e[i] ? '1' : '0';
    player.explored = s;
  }
  return changed;
}

/** Revela todas as células cujo centro (em tiles) satisfaz o filtro (mapa comprado). Retorna quantas células novas. */
export function revealWhere(pred: (tx: number, ty: number) => boolean): number {
  const e = getExplored();
  let n = 0;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (e[gy * GW + gx]) continue;
    if (pred(gx * MCELL + MCELL / 2, gy * MCELL + MCELL / 2)) { e[gy * GW + gx] = 1; n++; }
  }
  if (n) {
    exploredVersion++;
    let s = '';
    for (let i = 0; i < e.length; i++) s += e[i] ? '1' : '0';
    player.explored = s;
  }
  return n;
}

export const isExplored = (tx: number, ty: number) => !!getExplored()[Math.floor(ty / MCELL) * GW + Math.floor(tx / MCELL)];

/** Fonte de dados do mundo para a janela de mapa (registrada pela cena). */
export interface MapSource { world: WorldData; pos: () => { x: number; y: number } }
export let mapSource: MapSource | null = null;
export const setMapSource = (m: MapSource) => { mapSource = m; };
