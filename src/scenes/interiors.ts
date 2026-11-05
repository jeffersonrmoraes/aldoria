import * as THREE from 'three';
import { BuildingDef } from '../chapters/town';

const TILE = 16;
export interface InteriorNpc { id: string; name: string; x: number; y: number; face: number } // x,y em tiles (centro)
export interface InteriorView {
  group: THREE.Group; solid: Uint8Array; w: number; h: number;      // h inclui uma linha sólida extra além da porta
  start: { x: number; y: number }; exit: { x: number; y: number };  // px
  npcs: InteriorNpc[]; lights: THREE.Vector3[]; light: string; env: [string, string, number];
  pulse: (t: number) => void;
}

const cache = new Map<string, THREE.MeshLambertMaterial>();
const M = (c: string, e?: string) => {
  const k = c + (e ?? '');
  let m = cache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c, emissive: e ?? '#000000', flatShading: true }); cache.set(k, m); }
  return m;
};

function plankTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#cfcfcf' : '#e2e2e2'; g.fillRect(0, i * 16, 64, 15); g.fillStyle = '#9a9a9a'; g.fillRect(0, i * 16 + 15, 64, 1); g.fillRect(((i * 23) % 64), i * 16, 1, 15); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function flagTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#a0a0a0'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
  g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 64); g.moveTo(0, 32); g.lineTo(64, 32); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.position.set(x, y, z); return o; };

class B {
  group = new THREE.Group();
  solid: Uint8Array;
  lights: THREE.Vector3[] = [];
  glow: { m: THREE.MeshLambertMaterial; base: number }[] = [];
  constructor(public W: number, public H: number) { this.solid = new Uint8Array(W * (H + 1)); }
  mark(x0: number, z0: number, w: number, d: number) {
    for (let z = Math.floor(z0 + 1e-4); z < Math.ceil(z0 + d - 1e-4); z++) for (let x = Math.floor(x0 + 1e-4); x < Math.ceil(x0 + w - 1e-4); x++) if (x >= 0 && z >= 0 && x < this.W && z <= this.H) this.solid[z * this.W + x] = 1;
  }
  /** caixa por canto (x0,z0) em tiles, altura h, base em y */
  box(x0: number, z0: number, w: number, d: number, h: number, color: string, o: { solid?: boolean; y?: number; e?: string } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, o.e));
    m.position.set(x0 + w / 2, (o.y ?? 0) + h / 2, z0 + d / 2);
    m.castShadow = m.receiveShadow = true; this.group.add(m);
    if (o.solid) this.mark(x0, z0, w, d);
    return m;
  }
  cyl(x: number, z: number, r: number, h: number, color: string, o: { solid?: boolean; y?: number; e?: string; top?: number } = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.top ?? r, r, h, 12), M(color, o.e));
    m.position.set(x, (o.y ?? 0) + h / 2, z); m.castShadow = m.receiveShadow = true; this.group.add(m);
    if (o.solid) this.mark(x - r, z - r, r * 2, r * 2);
    return m;
  }
  sph(x: number, y: number, z: number, r: number, color: string, e?: string) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(color, e)); m.position.set(x, y, z); m.castShadow = true; this.group.add(m); return m;
  }
  light(x: number, y: number, z: number) { this.lights.push(new THREE.Vector3(x, y, z)); }
  plane(x0: number, z0: number, w: number, d: number, color: string, y = 0.02) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M(color));
    m.position.set(x0 + w / 2, y, z0 + d / 2); m.receiveShadow = true; this.group.add(m); return m;
  }
  barrel(x: number, z: number) { this.cyl(x, z, 0.4, 0.75, '#7a4a22', { solid: true, top: 0.34 }); this.cyl(x, z, 0.41, 0.06, '#3a3a46', { y: 0.2 }); this.cyl(x, z, 0.37, 0.06, '#3a3a46', { y: 0.5 }); }
  table(x: number, z: number, r = 0.6) {
    this.cyl(x, z, r, 0.1, '#8a5a2e', { y: 0.72, solid: true });
    this.cyl(x, z, 0.12, 0.72, '#5a3520');
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; this.cyl(x + Math.cos(a) * (r + 0.32), z + Math.sin(a) * (r + 0.32), 0.17, 0.38, '#6b4423'); }
  }
  mug(x: number, y: number, z: number) { this.cyl(x, z, 0.07, 0.15, '#d89a2b', { y }); this.sph(x, y + 0.17, z, 0.06, '#ffffff'); }
  bottle(x: number, y: number, z: number, c: string) { this.cyl(x, z, 0.07, 0.2, c, { y, e: c }); this.cyl(x, z, 0.03, 0.1, '#bfe8c8', { y: y + 0.2 }); }
  swordFlat(x: number, y: number, z: number, rot: number) {
    const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.03), M('#d8dce8', '#1a1a24')), 0, 0.5, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.05), M('#d4a017')), 0, 0.02, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), M('#4a2d14')), 0, -0.1, 0));
    g.position.set(x, y, z); g.rotation.z = rot; this.group.add(g);
  }
  fire(x: number, y: number, z: number, w: number) {
    const m = M('#ff8a2a', '#ff6a00'); const mm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.5), m); mm.position.set(x, y, z); this.group.add(mm);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), M('#ffd23f', '#ffb000')); c.position.set(x - w / 3 + (i * w) / 3, y + 0.35, z); this.group.add(c); }
    this.light(x, y + 1.0, z + 0.4);
  }
}

