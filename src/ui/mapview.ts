import { CX, CY, TILE, W, H, T, ZONES, zoneAt } from '../chapters/chapter1';
import { FOUNTAIN, TOWN_R } from '../chapters/mapdims';
import { BUILDINGS, VILLAGES, townOf } from '../chapters/town';
import { DUNGEONS } from '../chapters/story1';
import { GH, GW, MCELL, exploredVersion, getExplored, mapSource } from '../game/mapdata';

// Mapa medieval ilustrado: pergaminho, tinta, aquarela e névoa sobre o que ainda não foi explorado.

export type MapKind = 'global' | 'city';
const INK = '#3b2a17', INK2 = '#5a4126', PARCH = '#e8d6a6';
const FONT = '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

interface View { kind: MapKind; S: number; M: number; ox: number; oy: number; wt: number; ht: number; cw: number; ch: number }
// ox/oy: tile de origem; wt/ht: tiles exibidos; S: pixels por tile; M: margem da moldura
const GLOBAL: View = { kind: 'global', S: 2, M: 34, ox: 0, oy: 0, wt: W, ht: H, cw: W * 2 + 68, ch: H * 2 + 68 + 8 };
const CITYR = TOWN_R + 4;
const CITY: View = { kind: 'city', S: 11, M: 34, ox: CX - CITYR, oy: CY - CITYR, wt: CITYR * 2 + 1, ht: CITYR * 2 + 1, cw: (CITYR * 2 + 1) * 11 + 68, ch: (CITYR * 2 + 1) * 11 + 68 + 8 };
const VIEWS = { global: GLOBAL, city: CITY };
const px = (v: View, tx: number) => (tx - v.ox) * v.S + v.M;
const py = (v: View, ty: number) => (ty - v.oy) * v.S + v.M + 4;

// ---------------------------------------------------------------- pergaminho
function parchment(w: number, h: number, seed: number): HTMLCanvasElement {
  const c = mk(w, h), g = c.getContext('2d')!, r = rng(seed);
  g.fillStyle = PARCH; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {                               // manchas de envelhecimento
    const x = r() * w, y = r() * h, rad = 30 + r() * 150;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.6;
    gr.addColorStop(0, dark ? `rgba(150,105,45,${0.04 + r() * 0.07})` : `rgba(255,245,210,${0.05 + r() * 0.08})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 0.07;                                         // fibras do papel
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = r() < 0.5 ? '#6b4a1e' : '#fff6d8'; g.lineWidth = 0.6;
    const x = r() * w, y = r() * h, a = r() * Math.PI * 2, l = 4 + r() * 14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(120,80,30,0)'); vg.addColorStop(1, 'rgba(110,70,25,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);                      // bordas queimadas
  return c;
}

// ---------------------------------------------------------------- ícones em tinta
function halo(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, opt: { bold?: boolean; italic?: boolean; color?: string; spacing?: number; halo?: number } = {}) {
  g.save();
  g.font = `${opt.italic ? 'italic ' : ''}${opt.bold ? '700 ' : ''}${size}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  (g as unknown as { letterSpacing: string }).letterSpacing = `${opt.spacing ?? 0}px`;
  g.lineJoin = 'round'; g.lineWidth = opt.halo ?? 4.5; g.strokeStyle = 'rgba(238,222,176,0.92)';
  g.strokeText(text, x, y);
  g.fillStyle = opt.color ?? INK; g.fillText(text, x, y);
  g.restore();
}

function tree(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: 'leaf' | 'pine' | 'red' | 'dead') {
  g.save(); g.translate(x, y); g.lineWidth = 1; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.5); g.stroke();                 // tronco
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const yy = -s * 0.35 - i * s * 0.42, w = s * (0.62 - i * 0.14);
      g.fillStyle = i % 2 ? '#4f7a47' : '#5d8a50';
      g.beginPath(); g.moveTo(-w, yy); g.lineTo(w, yy); g.lineTo(0, yy - s * 0.62); g.closePath(); g.fill(); g.stroke();
    }
  } else if (kind === 'dead') {
    g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(-s * 0.4, -s * 0.95); g.moveTo(0, -s * 0.7); g.lineTo(s * 0.35, -s * 1.05); g.moveTo(0, -s * 0.5); g.lineTo(s * 0.05, -s * 1.2); g.stroke();
  } else {
    g.fillStyle = kind === 'red' ? '#b4673e' : '#7ea35a';
    for (const [dx, dy, r] of [[-s * 0.3, -s * 0.75, s * 0.38], [s * 0.3, -s * 0.78, s * 0.38], [0, -s * 1.05, s * 0.42]] as const) {
      g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  g.restore();
}

function hill(g: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1; g.fillStyle = fill; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(-s * 0.4, -s * 1.15, 0, -s * 0.95); g.quadraticCurveTo(s * 0.5, -s * 1.1, s, 0); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(s * 0.25 + i * s * 0.2, -s * 0.15 - i * 0.5); g.lineTo(s * 0.4 + i * s * 0.2, -s * 0.55 - i * 0.5); g.stroke(); }
  g.restore();
}

