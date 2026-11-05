// Terreno e cenário 3D gerados a partir do mapa de tiles do capítulo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { F } from '../art/atlas';
import { H, TILE, W, WorldData, zoneAt, ZONES } from '../chapters/chapter1';
import { FOUNTAIN } from '../chapters/mapdims';
import { VILLAGES } from '../chapters/town';

const NAME: Record<number, string> = {};
for (const [k, v] of Object.entries(F)) NAME[v as number] = k;

const GROUND: Record<string, string> = {
  grass: '#6cbb4b', grass2: '#62b044', flowers: '#6cbb4b', bush: '#6cbb4b', tree: '#66b447', tree2: '#66b447',
  dirt: '#bb915f', dirt2: '#ae8655', dirt3: '#c29b69', plaza: '#d2c9b6', plaza2: '#c7bda9', plaza3: '#d8cfbd', water: '#2f6fb0', sand: '#e3cb8e',
  forest: '#3f8a4c', ftree: '#3f8a4c', ftree2: '#3f8a4c', red: '#b05a3e', red_rock: '#b05a3e', red_tree: '#b05a3e', bones: '#b05a3e',
  stone: '#7d82a0', grave: '#7d82a0', grave2: '#7d82a0',
  roof_l: '#6cbb4b', roof: '#6cbb4b', roof_r: '#6cbb4b', wall_l: '#6cbb4b', wall: '#6cbb4b', wall_w: '#6cbb4b', wall_r: '#6cbb4b', door: '#6cbb4b',
};
const FLAT = new Set(['dirt', 'dirt2', 'dirt3', 'plaza', 'plaza2', 'plaza3', 'roof_l', 'roof', 'roof_r', 'wall_l', 'wall', 'wall_w', 'wall_r', 'door', 'bones']);

function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface House { cx: number; cz: number; mats: THREE.Material[]; fade: number }
export interface Terrain {
  group: THREE.Group;
  houses: House[];
  groundY(px: number, py: number): number;
  solid: Uint8Array;
}

function col(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g.toNonIndexed() : g;
}
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => { g.deleteAttribute('uv'); return g; }))!;

function detailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 64, 64);
  const r = rng(7);
  for (let i = 0; i < 260; i++) {
    const v = 200 + Math.floor(r() * 55);
    g.fillStyle = `rgba(${v},${v},${v},0.55)`;
    g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 3));
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(150,150,150,0.35)'; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildTerrain(world: WorldData): Terrain {
  const group = new THREE.Group();
  const names = world.tiles.map((row) => row.map((t) => NAME[t]));
  const nameAt = (x: number, y: number) => names[Math.min(H - 1, Math.max(0, y))][Math.min(W - 1, Math.max(0, x))];

  // ---- relevo e cores por vértice ----
  const VW = W + 1, VH = H + 1;
  const hts = new Float32Array(VW * VH);
  const cols = new Float32Array(VW * VH * 3);
  const rnd = rng(99);
  const tmp = new THREE.Color();
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) {
    const adj = [nameAt(vx - 1, vy - 1), nameAt(vx, vy - 1), nameAt(vx - 1, vy), nameAt(vx, vy)];
    const flat = adj.some((n) => FLAT.has(n)) || !!ZONES[zoneAt(vx, vy)]?.safe;
    const water = adj.filter((n) => n === 'water').length;
    let h = (Math.sin(vx * 0.33) + Math.sin(vy * 0.27 + 1.3) + Math.sin((vx + vy) * 0.15) + 0.4 * Math.sin(vx * 0.9 + vy * 0.7)) * 0.1 + 0.18;
    if (flat) h *= 0.1;
    if (water) h = -0.1 - 0.12 * water;
    hts[vy * VW + vx] = h;
    let r = 0, g = 0, b = 0;
    for (const n of adj) {
      let key = n;
      if (n === 'water' && water < 3) key = 'sand';
      tmp.set(GROUND[key] ?? '#6cbb4b');
      r += tmp.r; g += tmp.g; b += tmp.b;
    }
    const j = 0.94 + rnd() * 0.1;
    const i = (vy * VW + vx) * 3;
    cols[i] = (r / 4) * j; cols[i + 1] = (g / 4) * j; cols[i + 2] = (b / 4) * j;
  }
  const pos = new Float32Array(VW * VH * 3), uv = new Float32Array(VW * VH * 2);
  for (let vy = 0; vy < VH; vy++) for (let vx = 0; vx < VW; vx++) {
    const i = vy * VW + vx;
    pos[i * 3] = vx; pos[i * 3 + 1] = hts[i]; pos[i * 3 + 2] = vy;
    uv[i * 2] = vx / 2; uv[i * 2 + 1] = vy / 2;
  }
  // chunks de 40x40 tiles: cada um com o próprio índice (mesmos vértices) para o frustum culling funcionar no mundo grande
  const CHK = 40;
  const tmat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTexture() });
  const posAttr = new THREE.BufferAttribute(pos, 3), colAttr = new THREE.BufferAttribute(cols, 3), uvAttr = new THREE.BufferAttribute(uv, 2);
  // normais calculadas uma vez numa geometria completa
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', posAttr);
  { const idx: number[] = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = y * VW + x, b = a + 1, c = a + VW, d = c + 1; idx.push(a, c, b, b, c, d); } full.setIndex(idx); full.computeVertexNormals(); }
  const nrmAttr = full.getAttribute('normal');
  for (let cy0 = 0; cy0 < H; cy0 += CHK) for (let cx0 = 0; cx0 < W; cx0 += CHK) {
    const idx: number[] = [];
    for (let y = cy0; y < Math.min(H, cy0 + CHK); y++) for (let x = cx0; x < Math.min(W, cx0 + CHK); x++) { const a = y * VW + x, b = a + 1, c = a + VW, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', posAttr); tg.setAttribute('color', colAttr); tg.setAttribute('uv', uvAttr); tg.setAttribute('normal', nrmAttr);
    tg.setIndex(idx);
    const x1 = Math.min(W, cx0 + CHK), y1 = Math.min(H, cy0 + CHK);
    tg.boundingSphere = new THREE.Sphere(new THREE.Vector3((cx0 + x1) / 2, 0, (cy0 + y1) / 2), Math.hypot(x1 - cx0, y1 - cy0) / 2 + 1);
    const ground = new THREE.Mesh(tg, tmat);
    ground.receiveShadow = true;
    group.add(ground);
  }

  const groundY = (px: number, py: number) => {
    const x = Math.min(W - 0.001, Math.max(0, px / TILE)), z = Math.min(H - 0.001, Math.max(0, py / TILE));
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const h = (a: number, b: number) => hts[b * VW + a];
    return (h(ix, iz) * (1 - fx) + h(ix + 1, iz) * fx) * (1 - fz) + (h(ix, iz + 1) * (1 - fx) + h(ix + 1, iz + 1) * fx) * fz;
  };

  // água
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#3d86d8', transparent: true, opacity: 0.82, shininess: 90, specular: new THREE.Color('#bfe0ff') }));
  water.position.set(W / 2, -0.08, H / 2);
  group.add(water);
  // chão ao redor do mapa
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3a6e3a' }));
  outer.position.set(W / 2, -0.4, H / 2);
  group.add(outer);

  // ---- colisão ----
  const solid = new Uint8Array(W * H);
  const BLOCK = new Set(['water', 'tree', 'tree2', 'bush', 'ftree', 'ftree2', 'red_rock', 'red_tree', 'grave', 'grave2', 'roof_l', 'roof', 'roof_r', 'wall_l', 'wall', 'wall_w', 'wall_r', 'door']);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (BLOCK.has(names[y][x])) solid[y * W + x] = 1;
  const FOUNTAINS = [FOUNTAIN, ...VILLAGES.map((v) => ({ x: v.cx, y: v.cy }))];
  for (const F0 of FOUNTAINS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) solid[(F0.y + dy) * W + F0.x + dx] = 1; // fonte da praça (3×3)

  // ---- adereços instanciados ----
  const treeRound = merge([
    col(new THREE.CylinderGeometry(0.1, 0.15, 0.7, 6).translate(0, 0.35, 0), '#7a4e2c'),
    col(new THREE.IcosahedronGeometry(0.56, 1).scale(1, 0.9, 1).translate(0, 1.1, 0), '#46a24a'),
    col(new THREE.IcosahedronGeometry(0.36, 1).translate(0.26, 1.4, 0.1), '#58b657'),
  ]);
  const treePine = merge([
    col(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 6).translate(0, 0.3, 0), '#6b4426'),
    col(new THREE.ConeGeometry(0.62, 0.95, 7).translate(0, 0.95, 0), '#2d7447'),
    col(new THREE.ConeGeometry(0.48, 0.85, 7).translate(0, 1.5, 0), '#38854f'),
    col(new THREE.ConeGeometry(0.33, 0.75, 7).translate(0, 2.0, 0), '#459a5c'),
  ]);
  const treeRed = merge([
    col(new THREE.CylinderGeometry(0.07, 0.13, 1.0, 5).translate(0, 0.5, 0), '#4e3226'),
    col(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5).rotateZ(0.9).translate(0.22, 0.95, 0), '#4e3226'),
    col(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 1.3, 0), '#c4552b'),
    col(new THREE.IcosahedronGeometry(0.3, 0).translate(0.3, 1.1, 0.12), '#dc7a3a'),
  ]);
  const bush = merge([
    col(new THREE.IcosahedronGeometry(0.4, 1).scale(1, 0.75, 1).translate(0, 0.28, 0), '#3f9a45'),
    col(new THREE.IcosahedronGeometry(0.26, 1).translate(0.28, 0.2, 0.1), '#58b455'),
  ]);
  const rock = merge([
    col(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.7, 0.9).translate(0, 0.25, 0), '#a2a2aa'),
    col(new THREE.IcosahedronGeometry(0.22, 0).translate(0.34, 0.12, 0.2), '#8e8e98'),
  ]);
  const graveA = merge([
    col(new THREE.BoxGeometry(0.5, 0.06, 0.8).translate(0, 0.03, 0.1), '#5a5a6c'),
    col(new THREE.BoxGeometry(0.42, 0.62, 0.12).translate(0, 0.34, -0.2), '#a6acc4'),
  ]);
  const graveB = merge([
    col(new THREE.BoxGeometry(0.5, 0.06, 0.8).translate(0, 0.03, 0.1), '#5a5a6c'),
    col(new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(0, 0.4, -0.2), '#b8b0a0'),
    col(new THREE.BoxGeometry(0.44, 0.1, 0.1).translate(0, 0.58, -0.2), '#b8b0a0'),
  ]);
  const flower = merge([
    col(new THREE.IcosahedronGeometry(0.07, 0).translate(-0.18, 0.1, 0.05), '#ffffff'),
    col(new THREE.IcosahedronGeometry(0.07, 0).translate(0.15, 0.1, -0.12), '#ffffff'),
    col(new THREE.IcosahedronGeometry(0.06, 0).translate(0.02, 0.09, 0.2), '#ffffff'),
  ]);
  const bone = merge([
    col(new THREE.BoxGeometry(0.4, 0.07, 0.08).rotateY(0.4).translate(-0.1, 0.05, 0), '#efe8d6'),
    col(new THREE.BoxGeometry(0.3, 0.07, 0.08).rotateY(-0.9).translate(0.15, 0.05, 0.12), '#e2dac6'),
    col(new THREE.IcosahedronGeometry(0.1, 0).translate(0.1, 0.08, -0.15), '#f4efe0'),
  ]);

  const lists: Record<string, THREE.Matrix4[]> = {};
  const colors: Record<string, THREE.Color[]> = {};
  const r = rng(4242);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const put = (k: string, x: number, z: number, sc: number, c: THREE.Color, jit = 0.22) => {
    const px = x + 0.5 + (r() - 0.5) * jit * 2, pz = z + 0.5 + (r() - 0.5) * jit * 2;
    e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e);
    v.set(px, groundY(px * TILE, pz * TILE), pz); s.setScalar(sc);
    m4.compose(v, q, s);
    const ck = `${k}|${Math.floor(x / 32)},${Math.floor(z / 32)}`;
    (lists[ck] ??= []).push(m4.clone()); (colors[ck] ??= []).push(c);
  };
  const hsl = (h: number, sat: number, l: number) => new THREE.Color().setHSL(h, sat, l);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = names[y][x];
    const edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
    const vary = new THREE.Color().setScalar(0.85 + r() * 0.3);
    if (n === 'tree' || n === 'tree2') put('round', x, y, 0.95 + r() * 0.5 + (edge ? 0.5 : 0), vary);
    else if (n === 'ftree' || n === 'ftree2') put('pine', x, y, 1.0 + r() * 0.6 + (edge ? 0.4 : 0), vary);
    else if (n === 'red_tree') put('red', x, y, 0.9 + r() * 0.5, vary);
    else if (n === 'bush') put('bush', x, y, 0.9 + r() * 0.4, vary);
    else if (n === 'red_rock') put('rockred', x, y, 0.9 + r() * 0.9, new THREE.Color(1.0, 0.62 + r() * 0.15, 0.5));
    else if (n === 'grave') put('graveA', x, y, 1, vary, 0.1);
    else if (n === 'grave2') put('graveB', x, y, 1, vary, 0.1);
    else if (n === 'flowers') { put('flower', x, y, 1.1, [hsl(0.95, 0.8, 0.7), hsl(0.13, 0.9, 0.65), hsl(0.6, 0.7, 0.75), new THREE.Color('#ffffff')][Math.floor(r() * 4)], 0.1); }
    else if (n === 'bones') put('bone', x, y, 1, vary, 0.2);
    else if (n === 'grass' && r() < 0.04) put('flower', x, y, 0.9, [hsl(0.95, 0.8, 0.7), hsl(0.13, 0.9, 0.65), new THREE.Color('#ffffff')][Math.floor(r() * 3)], 0.3);
  }
  const geos: Record<string, THREE.BufferGeometry> = { round: treeRound, pine: treePine, red: treeRed, bush, rockred: rock, graveA, graveB, flower, bone };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const k of Object.keys(lists)) {
    const kind = k.split('|')[0];
    const im = new THREE.InstancedMesh(geos[kind], mat, lists[k].length);
    lists[k].forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, colors[k][i]); });
    im.castShadow = kind !== 'flower' && kind !== 'bone'; im.receiveShadow = false;
    group.add(im);
  }

  // ---- ruas e praça de pedra em tijolinhos ----
  {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7a7466'; g.fillRect(0, 0, 128, 128);                         // argamassa
    const br = rng(11);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 16 : 0;
      for (let k = -1; k < 5; k++) {
        const v = 168 + Math.floor(br() * 46);
        g.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
        g.fillRect(k * 32 + off + 1.5, row * 16 + 1.5, 29, 13);
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(k * 32 + off + 1.5, row * 16 + 1.5, 29, 2);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(k * 32 + off + 1.5, row * 16 + 12.5, 29, 2);
      }
    }
    const bt = new THREE.CanvasTexture(c); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 8;
    const pp: number[] = [], pu: number[] = [], pc: number[] = [], pi: number[] = [];
    const jr = rng(5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!names[y][x].startsWith('plaza')) continue;
      const base = pp.length / 3, k = 0.88 + jr() * 0.18;
      for (const [vx, vy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
        pp.push(vx, hts[vy * VW + vx] + 0.03, vy); pu.push(vx - x, vy - y); pc.push(k, k, k);
      }
      pi.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    if (pi.length) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      bg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
      bg.setIndex(pi); bg.computeVertexNormals();
      const bm = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ vertexColors: true, map: bt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      bm.receiveShadow = true; group.add(bm);
    }
  }

  // ---- casas ----
  const houses: House[] = [];
  const flowerCols = ['#ff6b8a', '#ffd23f', '#ffffff', '#b58cff', '#ff9a3a'];
  const hr = rng(31);
  for (const vh of world.villageHouses) {
    const h = new THREE.Group();
    const wallMat = new THREE.MeshLambertMaterial({ color: ['#e9dcc0', '#e4d0a8', '#efe6d2', '#d8c8a8'][Math.floor(hr() * 4)] });
    const beamMat = new THREE.MeshLambertMaterial({ color: '#7a4e2c' });
    const roofMat = new THREE.MeshLambertMaterial({ color: ['#b8432f', '#a63a2a', '#c4553a', '#9a4a30'][Math.floor(hr() * 4)], flatShading: true });
    const doorMat = new THREE.MeshLambertMaterial({ color: '#5a3520' });
    const winMat = new THREE.MeshLambertMaterial({ color: '#9fd6ff', emissive: '#3a6a90' });
    const chimMat = new THREE.MeshLambertMaterial({ color: '#8a8a94' });
    houses.push({ cx: vh.cx, cz: vh.cz, mats: [wallMat, beamMat, roofMat, doorMat, winMat, chimMat], fade: 0 });
    const gy = groundY(vh.cx * TILE, vh.cz * TILE);
    h.position.set(vh.cx, gy, vh.cz);
    h.rotation.y = Math.atan2(vh.fx, vh.fz);               // +z local = lado da porta
    const walls = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.6, 1.9).translate(0, 0.8, 0), wallMat);
    walls.castShadow = walls.receiveShadow = true; h.add(walls);
    for (const dx of [-1.95, 1.95]) h.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 2.0).translate(dx, 0.85, 0), beamMat), { castShadow: true }));
    const shape = new THREE.Shape(); shape.moveTo(-1.2, 0); shape.lineTo(1.2, 0); shape.lineTo(0, 1.2); shape.closePath();
    const roofG = new THREE.ExtrudeGeometry(shape, { depth: 4.5, bevelEnabled: false }).translate(0, 0, -2.25).rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(roofG, roofMat); roof.position.set(0, 1.55, 0);
    roof.castShadow = true; h.add(roof);
    h.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, 0.2).translate(0, 2.78, 0), beamMat), { castShadow: true }));
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.08).translate(-0.9, 0.5, 0.97), doorMat));
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.08).translate(0.9, 0.95, 0.97), winMat));
    h.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3).translate(1.2, 2.0, -0.3), chimMat), { castShadow: true }));
    // canteiro de flores ao lado da porta
    const bed = new THREE.Group();
    bed.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.34).translate(0, 0.09, 0), new THREE.MeshLambertMaterial({ color: '#8d8d98' })));
    for (let i = 0; i < 5; i++) bed.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5).translate(-0.4 + i * 0.2, 0.28, (hr() - 0.5) * 0.14), new THREE.MeshLambertMaterial({ color: flowerCols[Math.floor(hr() * 5)] })));
    bed.position.set(0.9, 0, 1.2); h.add(bed);
    group.add(h);
  }

  // ---- fonte da praça ----
  for (const F0 of FOUNTAINS) {
  const fountain = new THREE.Group();
  fountain.position.set(F0.x + 0.5, groundY(F0.x * TILE, F0.y * TILE), F0.y + 0.5);
  fountain.scale.setScalar(1.5);
  const stone = new THREE.MeshLambertMaterial({ color: '#b8bccb' });
  fountain.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.4, 16).translate(0, 0.2, 0), stone), { castShadow: true, receiveShadow: true }));
  fountain.add(new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.04, 16).translate(0, 0.38, 0), new THREE.MeshPhongMaterial({ color: '#4aa3e8', shininess: 100 })));
  fountain.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8).translate(0, 0.8, 0), stone), { castShadow: true }));
  fountain.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8).translate(0, 1.4, 0), new THREE.MeshPhongMaterial({ color: '#9ad8ff', emissive: '#2a6aa0', transparent: true, opacity: 0.85 })));
  group.add(fountain);
  }

  return { group, houses, groundY, solid };
}