const DIM: Record<string, [number, number]> = { tavern: [14, 10], forge: [12, 9], church: [12, 20], shop: [12, 9], barracks: [12, 9], tower: [10, 10], archery: [12, 9], monk: [12, 9], rogue: [12, 9], cleric: [12, 9], druid: [12, 9], bard: [12, 9], necro: [12, 9], barbarian: [12, 9] };
const THEME: Record<string, { floor: string; wall: string; trim: string; env: [string, string, number] }> = {
  tavern: { floor: '#8a5a32', wall: '#b88a5a', trim: '#4a2d14', env: ['#1d1410', '#1d1410', 0.7] },
  forge: { floor: '#6b6b74', wall: '#8a8a96', trim: '#2f2f3a', env: ['#14110f', '#14110f', 0.66] },
  church: { floor: '#c9c4ba', wall: '#efe9dc', trim: '#c9a64a', env: ['#171a2a', '#171a2a', 0.78] },
  shop: { floor: '#9a6b3c', wall: '#d9c18a', trim: '#2f7a5a', env: ['#1c1510', '#1c1510', 0.72] },
  barracks: { floor: '#857560', wall: '#a39d93', trim: '#2a4a8c', env: ['#16140f', '#16140f', 0.7] },
  archery: { floor: '#8a6a3c', wall: '#cdb88a', trim: '#4f7a3a', env: ['#171a10', '#171a10', 0.72] },
  monk: { floor: '#b89a5a', wall: '#efe3c2', trim: '#c8932a', env: ['#1c1710', '#1c1710', 0.74] },
  rogue: { floor: '#4a4658', wall: '#6f6a7a', trim: '#3a3550', env: ['#0e0d16', '#0e0d16', 0.6] },
  cleric: { floor: '#cfc6a0', wall: '#f4ecd0', trim: '#d4a017', env: ['#1c1a14', '#1c1a14', 0.8] },
  druid: { floor: '#5a6a3a', wall: '#8a7a56', trim: '#3f7a3a', env: ['#101a10', '#101a10', 0.72] },
  bard: { floor: '#9a5a4a', wall: '#e0b0c0', trim: '#a83a6a', env: ['#1c1218', '#1c1218', 0.74] },
  necro: { floor: '#3a3a46', wall: '#4a4a56', trim: '#2a8a5a', env: ['#0a0e0e', '#0a0e0e', 0.55] },
  barbarian: { floor: '#6a4a2e', wall: '#8a6a4a', trim: '#6a2a1a', env: ['#1a120c', '#1a120c', 0.7] },
  tower: { floor: '#4a3f6a', wall: '#cfc6e6', trim: '#4a3d8a', env: ['#120e24', '#120e24', 0.68] },
};