function mountain(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1; g.lineJoin = 'round';
  g.fillStyle = '#c8c4b4'; g.beginPath(); g.moveTo(-s, 0); g.lineTo(-s * 0.1, -s * 1.5); g.lineTo(s * 0.35, -s * 0.9); g.lineTo(s * 0.7, -s * 1.2); g.lineTo(s * 1.2, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(70,60,50,0.35)'; g.beginPath(); g.moveTo(-s * 0.1, -s * 1.5); g.lineTo(s * 0.35, -s * 0.9); g.lineTo(s * 0.2, 0); g.lineTo(-s * 0.4, 0); g.closePath(); g.fill();
  g.restore();
}

function gravestone(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.fillStyle = '#cfcabb'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-s * 0.4, 0); g.lineTo(-s * 0.4, -s * 0.7); g.arc(0, -s * 0.7, s * 0.4, Math.PI, 0); g.lineTo(s * 0.4, 0); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(0, -s * 0.4); g.moveTo(-s * 0.2, -s * 0.72); g.lineTo(s * 0.2, -s * 0.72); g.stroke();
  g.restore();
}

function houseIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, roof = '#b4452f') {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1; g.lineJoin = 'round';
  g.fillStyle = '#efe2bd'; g.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 0.7); g.strokeRect(-s * 0.7, -s * 0.7, s * 1.4, s * 0.7);
  g.fillStyle = roof; g.beginPath(); g.moveTo(-s * 0.9, -s * 0.7); g.lineTo(0, -s * 1.5); g.lineTo(s * 0.9, -s * 0.7); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK2; g.fillRect(-s * 0.12, -s * 0.38, s * 0.24, s * 0.38);
  g.restore();
}

function towerIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, roof: string, w = 0.55, h = 1.7) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1; g.lineJoin = 'round';
  g.fillStyle = '#e3dcc8'; g.fillRect(-s * w, -s * h, s * w * 2, s * h); g.strokeRect(-s * w, -s * h, s * w * 2, s * h);
  g.fillStyle = roof; g.beginPath(); g.moveTo(-s * (w + 0.18), -s * h); g.lineTo(0, -s * (h + 0.95)); g.lineTo(s * (w + 0.18), -s * h); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK2; g.fillRect(-s * 0.1, -s * 0.5, s * 0.2, s * 0.5); g.fillRect(-s * 0.08, -s * (h - 0.4), s * 0.16, s * 0.3);
  g.restore();
}

