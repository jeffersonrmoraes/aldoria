// Geometria 3D de masmorras (piso de lajes, muros baixos tipo corte, braseiros) e portais.
import * as THREE from 'three';
import type { DungeonMap } from '../chapters/dungeon';
import type { DungeonDef } from '../chapters/story1';

export interface DungeonView { group: THREE.Group; solid: Uint8Array; braziers: THREE.Vector3[]; w: number; h: number }

function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function slabTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 64);
  const r = rng(5);
  for (let i = 0; i < 140; i++) { const v = 170 + Math.floor(r() * 70); g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1 + Math.floor(r() * 3), 1); }
  g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildDungeon(dg: DungeonMap, def: DungeonDef): DungeonView {
  const group = new THREE.Group();
  const { w, h, floor } = dg;
  const r = rng(def.seed * 7 + 1);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i++) solid[i] = floor[i] ? 0 : 1;
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && floor[y * w + x] === 1;

  // piso
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const base = new THREE.Color(def.theme.floor), tmp = new THREE.Color();
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!isFloor(x, y)) continue;
    const k = 0.82 + r() * 0.3;
    tmp.copy(base).multiplyScalar(k);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(x + dx, 0, y + dy); col.push(tmp.r, tmp.g, tmp.b); uv.push(dx, dy); }
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4;
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fg.setIndex(idx); fg.computeVertexNormals();
  const floorMesh = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true, map: slabTexture() }));
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // muros baixos (apenas os que encostam no piso)
  const wallTiles: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (isFloor(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) { near = true; break; }
    if (near) wallTiles.push([x, y]);
  }
  const wallGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const wallMat = new THREE.MeshLambertMaterial({ color: def.theme.wall });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallTiles.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  wallTiles.forEach(([x, y], i) => {
    const hh = 1.25 + r() * 0.5;
    m.compose(new THREE.Vector3(x + 0.5, 0, y + 0.5), new THREE.Quaternion(), new THREE.Vector3(1, hh, 1));
    walls.setMatrixAt(i, m);
    c.set('#ffffff').multiplyScalar(0.75 + r() * 0.5);
    walls.setColorAt(i, c);
  });
  walls.castShadow = true; walls.receiveShadow = true;
  group.add(walls);

  // pilares no salão do chefe (colisão) e adereços espalhados
  const rooms = dg.rooms;
  const last = rooms[rooms.length - 1];
  const pillarMat = new THREE.MeshLambertMaterial({ color: def.theme.wall });
  for (const { x: px, y: py } of dg.pillars) {
    solid[py * w + px] = 1;
    group.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.0, 10).translate(px + 0.5, 1.0, py + 0.5), pillarMat), { castShadow: true, receiveShadow: true }));
  }
  const wood = new THREE.MeshLambertMaterial({ color: '#7a5330' }), bone = new THREE.MeshLambertMaterial({ color: '#e8e0cc' }), rug = new THREE.MeshLambertMaterial({ color: '#6a2030' });
  rooms.forEach((o, i) => {
    if (i === 0) return;
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const side = Math.floor(r() * 4);
      const x = side < 2 ? o.x + (side === 0 ? 0 : o.w - 1) : o.x + 1 + Math.floor(r() * (o.w - 2));
      const y = side < 2 ? o.y + 1 + Math.floor(r() * (o.h - 2)) : o.y + (side === 2 ? 0 : o.h - 1);
      if (solid[y * w + x]) continue;
      const kind = r();
      let mesh: THREE.Mesh;
      if (kind < 0.4) mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7).translate(0, 0.35, 0), wood);
      else if (kind < 0.75) mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 9).translate(0, 0.4, 0), wood);
      else mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0).scale(1.6, 0.6, 1).translate(0, 0.1, 0), bone);
      mesh.position.set(x + 0.5, 0, y + 0.5); mesh.rotation.y = r() * 6; mesh.castShadow = true;
      group.add(mesh);
    }
  });
  const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, last.h - 4).rotateX(-Math.PI / 2), rug);
  rugMesh.position.set(last.x + last.w / 2, 0.02, last.y + last.h / 2);
  group.add(rugMesh);

  // braseiros
  const stone = new THREE.MeshLambertMaterial({ color: '#4a4650' });
  const flameMat = new THREE.MeshBasicMaterial({ color: def.theme.light });
  const lights: THREE.Vector3[] = [];
  for (const b of dg.braziers) {
    if (!isFloor(b.x, b.y)) continue;
    const g = new THREE.Group();
    g.position.set(b.x + 0.5, 0, b.y + 0.5);
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.5, 8).translate(0, 0.25, 0), stone), { castShadow: true }));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 7).translate(0, 0.72, 0), flameMat));
    group.add(g);
    lights.push(new THREE.Vector3(b.x + 0.5, 1.2, b.y + 0.5));
  }
  return { group, solid, braziers: lights, w, h };
}

/** Arco de portal brilhante (entrada de masmorra no mundo ou saída dentro dela). */
export function buildPortal(color: string): { group: THREE.Group; update(t: number): void } {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#8a8794', flatShading: true });
  for (const s of [-1, 1]) g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 0.6).translate(s * 1.15, 1.4, 0), stone), { castShadow: true }));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.55, 0.7).translate(0, 3.0, 0), stone), { castShadow: true }));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.8).translate(0, 3.45, 0), stone), { castShadow: true }));
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.7).translate(0, 1.35, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(inner);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40).rotateX(-Math.PI / 2).translate(0, 0.06, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  g.add(ring);
  return { group: g, update(t) { (inner.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2.4) * 0.15; ring.scale.setScalar(1 + Math.sin(t * 2) * 0.05); } };
}
