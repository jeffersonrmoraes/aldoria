// Arte: Kenney (www.kenney.nl), packs Tiny Town e Tiny Dungeon — licença CC0 (domínio público).
// O atlas é gerado por tools/build_art.py. Aqui carregamos e montamos os personagens jogáveis.
import artUrl from '../assets/art.png';
import { ART_COLUMNS, F } from './atlas';
import { RACE_BY_ID } from '../data/races';
import type { Item } from '../data/items';

export let artImg: HTMLImageElement;

export function loadArt(): Promise<void> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { artImg = i; res(); };
    i.onerror = () => rej(new Error('Falha ao carregar a arte'));
    i.src = artUrl;
  });
}

const FR = F as Record<string, number>;
export const frameOf = (name: string) => FR[name];

export function frameCanvas(idx: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  c.getContext('2d')!.drawImage(artImg, (idx % ART_COLUMNS) * 16, Math.floor(idx / ART_COLUMNS) * 16, 16, 16, 0, 0, 16, 16);
  return c;
}

const iconCache: Record<string, string> = {};
/** Ícone ampliado (data URL) de um frame do atlas. */
export function frameIcon(name: string, scale = 4): string {
  const k = name + scale;
  if (!iconCache[k]) {
    const src = frameCanvas(FR[name]);
    const c = document.createElement('canvas');
    c.width = 16 * scale; c.height = 16 * scale;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    iconCache[k] = c.toDataURL();
  }
  return iconCache[k];
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (h: string, f: number): [number, number, number] => hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as [number, number, number];

// Cores de pele nos sprites originais (claro, médio, sombra)
const SKIN_SRC: [number, number, number][] = [hex('#f7c282'), hex('#eaa56c'), hex('#e19a65')];

/** Personagem jogável: sprite-base da classe + tom de pele da raça + traços raciais. */
export function playerCanvas(raceId: string, classId: string, tone: string): HTMLCanvasElement {
  const race = RACE_BY_ID[raceId];
  const c = frameCanvas(FR['c_' + classId]);
  const g = c.getContext('2d')!;
  const img = g.getImageData(0, 0, 16, 16);
  const d = img.data;
  const to: [number, number, number][] = [hex(tone), shade(tone, 0.94), shade(tone, 0.8)];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    for (let k = 0; k < 3; k++) {
      const s = SKIN_SRC[k];
      if (d[i] === s[0] && d[i + 1] === s[1] && d[i + 2] === s[2]) { d[i] = to[k][0]; d[i + 1] = to[k][1]; d[i + 2] = to[k][2]; break; }
    }
  }
  g.putImageData(img, 0, 0);

  // traços raciais (pixels extras + contorno automático)
  const extra = document.createElement('canvas');
  extra.width = 16; extra.height = 16;
  const e = extra.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { e.fillStyle = col; e.fillRect(x, y, 1, 1); };
  const L = race.look;
  if (L.ears) { for (const [x, y] of [[3, 7], [2, 6], [1, 5], [12, 7], [13, 6], [14, 5]]) px(x, y, tone); }
  if (L.horns) { for (const [x, y] of [[4, 2], [3, 1], [11, 2], [12, 1]]) px(x, y, '#7a2030'); px(3, 0, '#e8a0a0'); px(12, 0, '#e8a0a0'); }
  if (L.tusks) { px(6, 9, '#ffffff'); px(9, 9, '#ffffff'); }
  if (L.snout) { for (const x of [6, 7, 8, 9]) px(x, 8, `rgb(${shade(tone, 1.25).join(',')})`); px(7, 2, `rgb(${shade(tone, 0.8).join(',')})`); px(8, 2, `rgb(${shade(tone, 0.8).join(',')})`); }
  if (L.beard) { for (const [x, y] of [[5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [6, 10], [7, 10], [8, 10], [9, 10]]) px(x, y, '#8a4b2a'); }
  const ex = e.getImageData(0, 0, 16, 16).data;
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && ex[(y * 16 + x) * 4 + 3] > 0;
  g.drawImage(extra, 0, 0);
  g.fillStyle = '#3f2631';
  const cur = g.getImageData(0, 0, 16, 16).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && cur[(y * 16 + x) * 4 + 3] > 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (solid(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has(x + dx, y + dy))) g.fillRect(x, y, 1, 1);
  }
  return c;
}

export function weaponFrame(name: string): number {
  const n = name.toLowerCase();
  if (n.startsWith('adaga')) return FR.i_dagger;
  if (n.startsWith('montante')) return FR.i_sword2;
  if (n.startsWith('espada')) return FR.i_sword;
  if (n.startsWith('machad')) return n.includes('grande') ? FR.i_axe2 : FR.i_axe;
  if (n.startsWith('maça') || n.startsWith('martelo')) return FR.i_hammer;
  if (n.startsWith('arco') || n.startsWith('besta')) return FR.i_bow;
  if (n.startsWith('varinha')) return FR.i_wand;
  return FR.i_staff;
}

export function itemFrameName(it: Item): string {
  const f = weaponFrame(it.name);
  if (it.slot === 'mainhand' || it.offKind === 'weapon') return Object.keys(FR).find((k) => FR[k] === f)!;
  return it.slot === 'body' || it.offKind === 'shield' ? 'i_shield' : 'i_stone';
}

export const MOB_FRAME = (id: string) => FR['m_' + id];
export const NPC_FRAME: Record<string, number> = { captain: FR.c_fighter, merchant: FR.c_bard, healer: FR.c_druid };