function dragon(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = INK; g.lineWidth = 1 / s * 1.1; g.lineJoin = 'round'; g.fillStyle = '#8fa56a';
  g.beginPath();                                                               // corpo + cauda
  g.moveTo(-26, 6); g.bezierCurveTo(-18, -8, -6, -10, 4, -6); g.bezierCurveTo(10, -14, 18, -16, 24, -10);
  g.lineTo(30, -12); g.lineTo(28, -6); g.lineTo(32, -4); g.lineTo(24, -2); g.bezierCurveTo(16, 0, 10, 6, 4, 8);
  g.bezierCurveTo(-4, 12, -12, 10, -20, 14); g.bezierCurveTo(-28, 16, -32, 10, -26, 6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#b9c78f'; g.beginPath(); g.moveTo(-6, -8); g.bezierCurveTo(-8, -26, 4, -30, 14, -34); g.bezierCurveTo(10, -24, 12, -14, 6, -8); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-6, 8); g.lineTo(-8, 16); g.moveTo(6, 8); g.lineTo(8, 15); g.stroke();
  g.fillStyle = '#c8452a'; g.beginPath(); g.moveTo(32, -6); g.quadraticCurveTo(42, -8, 46, -2); g.quadraticCurveTo(40, -2, 36, 2); g.quadraticCurveTo(38, -2, 32, -4); g.fill();
  g.restore();
}

function dungeonIcon(g: CanvasRenderingContext2D, id: string, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1; g.lineJoin = 'round';
  if (id === 'moinho') {                                                     // moinho velho
    towerIcon(g, 0, 0, s, '#8a5a2e', 0.6, 1.4);
    g.translate(0, -s * 1.9); g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.1); g.stroke(); g.fillStyle = '#efe2bd'; g.fillRect(-s * 0.2, -s * 1.1, s * 0.4, s * 0.6); g.strokeRect(-s * 0.2, -s * 1.1, s * 0.4, s * 0.6); }
  } else if (id === 'goblin') {                                              // toca na colina
    hill(g, 0, 0, s * 1.3, '#9fae78');
    g.fillStyle = '#2a1d10'; g.beginPath(); g.ellipse(0, -s * 0.2, s * 0.45, s * 0.5, 0, Math.PI, 0); g.fill();
    g.fillStyle = INK; g.fillRect(-s * 0.45, -s * 0.22, s * 0.9, s * 0.22);
  } else if (id === 'cripta') {                                              // cripta com cruz
    g.fillStyle = '#d4cfbe'; g.fillRect(-s * 0.9, -s * 0.9, s * 1.8, s * 0.9); g.strokeRect(-s * 0.9, -s * 0.9, s * 1.8, s * 0.9);
    g.fillStyle = '#7d7a6e'; g.beginPath(); g.moveTo(-s * 1.05, -s * 0.9); g.lineTo(0, -s * 1.6); g.lineTo(s * 1.05, -s * 0.9); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1e1a14'; g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(-s * 0.3, -s * 0.5); g.arc(0, -s * 0.5, s * 0.3, Math.PI, 0); g.lineTo(s * 0.3, 0); g.fill();
    g.beginPath(); g.moveTo(0, -s * 2.3); g.lineTo(0, -s * 1.6); g.moveTo(-s * 0.3, -s * 2.0); g.lineTo(s * 0.3, -s * 2.0); g.stroke();
  } else if (id === 'fortaleza') {                                           // fortaleza orc com bandeira
    g.fillStyle = '#b8a890'; g.fillRect(-s * 1.1, -s * 0.9, s * 2.2, s * 0.9); g.strokeRect(-s * 1.1, -s * 0.9, s * 2.2, s * 0.9);
    for (let i = 0; i < 4; i++) { g.fillRect(-s * 1.1 + i * s * 0.62, -s * 1.15, s * 0.36, s * 0.25); g.strokeRect(-s * 1.1 + i * s * 0.62, -s * 1.15, s * 0.36, s * 0.25); }
    towerIcon(g, 0, -s * 0.9, s * 0.8, '#7a3a2a', 0.6, 1.2);
    g.fillStyle = INK2; g.fillRect(-s * 0.25, -s * 0.5, s * 0.5, s * 0.5);
    g.beginPath(); g.moveTo(0, -s * 3.6); g.lineTo(0, -s * 4.5); g.stroke(); g.fillStyle = '#a82a22'; g.beginPath(); g.moveTo(0, -s * 4.5); g.lineTo(s * 0.9, -s * 4.2); g.lineTo(0, -s * 3.9); g.fill();
  } else {                                                                   // câmara do selo: castelo sombrio
    g.fillStyle = '#a9a0b5'; g.fillRect(-s * 0.9, -s * 1.1, s * 1.8, s * 1.1); g.strokeRect(-s * 0.9, -s * 1.1, s * 1.8, s * 1.1);
    towerIcon(g, -s * 1.0, 0, s * 0.8, '#4a3d8a', 0.45, 2.0); towerIcon(g, s * 1.0, 0, s * 0.8, '#4a3d8a', 0.45, 2.0); towerIcon(g, 0, -s * 1.1, s * 0.8, '#4a3d8a', 0.45, 1.6);
    g.fillStyle = 'rgba(140,90,220,0.45)'; g.beginPath(); g.arc(0, -s * 0.5, s * 0.55, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- terreno
const cat = (id: number): string => {
  if (id === T.water) return 'water';
  if (id === T.sand) return 'sand';
  if (id === T.dirt || id === T.dirt2 || id === T.dirt3) return 'dirt';
  if (id === T.plaza || id === T.plaza2 || id === T.plaza3) return 'paved';
  if (id === T.wall || id === T.wall_l || id === T.wall_r || id === T.wall_w || id === T.roof || id === T.roof_l || id === T.roof_r || id === T.door) return 'wall';
  return 'land';
};
const ZONE_TINT: Record<string, string> = { town: '#cdd596', fields: '#c9d28c', forest: '#97b472', crypt: '#b3b09f', orcs: '#d09a6e', ogre: '#a97a5c', swamp: '#8f9c64', desert: '#e8d192', v_pantano: '#8f9c64', v_deserto: '#e8d192', v_floresta: '#97b472', v_cripta: '#b3b09f', v_orcs: '#d09a6e', v_ogro: '#a97a5c' };
const TILE_TINT = (id: number, z: string): string => {
  const c = cat(id);
  if (c === 'water') return '#86b1b8';
  if (c === 'sand') return '#e4d29c';
  if (c === 'dirt') return '#d7bd88';
  if (c === 'paved') return '#d2c6a6';
  if (c === 'wall') return '#cdbf9e';
  return ZONE_TINT[z] ?? ZONE_TINT.fields;
};

function strokeEdges(g: CanvasRenderingContext2D, v: View, tiles: number[][], isA: (id: number) => boolean, color: string, lw: number, r: () => number) {
  g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  const x0 = Math.max(1, v.ox), x1 = Math.min(W - 2, v.ox + v.wt), y0 = Math.max(1, v.oy), y1 = Math.min(H - 2, v.oy + v.ht);
  g.beginPath();
  const j = () => (r() - 0.5) * v.S * 0.35;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!isA(tiles[y][x])) continue;
    const X = px(v, x), Y = py(v, y), S = v.S;
    if (!isA(tiles[y - 1][x])) { g.moveTo(X, Y + j()); g.lineTo(X + S, Y + j()); }
    if (!isA(tiles[y + 1][x])) { g.moveTo(X, Y + S + j()); g.lineTo(X + S, Y + S + j()); }
    if (!isA(tiles[y][x - 1])) { g.moveTo(X + j(), Y); g.lineTo(X + j(), Y + S); }
    if (!isA(tiles[y][x + 1])) { g.moveTo(X + S + j(), Y); g.lineTo(X + S + j(), Y + S); }
  }
  g.stroke(); g.restore();
}