export function buildInterior(def: BuildingDef): InteriorView {
  const [W, H] = DIM[def.kind], th = THEME[def.kind];
  const b = new B(W, H);
  const dx = Math.floor(W / 2);
  const npcs: InteriorNpc[] = [];

  // piso
  const tex = plankTexture(); tex.repeat.set(W / 2, H / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: th.floor, map: def.kind === 'church' || def.kind === 'forge' ? (() => { const t = flagTexture(); t.repeat.set(W / 2, H / 2); return t; })() : tex }));
  floor.position.set(W / 2, 0, H / 2); floor.receiveShadow = true; b.group.add(floor);
  // fora do edifício (vazio)
  const out = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: th.env[0] }));
  out.position.set(W / 2, -0.05, H / 2); b.group.add(out);

  // paredes (anel sólido, baixo o bastante para a câmera enxergar dentro)
  const WH = 1.55;
  const wall = (x: number, z: number, w: number, d: number) => {
    b.box(x, z, w, d, WH, th.wall, { solid: true });
    b.box(x - 0.03, z - 0.03, w + 0.06, d + 0.06, 0.12, th.trim, { y: WH });
  };
  wall(0, 0, W, 1); wall(0, 1, 1, H - 1); wall(W - 1, 1, 1, H - 1);
  wall(0, H - 1, dx - 1, 1); wall(dx + 1, H - 1, W - dx - 1, 1);
  for (let x = 0; x < W; x++) b.solid[H * W + x] = 1;
  b.box(dx - 1, H - 1, 2, 1, 0.1, th.trim, { y: 0 });                    // soleira
  b.plane(dx - 1, H - 2.2, 2, 1.4, '#6b2a1a', 0.03);                      // tapete da porta
  const bannerC = th.trim;
  for (const x of [2.5, W - 3.5]) { b.box(x, 0.05, 0.9, 0.06, 1.0, bannerC, { y: 0.25 }); }

  // ---------- decoração por tipo ----------
  if (def.kind === 'tavern') {
    b.plane(dx - 1, 3.5, 2, H - 5.5, '#7a2a22', 0.03);
    b.box(2.2, 3, 9.6, 1, 1.0, '#7a4a22', { solid: true });                     // balcão
    b.box(2.1, 2.95, 9.8, 1.1, 0.08, '#5a3520', { y: 1.0 });
    for (let i = 0; i < 7; i++) b.mug(3 + i * 1.25, 1.08, 3.5);
    b.box(2.2, 1.0, 9.6, 0.5, 1.7, '#5a3520', { solid: true });                 // prateleira de fundo
    for (let i = 0; i < 12; i++) b.bottle(2.6 + i * 0.78, 0.9 + (i % 2) * 0.55, 1.3, ['#7ee787', '#e0504a', '#f2c84a', '#60a5fa'][i % 4]);
    for (const [x, z] of [[1.6, 2.0], [1.6, 3.1], [1.6, 4.2], [W - 2.0, 5.2]] as [number, number][]) b.barrel(x, z);
    b.table(3, 6.4); b.table(W - 3.4, 6.4); b.table(3.4, 8.6 - 0.4); b.table(W - 3.8, 8.6 - 0.4);
    b.box(W - 2.6, 1.0, 1.3, 2.6, 1.7, '#6b6b74', { solid: true });             // lareira
    b.fire(W - 2.3, 0.35, 2.4, 0.9);
    b.light(dx, 2.6, 2.4);
    npcs.push({ id: 'innkeeper', name: def.npcs[0].name, x: dx + 0.5, y: 2.55, face: 0 });
  } else if (def.kind === 'forge') {
    b.box(W - 4.2, 1.0, 3.2, 2.2, 1.4, '#5a5a66', { solid: true });              // forja
    b.box(W - 3.7, 1.2, 2.2, 1.2, 0.3, '#2a2a30', { y: 1.4 });
    b.fire(W - 2.6, 1.8, 2.0, 1.7);
    b.box(W - 3.2, 1.0, 0.9, 0.9, 3.0, '#6b6b74');                                // chaminé
    b.box(2.0, 3.0, 1.5, 1.0, 0.45, '#3a3a46', { solid: true });                 // bigorna
    b.box(1.8, 3.0, 1.9, 0.9, 0.2, '#555566', { y: 0.45 });
    b.box(1.0, 1.0, 6.2, 0.4, 1.3, '#5a3520', { solid: true });                   // rack de armas
    for (let i = 0; i < 6; i++) b.swordFlat(1.4 + i, 0.55, 1.45, i % 2 ? 0.2 : -0.2);
    for (const x of [1.5, 8.5, 9.8]) { b.cyl(x, 5.6, 0.22, 0.9, '#8a8a96', { solid: true, y: 0.1 }); b.sph(x, 1.2, 5.6, 0.2, '#b8bcc8'); }
    b.box(3.2, 5.0, 5.6, 1, 1.0, '#7a4a22', { solid: true });                      // balcão
    b.box(3.1, 4.95, 5.8, 1.1, 0.08, '#5a3520', { y: 1.0 });
    b.swordFlat(4.4, 1.06, 5.5, 1.35); b.swordFlat(6.0, 1.06, 5.5, 1.5);
    b.barrel(W - 1.8, H - 2.3); b.cyl(W - 3.0, H - 2.2, 0.5, 0.45, '#3a6a9a', { solid: true });
    b.light(5.5, 2.6, 3.5);
    npcs.push({ id: 'smith', name: def.npcs[0].name, x: 6.4, y: 4.0, face: 0 });
  } else if (def.kind === 'church') {
    b.plane(dx - 1, 3, 2, H - 4.5, '#9a2a2a', 0.03);                               // tapete
    b.box(3.3, 1.2, 5.4, 1.6, 1.0, '#efe9dc', { solid: true });                    // altar
    b.box(3.1, 1.1, 5.8, 0.15, 1.05, '#c9a64a', { y: 1.0 });
    b.box(2.6, 3.4, 6.8, 2.6, 0.18, '#d8d2c4');                                    // degraus
    const cr = new THREE.Group(); cr.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.4, 0.18), M('#f5d56a', '#a0760a')), at(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.18), M('#f5d56a', '#a0760a')), 0, 0.3, 0));
    cr.position.set(dx, 1.5, 0.55); b.group.add(cr);
    for (const x of [4.4, 7.2]) { b.cyl(x, 1.7, 0.07, 0.4, '#fff6dc', { y: 1.05, e: '#ffcf66' }); b.light(x, 2.0, 2.2); }
    for (let i = 0; i < 5; i++) for (const x of [1.6, 8.0]) b.box(x, 7 + i * 2, 2.6, 0.7, 0.95, '#7a4a22', { solid: true });   // bancos
    const glass = ['#4aa3ff', '#e0504a', '#f2c84a', '#7ee787'];
    for (let i = 0; i < 5; i++) for (const x of [0.02, W - 0.12]) b.box(x, 2.2 + i * 3.4, 0.1, 1.0, 1.3, glass[(i + (x < 1 ? 0 : 2)) % 4], { y: 0.0 , e: glass[(i + (x < 1 ? 0 : 2)) % 4] });
    b.box(1.0, 3.2, 1.9, 2.1, 2.2, '#5a3520', { solid: true });                      // confessionário
    b.box(1.5, 3.4, 0.4, 1.5, 1.6, '#8a1f2a');                                         // cortina
    b.box(1.0, 3.0, 1.9, 0.15, 2.3, '#3b2210');
    b.cyl(W - 2.3, 4.6, 0.38, 0.9, '#cfc9bd', { solid: true }); b.cyl(W - 2.3, 4.6, 0.3, 0.05, '#4aa3ff', { y: 0.9, e: '#2a6aa0' }); // pia batismal
    b.light(dx, 2.4, 8); b.light(dx, 2.4, 14);
    npcs.push({ id: 'priest', name: def.npcs[0].name, x: 3.9, y: 4.3, face: -Math.PI / 2 });
    npcs.push({ id: 'healer', name: def.npcs[1].name, x: W - 3.4, y: 4.4, face: 0 });
  } else if (def.kind === 'shop') {
    b.box(1.0, 1.0, 10, 0.5, 1.9, '#6b4423', { solid: true });                         // estantes
    for (let i = 0; i < 15; i++) b.bottle(1.4 + i * 0.6, 0.9 + (i % 3) * 0.45, 1.3, ['#7ee787', '#e0504a', '#60a5fa', '#c084fc', '#f2c84a'][i % 5]);
    b.box(3.0, 5.0, 6, 1, 1.0, '#7a4a22', { solid: true });                              // balcão
    b.box(2.9, 4.95, 6.2, 1.1, 0.08, '#5a3520', { y: 1.0 });
    for (let i = 0; i < 4; i++) b.bottle(3.6 + i * 1.3, 1.08, 5.5, ['#7ee787', '#60a5fa', '#e0504a', '#c084fc'][i]);
    b.sph(8.2, 1.18, 5.5, 0.14, '#ffd23f', '#a07a00');
    for (const [x, z, c] of [[1.2, 3.2, '#a07a3a'], [1.2, 4.2, '#8a5a2a'], [2.1, 3.7, '#b8863a'], [W - 2.4, 3.2, '#a07a3a']] as [number, number, string][]) b.box(x, z, 0.8, 0.8, 0.7, c, { solid: true });
    b.barrel(W - 1.8, 2.4); b.barrel(W - 1.8, 3.6);
    for (const x of [3.4, 5.4, 7.4]) b.cyl(x, 0.9, 0.05, 0.6, '#7ee787', { y: 1.3, e: '#1a5a2a' });
    b.light(dx, 2.6, 3.5);
    npcs.push({ id: 'merchant', name: def.npcs[0].name, x: dx + 0.5, y: 3.9, face: 0 });
  } else if (def.kind === 'barracks') {
    b.box(1.0, 1.5, 0.5, 5, 1.3, '#5a3520', { solid: true });                           // rack de armas
    for (let i = 0; i < 5; i++) b.swordFlat(1.6, 0.55, 1.9 + i * 0.95, -0.2);
    for (const z of [2.6, 5.6]) { b.cyl(W - 2.5, z, 0.2, 1.1, '#8a6a3a', { solid: true, y: 0.15 }); b.sph(W - 2.5, 1.45, z, 0.28, '#d9b98a'); b.box(W - 3.2, z - 0.02, 1.4, 0.06, 0.06, '#5a3520', { y: 1.0 }); }
    b.box(3.4, 1.8, 5.2, 1.7, 0.85, '#7a4a22', { solid: true });                          // mesa de mapas
    b.plane(3.7, 2.0, 4.6, 1.1, '#e8d9a8', 0.0).position.y = 0.88;
    b.sph(5.0, 0.98, 2.5, 0.08, '#e0504a', '#a02020'); b.sph(7.1, 0.98, 2.7, 0.08, '#2a4a8c', '#102a6a');
    for (const x of [2.5, 9.0]) b.box(x, 0.08, 1.2, 0.08, 1.2, '#2a4a8c', { y: 0.2 });
    b.box(1.2, H - 3.0, 1.5, 0.9, 0.5, '#5a4a3a', { solid: true });                      // baú
    b.light(dx, 2.6, 3.5);
    npcs.push({ id: 'captain', name: def.npcs[0].name, x: dx + 0.5, y: 4.6, face: 0 });
  } else if (def.kind === 'archery') {
    b.box(1.0, 1.0, 10, 0.5, 1.9, '#6b4423', { solid: true });                          // parede de arcos
    for (let i = 0; i < 6; i++) { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 14, Math.PI), M('#8a5a2e')); bow.position.set(1.6 + i * 1.5, 1.2, 1.3); bow.rotation.z = -Math.PI / 2; b.group.add(bow); b.box(1.55 + i * 1.5, 1.18, 0.02, 0.02, 0.8, '#e8e0c8', { y: 0.8 }); }
    b.box(3.0, 5.0, 6, 1, 1.0, '#7a4a22', { solid: true });                              // balcão
    b.box(2.9, 4.95, 6.2, 1.1, 0.08, '#5a3520', { y: 1.0 });
    for (let i = 0; i < 5; i++) b.cyl(3.6 + i * 1.2, 5.5, 0.12, 0.5, '#8a5a2e', { y: 1.08 });                // aljavas
    for (let i = 0; i < 4; i++) { b.cyl(W - 2.0, 2.4 + i * 0.7, 0.28, 0.55, '#d8b24a', { solid: true }); }     // fardos de feno
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 18).rotateX(Math.PI / 2), M(k % 2 ? '#d63a2e' : '#f2ead0')); t.position.set(1.4 + k * 0.01, 1.0 + k * 0.01, 2.6 + k * 1.3); t.rotation.y = Math.PI / 2; b.group.add(t); }
    b.light(dx, 2.6, 3.5);
    npcs.push({ id: 'archer', name: def.npcs[0].name, x: dx + 0.5, y: 3.9, face: 0 });
  } else if (def.kind === 'monk') {
    b.plane(2.5, 2.2, W - 5, 4.2, '#a82a22', 0.03);                                       // tatame
    b.plane(2.9, 2.6, W - 5.8, 3.4, '#d9b98a', 0.035);
    for (const x of [2.2, W - 2.8]) { b.cyl(x + 0.3, 3.0, 0.14, 1.2, '#8a5a2e', { solid: true }); b.sph(x + 0.3, 1.45, 3.0, 0.24, '#d9b98a'); b.box(x - 0.2, 2.95, 1.0, 0.1, 0.1, '#8a5a2e', { y: 1.0 }); } // bonecos de treino
    b.cyl(W - 2.2, 1.6, 0.6, 0.06, '#d4a017', { y: 1.1, e: '#7a5a00' }); b.box(W - 3.0, 1.45, 1.6, 0.1, 1.6, '#5a3520', { solid: true }); // gongo
    b.box(1.0, 0.8, 0.5, 4, 1.3, '#5a3520', { solid: true });                              // prateleira de bastões
    for (let i = 0; i < 4; i++) b.box(1.15 + (i % 2) * 0.22, 0.9 + i * 0.9, 0.06, 0.7, 0.06, '#8a5a2e', { y: 0.9 });
    b.box(3.0, 6.0, 6, 0.9, 0.9, '#7a4a22', { solid: true });                              // balcão baixo
    for (let i = 0; i < 3; i++) b.cyl(3.6 + i * 1.6, 6.4, 0.07, 0.35, '#a82a22', { y: 0.9 });
    b.light(dx, 2.6, 4.0);
    npcs.push({ id: 'monk', name: def.npcs[0].name, x: dx + 0.5, y: 4.8, face: 0 });
  } else if (def.kind === 'rogue') {
    b.box(1.0, 1.0, 10, 0.5, 1.9, '#2e2a3a', { solid: true });
    for (let i = 0; i < 8; i++) b.swordFlat(1.5 + i * 1.1, 1.2 + (i % 2) * 0.3, 1.3, (i % 3 - 1) * 0.2);
    b.box(3.0, 5.0, 6, 1, 1.0, '#3a3248', { solid: true });                                // balcão escuro
    b.box(2.9, 4.95, 6.2, 1.1, 0.08, '#1e1a28', { y: 1.0 });
    for (let i = 0; i < 4; i++) b.swordFlat(3.6 + i * 1.5, 1.08, 5.5, Math.PI / 2);
    b.sph(8.0, 1.2, 5.5, 0.16, '#ffd23f', '#a07a00'); b.cyl(3.3, 5.5, 0.12, 0.12, '#b8863a', { y: 1.08 });
    for (const [x, z] of [[W - 2.4, 2.4], [W - 2.4, 3.4], [1.2, 3.4], [1.2, 4.4]] as [number, number][]) b.box(x, z, 0.8, 0.8, 0.8, '#4a3a2a', { solid: true });
    b.barrel(W - 1.8, 4.6);
    b.light(dx, 2.4, 3.5);
    npcs.push({ id: 'rogue', name: def.npcs[0].name, x: dx + 0.5, y: 3.9, face: 0 });
  } else if (['cleric', 'druid', 'bard', 'necro', 'barbarian'].includes(def.kind)) {
    const k = def.kind;
    b.box(1.0, 1.0, 10, 0.5, 1.9, k === 'necro' ? '#2e2e3a' : '#5a3520', { solid: true });          // estante do fundo
    b.box(3.0, 5.0, 6, 1, 1.0, k === 'necro' ? '#3a3a48' : '#7a4a22', { solid: true });              // balcão
    b.box(2.9, 4.95, 6.2, 1.1, 0.08, '#1e1a28', { y: 1.0 });
    if (k === 'cleric') {
      for (let i = 0; i < 6; i++) b.sph(1.6 + i * 1.4, 1.3, 1.3, 0.16, '#f5d56a', '#a0760a');
      b.cyl(dx, 2.0, 0.35, 0.9, '#d9d4c0', { solid: true });                                       // altar
      b.plane(dx - 1.2, 1.6, 2.4, 0.8, '#d4a017', 0.03);
      for (const x of [1.5, W - 2.0]) b.cyl(x, 6.8, 0.15, 1.4, '#d4a017', { solid: true });
    } else if (k === 'druid') {
      for (let i = 0; i < 5; i++) { b.cyl(1.6 + i * 1.7, 1.4, 0.3, 0.5, '#6b4423', { y: 0.2 }); b.sph(1.6 + i * 1.7, 1.0, 1.4, 0.3, '#58b060'); }
      b.cyl(W - 2.0, 6.0, 0.5, 1.8, '#5a3a1e', { solid: true }); b.sph(W - 2.0, 2.3, 6.0, 0.9, '#3f8a3a');
      b.plane(2.0, 6.5, 3, 2, '#4a8a3a', 0.03);
    } else if (k === 'bard') {
      for (let i = 0; i < 5; i++) { b.cyl(1.6 + i * 1.7, 1.3, 0.22, 0.9, '#a05a2a', { y: 0.5 }); }
      b.plane(2.5, 6.5, W - 5, 2.2, '#a83a6a', 0.03);                                                // palco
      b.cyl(W - 2.2, 6.5, 0.4, 0.7, '#d4a017', { solid: true });
      b.barrel(W - 1.8, 2.6);
    } else if (k === 'necro') {
      for (let i = 0; i < 6; i++) b.sph(1.5 + i * 1.5, 1.3, 1.3, 0.2, '#e8e4d0');                   // crânios
      b.box(dx - 1, 1.8, 2, 1.4, 0.7, '#4a4a56', { solid: true });                                 // sarcófago
      b.sph(dx, 1.2, 2.5, 0.12, '#7affb0', '#2aa060');
      for (const x of [1.4, W - 1.8]) b.cyl(x, 6.8, 0.18, 1.2, '#2a8a5a', { y: 0.1, e: '#1a6a3a' });
    } else {
      for (let i = 0; i < 6; i++) b.swordFlat(1.4 + i * 1.3, 1.2 + (i % 2) * 0.3, 1.3, (i % 3 - 1) * 0.3);
      b.cyl(W - 2.2, 6.0, 0.7, 0.9, '#5a3a1e', { solid: true });                                   // tambor de guerra
      b.barrel(1.4, 6.8); b.barrel(2.2, 6.9);
      b.plane(2.0, 6.5, 4, 2, '#6a2a1a', 0.03);
    }
    b.light(dx, 2.6, 3.5);
    npcs.push({ id: k, name: def.npcs[0].name, x: dx + 0.5, y: 3.9, face: 0 });
  } else {
    // torre do sábio
    for (let i = 0; i < 8; i++) { b.box(1 + i * 1.0, 1, 0.9, 0.6, 2.2, '#5a3520', { solid: i < 8 }); }
    b.box(1.0, 2.0, 0.6, 6, 2.2, '#5a3520', { solid: true });
    for (let k = 0; k < 28; k++) { const c = ['#c0392b', '#2a6aa0', '#2f7a5a', '#d4a017', '#6a3d9a'][k % 5]; b.box(1.1 + (k % 14) * 0.5, 0.35 + Math.floor(k / 14) * 0.7 + (k % 3) * 0.05, 1.5, 0.3, 0.45 + (k % 3) * 0.08, c, { y: 0.2 + Math.floor(k / 14) * 0.65 }); }
    const rune = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 6, 40).rotateX(Math.PI / 2), M('#b88aff', '#8a4aff')); rune.position.set(dx, 0.04, 4.4); b.group.add(rune);
    const rune2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 6, 32).rotateX(Math.PI / 2), M('#b88aff', '#8a4aff')); rune2.position.set(dx, 0.04, 4.4); b.group.add(rune2);
    b.cyl(dx, 3.2, 0.45, 1.0, '#6b6b74', { solid: true, top: 0.3 });
    const orb = b.sph(dx, 1.5, 3.2, 0.28, '#b88aff', '#8a4aff'); (orb as any).userData.orb = true;
    b.box(W - 2.6, 5.0, 1.4, 1.4, 0.8, '#7a4a22', { solid: true });
    b.cyl(W - 2.1, 6.3, 0.05, 1.3, '#d4a017', { y: 0.8 }); b.sph(W - 2.1, 2.2, 6.3, 0.14, '#ffe27a', '#d9a400');
    b.light(dx, 2.4, 3.2); b.light(3, 2.4, 6);
    npcs.push({ id: 'sage', name: def.npcs[0].name, x: dx + 0.5, y: 5.2, face: 0 });
  }

  const start = { x: dx * TILE, y: (H - 3) * TILE + 8 };
  const exit = { x: dx * TILE, y: (H - 1) * TILE + 8 };
  const orbs: THREE.Object3D[] = [];
  b.group.traverse((o) => { if (o.userData.orb) orbs.push(o); });
  return {
    group: b.group, solid: b.solid, w: W, h: H + 1, start, exit, npcs, lights: b.lights, light: '#ffb86a', env: th.env,
    pulse: (t) => { for (const o of orbs) o.position.y = 1.5 + Math.sin(t * 2) * 0.08; },
  };
}