function paintLand(v: View, tiles: number[][], seed: number): HTMLCanvasElement {
  const c = mk(v.cw, v.ch), g = c.getContext('2d')!, r = rng(seed);
  // aquarela: 1px por tile -> ampliado e suavizado
  const small = mk(v.wt, v.ht), sg = small.getContext('2d')!;
  for (let y = 0; y < v.ht; y++) for (let x = 0; x < v.wt; x++) {
    const tx = v.ox + x, ty = v.oy + y;
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) { sg.fillStyle = '#97b472'; sg.fillRect(x, y, 1, 1); continue; }
    sg.fillStyle = TILE_TINT(tiles[ty][tx], zoneAt(tx, ty)); sg.fillRect(x, y, 1, 1);
  }
  g.save(); g.filter = `blur(${v.S * 0.55}px)`; g.imageSmoothingEnabled = true;
  g.drawImage(small, v.M, v.M + 4, v.wt * v.S, v.ht * v.S); g.restore();
  g.save(); g.globalAlpha = 0.05; g.fillStyle = '#7a5520'; g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(v.M + r() * v.wt * v.S, v.M + r() * v.ht * v.S, 12 + r() * 40, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // ondas e costas
  g.save();
  strokeEdges(g, v, tiles, (id) => id === T.water, 'rgba(70,110,125,0.55)', v.S * 0.7, r);
  strokeEdges(g, v, tiles, (id) => id === T.water, INK, 1.2, r);
  g.restore();
  g.strokeStyle = 'rgba(40,85,100,0.7)'; g.lineWidth = 1; g.lineCap = 'round';
  for (let y = v.oy; y < v.oy + v.ht; y += 2) for (let x = v.ox; x < v.ox + v.wt; x += 3) {
    if (x < 0 || y < 0 || x >= W || y >= H || tiles[y][x] !== T.water || r() > 0.32) continue;
    const X = px(v, x) + r() * v.S, Y = py(v, y) + r() * v.S;
    g.beginPath(); g.moveTo(X - 4, Y); g.quadraticCurveTo(X - 2, Y - 2.5, X, Y); g.quadraticCurveTo(X + 2, Y + 2.5, X + 4, Y); g.stroke();
  }
  return c;
}

// ---------------------------------------------------------------- mapa global
function drawGlobalIcons(g: CanvasRenderingContext2D, v: View, tiles: number[][]) {
  const r = rng(99);
  const items: { y: number; draw: () => void }[] = [];
  const S = v.S;
  for (let ty = 2; ty < H - 2; ty++) for (let tx = 2; tx < W - 2; tx++) {
    const id = tiles[ty][tx], z = zoneAt(tx, ty);
    if (z === 'town' || ZONES[z]?.safe) continue;
    const X = px(v, tx) + S / 2 + (r() - 0.5) * S, Y = py(v, ty) + S;
    if (id === T.tree || id === T.tree2) { if (r() < 0.55) items.push({ y: Y, draw: () => tree(g, X, Y, 7.5, 'leaf') }); }
    else if (id === T.ftree || id === T.ftree2) { if (r() < 0.6) items.push({ y: Y, draw: () => tree(g, X, Y, 7.5, 'pine') }); }
    else if (id === T.red_tree) { if (r() < 0.5) items.push({ y: Y, draw: () => tree(g, X, Y, 7.5, z === 'ogre' ? 'dead' : 'red') }); }
    else if (id === T.red_rock) { if (r() < 0.5) items.push({ y: Y, draw: () => hill(g, X, Y, 7, '#cfa77c') }); }
    else if (id === T.swamp_tree) { if (r() < 0.4) items.push({ y: Y, draw: () => tree(g, X, Y, 7.5, 'dead') }); }
    else if (id === T.sandrock) { if (r() < 0.4) items.push({ y: Y, draw: () => hill(g, X, Y, 7, '#e0c98a') }); }
    else if (id === T.cactus) { if (r() < 0.6) items.push({ y: Y, draw: () => { g.save(); g.strokeStyle = INK; g.fillStyle = '#6fa356'; g.lineWidth = 1; g.fillRect(X - 1.4, Y - 8, 2.8, 8); g.strokeRect(X - 1.4, Y - 8, 2.8, 8); g.fillRect(X + 1.4, Y - 5.5, 3, 1.8); g.fillRect(X + 3, Y - 8, 1.8, 4); g.fillRect(X - 4.4, Y - 4.5, 3, 1.8); g.fillRect(X - 4.4, Y - 7, 1.8, 3); g.restore(); } }); }
    else if ((id === T.dune || id === T.dune2) && r() < 0.004) items.push({ y: Y, draw: () => hill(g, X, Y, 10, '#e3cb8c') });
    else if (id === T.grave || id === T.grave2) { if (r() < 0.5) items.push({ y: Y, draw: () => gravestone(g, X, Y, 6) }); }
    else if (id === T.stone && r() < 0.006) items.push({ y: Y, draw: () => mountain(g, X, Y, 12) });
    else if (id === T.red && r() < 0.008) items.push({ y: Y, draw: () => hill(g, X, Y, 11, '#d4a574') });
    else if (id === T.grass && z === 'fields' && r() < 0.0035) items.push({ y: Y, draw: () => hill(g, X, Y, 12, '#b9c986') });
  }
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
}

function drawGlobalLabels(g: CanvasRenderingContext2D, v: View) {
  const L = (zid: string, tx: number, ty: number, big = true) => {
    const z = ZONES[zid];
    halo(g, z.name.toUpperCase(), px(v, tx), py(v, ty), 15.5, { bold: true, color: '#5a2a1a', spacing: 3, halo: 5 });
    halo(g, z.levels, px(v, tx), py(v, ty) + 17, 12.5, { italic: true, color: INK2, halo: 3.5 });
  };
  L('fields', 300, 132); L('forest', 90, 270); L('crypt', 300, 30); L('orcs', 510, 285); L('ogre', 195, 412); L('swamp', 90, 18); L('desert', 510, 330);
  // cidade
  const x = px(v, CX), y = py(v, CY);
  g.save(); g.strokeStyle = INK; g.lineWidth = 1.4; g.fillStyle = '#e4d9b4';
  g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#9a9689'; g.beginPath(); g.arc(x, y, 28, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1; g.strokeStyle = INK; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; g.fillStyle = '#8a2f2a'; g.beginPath(); g.arc(x + Math.cos(a) * 28, y + Math.sin(a) * 28, 3.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.restore();
  houseIcon(g, x - 13, y + 5, 7); houseIcon(g, x + 13, y + 6, 7); houseIcon(g, x - 6, y + 14, 6); houseIcon(g, x + 8, y + 15, 6, '#2f7a5a');
  towerIcon(g, x, y + 4, 7, '#3d5a9a', 0.7, 1.9);
  halo(g, 'Pouso do Viajante', x, y + 46, 17, { bold: true, halo: 5 });
  for (const vl of VILLAGES) {
    const vx = px(v, vl.cx), vy = py(v, vl.cy);
    g.save(); g.fillStyle = 'rgba(232,214,166,0.6)'; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(vx, vy, 17, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    houseIcon(g, vx - 7, vy + 3, 6); houseIcon(g, vx + 7, vy + 4, 6); towerIcon(g, vx, vy + 2, 5, '#a5502f', 0.7, 1.7);
    halo(g, vl.name, vx, vy + 30, 13.5, { bold: true, halo: 4.5 });
  }
  g.save(); g.fillStyle = INK; g.font = `${14}px ${FONT}`; g.textAlign = 'center';
  g.restore();
  // masmorras
  const sub: Record<string, number> = { moinho: 0, goblin: 0, cripta: 0, fortaleza: 0, camara: 0 };
  for (const d of DUNGEONS) {
    const X = px(v, d.entrance.tx), Y = py(v, d.entrance.ty);
    dungeonIcon(g, d.id, X, Y, 9);
    halo(g, d.name, X, Y + 15 + sub[d.id], 13, { bold: true, halo: 4.5 });
  }
  dragon(g, px(v, 565), py(v, 255), 0.85);
  // viela até o moinho (estrada)
  g.save(); g.strokeStyle = 'rgba(70,45,20,0.75)'; g.setLineDash([5, 4]); g.lineWidth = 1.4; g.beginPath();
  g.moveTo(px(v, CX), py(v, CY + TOWN_R)); g.quadraticCurveTo(px(v, CX + 36), py(v, CY + 75), px(v, 377), py(v, 318)); g.stroke(); g.restore();
}

function compass(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 1.2; g.lineJoin = 'round';
  g.fillStyle = 'rgba(232,214,166,0.85)'; g.beginPath(); g.arc(0, 0, s * 0.62, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, s * 0.5, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) {
    g.save(); g.rotate((i * Math.PI) / 2);
    g.fillStyle = i === 0 ? '#a82a22' : INK2;
    g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.14, -s * 0.14); g.lineTo(-s * 0.14, -s * 0.14); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  g.save(); g.rotate(Math.PI / 4); g.fillStyle = 'rgba(90,65,38,0.6)';
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -s * 0.62); g.lineTo(s * 0.08, -s * 0.1); g.lineTo(-s * 0.08, -s * 0.1); g.closePath(); g.fill(); }
  g.restore();
  g.font = `700 ${s * 0.34}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', 0, -s * 1.28); g.fillText('S', 0, s * 1.28); g.fillText('L', s * 1.28, 0); g.fillText('O', -s * 1.28, 0);
  g.restore();
}

function frame(v: View, title: string, sub: string): HTMLCanvasElement {
  const c = mk(v.cw, v.ch), g = c.getContext('2d')!;
  g.strokeStyle = INK; g.lineJoin = 'round';
  // faixa de pergaminho externa + moldura dupla
  g.fillStyle = 'rgba(232,214,166,1)';
  g.beginPath(); g.rect(0, 0, v.cw, v.ch); g.rect(v.M, v.M + 4, v.wt * v.S, v.ht * v.S); g.fill('evenodd');
  g.lineWidth = 3; g.strokeRect(v.M - 1.5, v.M + 4 - 1.5, v.wt * v.S + 3, v.ht * v.S + 3);
  g.lineWidth = 1; g.strokeRect(10, 10, v.cw - 20, v.ch - 20);
  g.lineWidth = 1.2; g.strokeRect(14, 14, v.cw - 28, v.ch - 28);
  // padrão de corda na moldura
  g.save(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(90,65,38,0.55)';
  for (let x = 20; x < v.cw - 20; x += 9) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x + 5, 26); g.moveTo(x, v.ch - 18); g.lineTo(x + 5, v.ch - 26); g.stroke(); }
  for (let y = 20; y < v.ch - 20; y += 9) { g.beginPath(); g.moveTo(18, y); g.lineTo(26, y + 5); g.moveTo(v.cw - 18, y); g.lineTo(v.cw - 26, y + 5); g.stroke(); }
  g.restore();
  for (const [cx, cy] of [[14, 14], [v.cw - 14, 14], [14, v.ch - 14], [v.cw - 14, v.ch - 14]]) { g.fillStyle = '#a82a22'; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#e8d6a6'; g.beginPath(); g.arc(cx, cy, 2, 0, Math.PI * 2); g.fill(); }
  // faixa com o título
  const bw = Math.min(v.cw * 0.6, 520), bx = v.cw / 2 - bw / 2;
  g.fillStyle = '#efe0b0'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(bx - 24, 7); g.lineTo(bx - 6, 7); g.lineTo(bx - 6, 42); g.lineTo(bx - 24, 42); g.lineTo(bx - 14, 24.5); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(bx + bw + 24, 7); g.lineTo(bx + bw + 6, 7); g.lineTo(bx + bw + 6, 42); g.lineTo(bx + bw + 24, 42); g.lineTo(bx + bw + 14, 24.5); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#f3e7bd'; g.beginPath(); g.rect(bx, 3, bw, 42); g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  g.font = `700 22px ${FONT}`; (g as unknown as { letterSpacing: string }).letterSpacing = '2px'; g.fillText(title, v.cw / 2, 20);
  g.font = `italic 13px ${FONT}`; (g as unknown as { letterSpacing: string }).letterSpacing = '0px'; g.fillText(sub, v.cw / 2, 37);
  compass(g, v.cw - v.M - 52, v.ch - v.M - 56, 30);
  // barra de escala
  const sx = v.M + 16, sy = v.ch - v.M - 14, step = v.S * 10;
  g.lineWidth = 1.2; g.fillStyle = INK;
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#efe0b0' : INK; g.fillRect(sx + i * step * 0.5, sy, step * 0.5, 5); g.strokeRect(sx + i * step * 0.5, sy, step * 0.5, 5); }
  g.fillStyle = INK; g.font = `italic 12px ${FONT}`; g.textAlign = 'left'; g.fillText('0', sx - 2, sy - 7); g.fillText('20 passos', sx + step * 2 - 20, sy - 7);
  return c;
}

// ---------------------------------------------------------------- mapa da cidade
function wrap(text: string, n: number): string[] {
  const out: string[] = []; let cur = '';
  for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out;
}

function drawCityLayer(g: CanvasRenderingContext2D, v: View, tiles: number[][]) {
  const S = v.S, c0x = px(v, CX + 0.5), c0y = py(v, CY + 0.5);
  const r = rng(7);
  // fora da muralha: árvores esparsas; dentro: aquarela verde
  g.save(); g.beginPath(); g.arc(c0x, c0y, (TOWN_R - 0.2) * S, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(190,206,128,0.5)'; g.fillRect(0, 0, v.cw, v.ch);
  g.restore();
  // ruas e praça em pedra
  g.save(); g.filter = 'blur(0.8px)'; g.fillStyle = '#d8ccab';
  for (let y = v.oy; y < v.oy + v.ht; y++) for (let x = v.ox; x < v.ox + v.wt; x++) if (cat(tiles[y][x]) === 'paved') g.fillRect(px(v, x) - 0.5, py(v, y) - 0.5, S + 1, S + 1);
  g.restore();
  g.save(); g.fillStyle = 'rgba(120,95,60,0.45)';
  for (let y = v.oy; y < v.oy + v.ht; y++) for (let x = v.ox; x < v.ox + v.wt; x++) if (cat(tiles[y][x]) === 'paved' && r() < 0.5) g.fillRect(px(v, x) + r() * S, py(v, y) + r() * S, 2.2, 1.2);
  g.restore();
  strokeEdges(g, v, tiles, (id) => cat(id) === 'paved', 'rgba(70,50,25,0.7)', 1, r);
  // muralha circular
  g.save(); g.lineCap = 'butt';
  const R = (TOWN_R - 0.2) * S;
  g.strokeStyle = INK; g.lineWidth = 2.1 * S + 2; g.beginPath(); g.arc(c0x, c0y, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#a9a496'; g.lineWidth = 2.1 * S - 1; g.beginPath(); g.arc(c0x, c0y, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.arc(c0x, c0y, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.restore();
  // portões e torres
  const names = ['Portão Leste', 'Portão Sul', 'Portão Oeste', 'Portão Norte'];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, ux = Math.cos(a), uz = Math.sin(a);
    g.save(); g.translate(c0x + ux * R, c0y + uz * R); g.rotate(a);
    g.fillStyle = '#d8ccab'; g.fillRect(-S * 1.3, -S * 2.6, S * 2.6, S * 5.2);          // abertura do portão
    g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(-S * 1.3, -S * 2.6); g.lineTo(S * 1.3, -S * 2.6); g.moveTo(-S * 1.3, S * 2.6); g.lineTo(S * 1.3, S * 2.6); g.stroke();
    for (const sg of [-1, 1]) { g.fillStyle = '#8a2f2a'; g.beginPath(); g.arc(0, sg * S * 3.2, S * 1.25, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#c9c2b0'; g.beginPath(); g.arc(0, sg * S * 3.2, S * 0.55, 0, Math.PI * 2); g.fill(); }
    g.restore();
    halo(g, names[i], c0x + ux * (R + S * 4.6), c0y + uz * (R + S * 4.6) + (i === 3 ? -2 : i === 1 ? 4 : 0), 13, { italic: true, bold: true, halo: 4 });
  }
  for (let i = 0; i < 12; i++) {                                                         // torres da muralha
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12; if (Math.abs(Math.cos(a * 2)) > 0.97) continue;
    g.fillStyle = '#8a2f2a'; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.arc(c0x + Math.cos(a) * R, c0y + Math.sin(a) * R, S * 1.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#c9c2b0'; g.beginPath(); g.arc(c0x + Math.cos(a) * R, c0y + Math.sin(a) * R, S * 0.6, 0, Math.PI * 2); g.fill();
  }
  // casas de moradores
  for (const h of mapSource?.world.villageHouses ?? []) {
    g.save(); g.translate(px(v, h.cx), py(v, h.cz)); g.rotate(Math.atan2(h.fz, h.fx) - Math.PI / 2);
    g.fillStyle = '#efe2bd'; g.strokeStyle = INK; g.lineWidth = 1;
    const w = 4.0 * S, d = 2.0 * S;
    g.fillRect(-w / 2, -d / 2, w, d); g.strokeRect(-w / 2, -d / 2, w, d);
    g.fillStyle = '#b4452f'; g.fillRect(-w / 2 - 2, -d / 2 - 2, w + 4, d / 2 + 2); g.fillStyle = '#9a3a28'; g.fillRect(-w / 2 - 2, 0, w + 4, d / 2 + 2);
    g.strokeRect(-w / 2 - 2, -d / 2 - 2, w + 4, d + 4); g.beginPath(); g.moveTo(-w / 2 - 2, 0); g.lineTo(w / 2 + 2, 0); g.stroke();
    g.fillStyle = INK2; g.fillRect(-2, d / 2 + 1, 4, 3);
    g.restore();
  }
  // edifícios principais
  const ROOF: Record<string, string> = { tavern: '#a5502f', forge: '#6e6e7c', church: '#46639f', shop: '#3f8a68', barracks: '#355a9c', tower: '#4a3d8a' };
  for (const b of BUILDINGS.filter((q) => townOf(q) === 'pouso')) {
    const x = px(v, b.x0), y = py(v, b.y0), w = b.w * S, h = b.h * S;
    g.save(); g.strokeStyle = INK; g.lineWidth = 1.4; g.lineJoin = 'round';
    g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(x + 3, y + 3, w, h);                                     // sombra
    if (b.kind === 'tower') {
      const cx = x + w / 2, cy = y + h / 2;
      g.fillStyle = '#cfc6e6'; g.beginPath(); g.arc(cx, cy, Math.min(w, h) * 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = ROOF.tower; g.beginPath(); g.arc(cx, cy, Math.min(w, h) * 0.32, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = ROOF[b.kind] ?? '#b4452f'; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      if (b.kind === 'church') { g.fillRect(x + w * 0.3, y, w * 0.4, h); } else if (w >= h) { g.fillRect(x, y, w, h / 2); } else { g.fillRect(x, y, w / 2, h); }
      g.beginPath(); if (b.kind === 'church') { g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); } else if (w >= h) { g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); } else { g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); } g.stroke();
      // porta
      g.fillStyle = INK; const dw = S * 1.0;
      if (b.facing === 'S') g.fillRect(x + w / 2 - dw / 2, y + h - 2, dw, 5);
      else if (b.facing === 'N') g.fillRect(x + w / 2 - dw / 2, y - 3, dw, 5);
      else if (b.facing === 'E') g.fillRect(x + w - 2, y + h / 2 - dw / 2, 5, dw);
      else g.fillRect(x - 3, y + h / 2 - dw / 2, 5, dw);
    }
    if (b.kind === 'church') {                                                                                 // cruz dourada
      g.strokeStyle = '#f5d56a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.18); g.lineTo(x + w / 2, y + h * 0.5); g.moveTo(x + w / 2 - 6, y + h * 0.28); g.lineTo(x + w / 2 + 6, y + h * 0.28); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1;
    }
    g.restore();
    const lines = wrap(b.name, 15), by = b.kind === 'church' ? y + h * 0.62 : b.facing === 'N' ? y - 8 - (lines.length - 1) * 13 : y + h + 10 + (b.facing === 'S' ? 6 : 0);
    lines.forEach((ln, i) => halo(g, ln, x + w / 2, by + i * 13, 12.5, { bold: true, halo: 4 }));
  }
  // fonte da praça
  const fx = px(v, FOUNTAIN.x + 0.5), fy = py(v, FOUNTAIN.y + 0.5);
  g.save(); g.strokeStyle = INK; g.lineWidth = 1.4; g.fillStyle = '#b9b8c2'; g.beginPath(); g.arc(fx, fy, S * 1.9, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#7fb4d6'; g.beginPath(); g.arc(fx, fy, S * 1.4, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#d6ecff'; g.beginPath(); g.arc(fx, fy, S * 0.45, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(214,160,40,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.arc(fx, fy, S * 2.5, 0, Math.PI * 2); g.stroke(); // anel rúnico
  g.lineWidth = 1; g.strokeStyle = INK; g.fillStyle = '#ffd870';
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; g.beginPath(); g.arc(fx + Math.cos(a) * S * 1.65, fy + Math.sin(a) * S * 1.65, S * 0.25, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.restore();
  halo(g, 'Fonte de Teleporte', fx, fy + S * 2.9, 13, { italic: true, bold: true, halo: 4 });
  // bancos e canteiros da praça
  for (const [dx, dz] of [[-3.9, -3.0], [3.9, -3.0], [-3.9, 3.2], [3.9, 3.2], [-6.2, 0.1], [6.2, 0.1]]) { g.fillStyle = '#8a5a2e'; g.strokeStyle = INK; g.lineWidth = 0.8; g.fillRect(fx + dx * S - 5, fy + dz * S - 2, 10, 4); g.strokeRect(fx + dx * S - 5, fy + dz * S - 2, 10, 4); }
  for (const [dx, dz] of [[-2.6, -5.6], [2.6, -5.6], [-3.0, 6.0], [3.0, 6.0], [-7.4, -1.8], [7.4, -1.8], [-7.4, 2.0], [7.4, 2.0]]) {
    g.fillStyle = '#6d9a4a'; g.strokeStyle = INK; g.lineWidth = 0.8; g.beginPath(); g.arc(fx + dx * S, fy + dz * S, 4.6, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#ff6b8a', '#ffd23f', '#fff', '#b58cff'][i]; g.beginPath(); g.arc(fx + dx * S + (r() - 0.5) * 6, fy + dz * S + (r() - 0.5) * 6, 1.3, 0, Math.PI * 2); g.fill(); }
  }
  // árvores fora da muralha
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = (TOWN_R + 2.5 + r() * 2.5) * S, x = c0x + Math.cos(a) * d, y = c0y + Math.sin(a) * d;
    if (x < v.M + 8 || y < v.M + 12 || x > v.cw - v.M - 8 || y > v.ch - v.M - 8) continue;
    if (Math.abs(Math.cos(a)) < 0.12 || Math.abs(Math.sin(a)) < 0.12) continue;
    tree(g, x, y, 9, r() < 0.4 ? 'pine' : 'leaf');
  }
}

// ---------------------------------------------------------------- composição
interface Cache { terrain: HTMLCanvasElement; frame: HTMLCanvasElement; paper: HTMLCanvasElement; fog?: HTMLCanvasElement; fogVer?: number }
const cache: Partial<Record<MapKind, Cache>> = {};

function build(kind: MapKind): Cache {
  const v = VIEWS[kind], tiles = mapSource!.world.tiles;
  const paper = parchment(v.cw, v.ch, kind === 'global' ? 11 : 23);
  const terrain = paintLand(v, tiles, kind === 'global' ? 5 : 9);
  const tg = terrain.getContext('2d')!;
  if (kind === 'global') { drawGlobalIcons(tg, v, tiles); drawGlobalLabels(tg, v); } else drawCityLayer(tg, v, tiles);
  const fr = frame(v, kind === 'global' ? 'REINOS DE ALDORIA' : 'POUSO DO VIAJANTE', kind === 'global' ? 'Mapa do Reino — desenhado pelos passos do aventureiro' : 'Planta da vila murada — cada rua conta uma história');
  return { terrain, frame: fr, paper };
}

function fogFor(kind: MapKind, c: Cache): HTMLCanvasElement {
  const v = VIEWS[kind];
  if (c.fog && c.fogVer === exploredVersion) return c.fog;
  const ex = getExplored();
  const mask = mk(v.cw, v.ch), mg = mask.getContext('2d')!;
  mg.fillStyle = '#000'; mg.fillRect(0, 0, v.cw, v.ch);
  mg.globalCompositeOperation = 'destination-out';                                   // buracos onde já foi explorado
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (!ex[gy * GW + gx]) continue;
    mg.fillRect(px(v, gx * MCELL) - 1, py(v, gy * MCELL) - 1, MCELL * v.S + 2, MCELL * v.S + 2);
  }
  const soft = mk(v.cw, v.ch), sg = soft.getContext('2d')!;
  sg.filter = `blur(${v.S * 1.8}px)`; sg.drawImage(mask, 0, 0);
  // névoa: pergaminho em branco, escurecido, com hachuras e "terra incógnita"
  const fog = mk(v.cw, v.ch), fg = fog.getContext('2d')!;
  fg.drawImage(c.paper, 0, 0);
  fg.fillStyle = 'rgba(150,115,60,0.12)'; fg.fillRect(0, 0, v.cw, v.ch);
  fg.strokeStyle = 'rgba(110,80,40,0.14)'; fg.lineWidth = 1;
  for (let i = -v.ch; i < v.cw; i += 11) { fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i + v.ch, v.ch); fg.stroke(); }
  const rr = rng(3);
  fg.font = `italic 700 ${kind === 'global' ? 22 : 18}px ${FONT}`; fg.textAlign = 'center'; fg.fillStyle = 'rgba(110,80,40,0.38)';
  (fg as unknown as { letterSpacing: string }).letterSpacing = '4px';
  const spots = kind === 'global' ? 14 : 5;
  for (let i = 0; i < spots; i++) fg.fillText('Terra Incógnita', v.M + 80 + rr() * (v.wt * v.S - 160), v.M + 40 + rr() * (v.ht * v.S - 80));
  fg.globalCompositeOperation = 'destination-in'; fg.drawImage(soft, 0, 0);
  c.fog = fog; c.fogVer = exploredVersion;
  return fog;
}

/** Desenha o mapa no canvas (sem alterar o tamanho lógico) e marca a posição do jogador. */
export function drawMap(kind: MapKind, canvas: HTMLCanvasElement) {
  if (!mapSource) return;
  const v = VIEWS[kind];
  const c = (cache[kind] ??= build(kind));
  canvas.width = v.cw; canvas.height = v.ch;
  const g = canvas.getContext('2d')!;
  g.drawImage(c.paper, 0, 0);
  g.drawImage(c.terrain, 0, 0);
  g.drawImage(fogFor(kind, c), 0, 0);
  g.drawImage(c.frame, 0, 0);
  // marcador do jogador
  const p = mapSource.pos(), tx = p.x / TILE, ty = p.y / TILE;
  if (tx >= v.ox && tx <= v.ox + v.wt && ty >= v.oy && ty <= v.oy + v.ht) {
    const X = px(v, tx), Y = py(v, ty);
    g.save(); g.translate(X, Y);
    g.fillStyle = 'rgba(168,42,34,0.25)'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.6; g.fillStyle = '#d63a2e';
    g.beginPath(); g.moveTo(0, 1); g.bezierCurveTo(-11, -13, -8, -22, 0, -22); g.bezierCurveTo(8, -22, 11, -13, 0, 1); g.fill(); g.stroke();
    g.fillStyle = '#f7e9b8'; g.beginPath(); g.arc(0, -14, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
    halo(g, 'Você', X, Y - 31, 14, { bold: true, color: '#7a1a14', halo: 4.5 });
  }
}

export const resetMapCache = () => { delete cache.global; delete cache.city; };
