import * as THREE from 'three';
import { BuildingDef } from '../chapters/town';

const M = (c: string, e?: string) => new THREE.MeshLambertMaterial({ color: c, emissive: e ?? '#000000', flatShading: true });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);

/** Placa de madeira com o nome do edifício (sobre a entrada). */
export function signBoard(name: string, w = 3.0): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b4423'; g.fillRect(0, 0, 512, 112);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#5e3b1d' : '#74502a'; g.fillRect(0, i * 19, 512, 9); }
  g.strokeStyle = '#d8b25a'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 102);
  let fs = 46; g.font = `bold ${fs}px Georgia, serif`;
  while (g.measureText(name).width > 470 && fs > 18) { fs -= 2; g.font = `bold ${fs}px Georgia, serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#2a1608'; g.fillText(name, 258, 60);
  g.fillStyle = '#ffe9a8'; g.fillText(name, 256, 57);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * (112 / 512), 0.12), [M('#4a2d14'), M('#4a2d14'), M('#4a2d14'), M('#4a2d14'), new THREE.MeshLambertMaterial({ map: t }), M('#4a2d14')]);
  m.castShadow = true;
  return m;
}

function gable(len: number, span: number, height: number, mat: THREE.Material, alongX: boolean) {
  const sh = new THREE.Shape(); sh.moveTo(-span / 2, 0); sh.lineTo(span / 2, 0); sh.lineTo(0, height); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
  if (alongX) g.rotateY(Math.PI / 2);
  return mesh(g, mat);
}

function cross(h: number, mat: THREE.Material) {
  const c = new THREE.Group();
  c.add(box(0.22, h, 0.22, mat, 0, 0, 0), box(h * 0.62, 0.22, 0.22, mat, 0, h * 0.62, 0));
  return c;
}

function mug(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.42, 12), M('#d89a2b', '#3a2204'), 0, 0.21, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 12), M('#fff6dc'), 0, 0.46, 0));
  g.add(mesh(new THREE.SphereGeometry(0.17, 10, 8), M('#ffffff'), 0, 0.55, 0));
  const h = mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), M('#b07a1e'), 0.24, 0.22, 0); g.add(h);
  return g;
}

function sword(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.13, 1.5, 0.04, M('#d8dce8', '#2a2a3a'), 0, 0.28, 0));
  g.add(mesh(new THREE.ConeGeometry(0.065, 0.2, 4), M('#d8dce8'), 0, 1.88, 0));
  g.add(box(0.55, 0.1, 0.1, M('#d4a017'), 0, 0.2, 0));
  g.add(box(0.1, 0.38, 0.1, M('#4a2d14'), 0, -0.19, 0));
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M('#d4a017'), 0, -0.22, 0));
  return g;
}

export interface BuildingView { group: THREE.Group; w: number; d: number }

export function buildBuilding(b: BuildingDef, groundY: number): THREE.Group {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  const swp = b.facing === 'E' || b.facing === 'W';
  const W = swp ? b.h : b.w, D = swp ? b.w : b.h, hw = W / 2, hd = D / 2, front = hd; // frente = +z local
  const wood = M('#6b4423'), dark = M('#4a2d14'), stone = M('#8d8d98'), door = M('#3b2210');
  const warm = M('#ffd98a', '#a8741c');
  let wallC = '#e9dcc0', roofC = '#b8432f', wallH = 1.9;
  if (b.kind === 'tavern') { wallC = '#d9b98a'; roofC = '#8a3a22'; wallH = 2.1; }
  if (b.kind === 'forge') { wallC = '#9a9aa6'; roofC = '#4a4a56'; wallH = 2.0; }
  if (b.kind === 'church') { wallC = '#f1ecdf'; roofC = '#3d5a9a'; wallH = 2.8; }
  if (b.kind === 'shop') { wallC = '#e4c98c'; roofC = '#2f7a5a'; wallH = 2.0; }
  if (b.kind === 'barracks') { wallC = '#a9a39a'; roofC = '#2a4a8c'; wallH = 2.1; }
  const wallM = M(wallC), roofM = M(roofC);

  if (b.kind === 'tower') {
    // torre alta e redonda com chapéu de mago
    const r = Math.min(W, D) * 0.46;
    g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, 4.8, 14), M('#cfc6e6'), 0, 2.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.2, 14), stone, 0, 4.9, 0));
    g.add(mesh(new THREE.ConeGeometry(r * 1.35, 2.6, 14), M('#4a3d8a'), 0, 6.3, 0));
    g.add(mesh(new THREE.OctahedronGeometry(0.28), M('#ffe27a', '#d9a400'), 0, 7.8, 0));
    for (let i = 0; i < 3; i++) {
      const a = 0.9 + i * 2.1, wy = 3.0 + (i % 2) * 0.8;
      g.add(mesh(new THREE.BoxGeometry(0.4, 0.6, 0.12), M('#ffe9a8', '#b88a2a'), Math.sin(a) * r * 0.99, wy, -Math.cos(a) * r * 0.99).rotateY(a) as THREE.Mesh);
    }
    // anexo frontal com a porta
    g.add(box(2.6, 1.9, D * 0.5, M('#d9d0ee'), 0, 0, hd - D * 0.25 - 0.1));
    g.add(gable(D * 0.5 + 0.3, 3.0, 1.0, M('#4a3d8a'), false).translateY(1.9) as THREE.Mesh);
  } else {
    g.add(box(W - 0.15, wallH, D - 0.15, wallM));
    g.add(box(W + 0.05, 0.35, D + 0.05, stone));                       // soco de pedra
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.2, wallH + 0.1, 0.2, dark, sx * (hw - 0.08), 0, sz * (hd - 0.08)));
    const roofH = b.kind === 'church' ? 2.2 : 1.5;
    if (b.kind === 'church') {
      // nave longa: cumeeira ao longo de z
      const r = gable(D + 0.5, W + 0.5, roofH, roofM, false).translateY(wallH) as THREE.Mesh; g.add(r);
      // torre do sino na frente
      g.add(box(2.4, 5.0, 2.4, wallM, 0, 0, front - 1.0));
      g.add(box(2.7, 0.25, 2.7, stone, 0, 5.0, front - 1.0));
      g.add(mesh(new THREE.ConeGeometry(1.75, 2.8, 4).rotateY(Math.PI / 4), roofM, 0, 5.25 + 1.4, front - 1.0));
      const cr = cross(1.3, M('#f5d56a', '#a0760a')); cr.position.set(0, 8.1, front - 1.0); g.add(cr);
      const cr2 = cross(1.1, M('#f5d56a', '#a0760a')); cr2.position.set(0, wallH + roofH + 0.1, -hd + 0.5); g.add(cr2);
      // vitrais
      const glass = ['#4aa3ff', '#e0504a', '#f2c84a', '#7ee787'];
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
        const w = mesh(new THREE.BoxGeometry(0.08, 1.2, 0.55), M(glass[i], glass[i]), sx * (hw + 0.02), 1.5, -hd + 1.4 + i * 1.6);
        g.add(w);
      }
      g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16).rotateX(Math.PI / 2), M('#4aa3ff', '#2a6aa0'), 0, 4.0, front + 0.18)); // rosácea
    } else {
      g.add(gable(W + 0.9, D + 0.8, roofH, roofM, true).translateY(wallH) as THREE.Mesh);
      g.add(box(W + 0.9, 0.14, 0.2, dark, 0, wallH + roofH - 0.02, 0));
    }
    // janelas
    const nWin = Math.max(1, Math.floor((W - 3) / 2));
    if (b.kind !== 'church') for (let i = 0; i < nWin + 1; i++) for (const sx of [-1, 1]) {
      if (i === 0) continue;
      g.add(box(0.5, 0.5, 0.1, warm, sx * (0.9 + i * 0.9), 0.95, front + 0.0));
    }
    // chaminé
    if (b.kind === 'forge' || b.kind === 'tavern') {
      g.add(box(0.7, 1.8, 0.7, stone, hw - 1.0, wallH + 0.4, -hd + 1.0));
      g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), M('#ff9a3a', '#ff6a00'), hw - 1.0, wallH + 2.3, -hd + 1.0));
    }
  }

  // porta (arco) + degrau
  const doorW = b.kind === 'church' ? 1.3 : 1.0, doorH = b.kind === 'church' ? 2.0 : 1.5;
  const dz = b.kind === 'church' ? front + 0.2 : b.kind === 'tower' ? hd - 0.1 : front + 0.04;
  g.add(box(doorW + 0.3, doorH + 0.2, 0.1, dark, 0, 0, dz - 0.01));
  g.add(box(doorW, doorH, 0.12, door, 0, 0, dz + 0.01));
  g.add(mesh(new THREE.CylinderGeometry(doorW / 2, doorW / 2, 0.12, 12).rotateX(Math.PI / 2), door, 0, doorH, dz + 0.01));
  g.add(box(doorW + 0.8, 0.12, 0.6, stone, 0, 0, dz + 0.3));
  g.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), M('#ffd23f', '#a07a00'), doorW * 0.32, doorH * 0.5, dz + 0.09));

  // placa com o nome, sobre a entrada
  const sw = W <= 5 ? 2.5 : 3.3;
  const sign = signBoard(b.name, sw);
  const sy = (b.kind === 'church' ? doorH + 0.5 : doorH + 0.58);
  const sz = Math.max(dz + 0.2, front + 0.62);
  sign.position.set(0, sy, sz);
  g.add(sign);
  for (const sx of [-1, 1]) {
    g.add(box(0.09, sy + 0.4, 0.09, dark, sx * (sw / 2 - 0.05), 0, sz));                        // postes da placa
    g.add(box(0.07, 0.07, Math.max(0.1, sz - dz), dark, sx * (sw / 2 - 0.05), sy + 0.3, (sz + dz) / 2)); // braço até a parede
  }

  // emblema do ofício
  const em = new THREE.Group();
  const post = (e: THREE.Group, w = 1.5) => { for (const sx of [-1, 1]) g.add(box(0.08, e.position.y + 0.5, 0.08, dark, e.position.x + sx * (w / 2 - 0.03), 0, e.position.z)); };
  const ex = hw - 0.9, ey = 1.35, ez = front + 0.62;
  if (b.kind === 'tavern') {
    // tábua com duas canecas brindando
    em.add(box(1.5, 1.15, 0.1, dark, 0, 0, 0));
    const a = mug(); a.position.set(-0.32, 0.18, 0.2); a.rotation.z = -0.28; em.add(a);
    const c = mug(); c.position.set(0.32, 0.18, 0.2); c.rotation.z = 0.28; c.rotation.y = Math.PI; em.add(c);
    em.position.set(-hw + 1.05, ey - 0.3, ez - 0.02);
    g.add(em); post(em);
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12), M('#7a4a22'), hw - 0.6, 0.25, front + 0.5)); // barril
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12), M('#7a4a22'), hw - 1.3, 0.25, front + 0.6));
  } else if (b.kind === 'forge') {
    em.add(box(1.4, 1.5, 0.1, dark, 0, 0, 0));
    const s1 = sword(), s2 = sword();
    s1.position.set(0, 0.62, 0.12); s1.rotation.z = 0.7; s2.position.set(0, 0.62, 0.14); s2.rotation.z = -0.7;
    em.add(s1, s2);
    em.position.set(hw - 0.15 - 0.55, ey - 0.45, ez - 0.02);
    g.add(em); post(em);
    // bigorna
    g.add(box(0.7, 0.35, 0.4, M('#3a3a46'), -hw + 0.8, 0.0, front + 0.55), box(0.9, 0.18, 0.45, M('#555566'), -hw + 0.8, 0.35, front + 0.55));
  } else if (b.kind === 'church') {
    // crucifixo na fachada, sobre o portal
    const cr = cross(1.2, M('#f5d56a', '#a0760a')); cr.position.set(0, doorH + 1.0, front + 0.22); g.add(cr);
  } else if (b.kind === 'shop') {
    // frasco de poção e saco de moedas pendurados
    em.add(box(1.5, 1.1, 0.1, dark, 0, 0, 0));
    em.add(mesh(new THREE.SphereGeometry(0.32, 12, 10), M('#7ee787', '#2a8a3a'), -0.3, 0.45, 0.22));
    em.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8), M('#bfe8c8'), -0.3, 0.88, 0.22));
    em.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), M('#8a5a2a'), -0.3, 1.06, 0.22));
    em.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), M('#b8863a'), 0.36, 0.28, 0.22).translateY(0.05));
    em.add(mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12), M('#ffd23f', '#a07a00'), 0.36, 0.42, 0.45));
    em.position.set(-hw + 1.05, ey - 0.3, ez - 0.02);
    g.add(em); post(em);
    for (const [x, c] of [[hw - 0.7, '#e0504a'], [hw - 1.3, '#f2c84a']] as [number, string][]) g.add(box(0.5, 0.4, 0.5, M(c), x, 0, front + 0.5));
  } else if (b.kind === 'barracks') {
    em.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 6).rotateX(Math.PI / 2), M('#2a4a8c'), 0, 0.6, 0.1));
    em.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 6).rotateX(Math.PI / 2), M('#d8dce8'), 0, 0.6, 0.12));
    em.add(box(0.12, 0.7, 0.14, M('#d4a017'), 0, 0.25, 0.2), box(0.5, 0.12, 0.14, M('#d4a017'), 0, 0.5, 0.2));
    em.position.set(-hw + 0.9, ey - 0.1, ez - 0.02);
    g.add(em); post(em);
    for (const sx of [-1, 1]) { g.add(box(0.05, 1.8, 0.05, wood, sx * (hw - 0.4), 0, front + 0.45)); g.add(box(0.5, 0.8, 0.04, M(sx > 0 ? '#2a4a8c' : '#c0392b'), sx * (hw - 0.4) + 0.27, 0.9, front + 0.45)); }
  }
  void em;

  g.rotation.y = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[b.facing];
  root.position.set(b.x0 + b.w / 2, groundY, b.y0 + b.h / 2);
  return root;
}

/** Poste de luz da vila */
export function lampPost(x: number, z: number, gy: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.12, 2.2, 0.12, M('#3a3a46'), 0, 0, 0));
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), M('#ffe9a8', '#ffb03a'), 0, 2.35, 0));
  g.add(box(0.34, 0.08, 0.34, M('#3a3a46'), 0, 2.15, 0));
  g.position.set(x, gy, z);
  return g;
}

/** Muralha circular de pedra em volta da vila, com torres e portões nas 4 estradas. */
export function buildTownWall(cx: number, cy: number, R: number, gate: number, gy: number, title: string): THREE.Group {
  const g = new THREE.Group();
  g.position.y = gy;
  const stone = M('#9b9aa8'), top = M('#7d7c8a'), roof = M('#8a2f2a'), wood = M('#5a3520');
  const WH = 2.1, c0 = cx + 0.5, c1 = cy + 0.5, rm = R - 0.2, TH = 1.7;
  const merlons: THREE.Matrix4[] = [];
  const N = 120, len = (2 * Math.PI * rm) / N + 0.12;
  const gapHalf = gate + 0.5 + 0.2;
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2, x = c0 + Math.cos(a) * rm, z = c1 + Math.sin(a) * rm;
    if (Math.min(Math.abs(x - c0), Math.abs(z - c1)) <= gapHalf + 0.4 && (Math.abs(x - c0) <= gapHalf + 0.4 || Math.abs(z - c1) <= gapHalf + 0.4) && Math.hypot(x - c0, z - c1) > R - 3) {
      if (Math.abs(x - c0) <= gapHalf + 0.4 || Math.abs(z - c1) <= gapHalf + 0.4) continue;
    }
    const rot = -a + Math.PI / 2;                       // tangente
    const seg = new THREE.Group();
    seg.add(box(len, WH, TH, stone, 0, 0, 0));
    seg.add(box(len + 0.05, 0.18, TH + 0.1, top, 0, WH, 0));
    seg.position.set(x, 0, z); seg.rotation.y = -(a + Math.PI / 2) + Math.PI; g.add(seg);
    if (i % 2 === 0) for (const k of [-0.5, 0.5]) {
      const m = new THREE.Matrix4().makeTranslation(x + Math.cos(a + Math.PI / 2) * k * (len / 2), WH + 0.18 + 0.25, z + Math.sin(a + Math.PI / 2) * k * (len / 2));
      merlons.push(m);
    }
    void rot;
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), top, merlons.length);
  merlons.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true; g.add(im);
  const tower = (x: number, z: number, r: number, h: number) => {
    g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), stone, x, h / 2, z));
    g.add(mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.2, 12), top, x, h, z));
    g.add(mesh(new THREE.ConeGeometry(r * 1.35, h * 0.55, 12), roof, x, h + h * 0.28 + 0.1, z));
  };
  // torres entre os portões (diagonais)
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; tower(c0 + Math.cos(a) * rm, c1 + Math.sin(a) * rm, 1.5, 4.0); }
  for (let k = 0; k < 4; k++) { // torres menores a meio caminho
    const a = (k * Math.PI) / 2 + Math.PI / 8; tower(c0 + Math.cos(a) * rm, c1 + Math.sin(a) * rm, 1.15, 3.3);
    const b = (k * Math.PI) / 2 + (3 * Math.PI) / 8; tower(c0 + Math.cos(b) * rm, c1 + Math.sin(b) * rm, 1.15, 3.3);
  }
  // portões: duas torres, viga com placa e bandeiras
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, ux = Math.cos(a), uz = Math.sin(a), tx = -uz, tz = ux;
    const gx = c0 + ux * rm, gz = c1 + uz * rm, off = gate + 0.5 + 0.55;
    for (const sg of [-1, 1]) {
      const px = gx + tx * sg * off, pz = gz + tz * sg * off;
      tower(px, pz, 1.05, 3.4);
      const bx = px - ux * 1.2, bz = pz - uz * 1.2;
      g.add(box(0.06, 1.7, 0.06, wood, bx, 0.9, bz));
      g.add(box(Math.abs(tx) > 0.5 ? 0.55 : 0.04, 0.8, Math.abs(tx) > 0.5 ? 0.04 : 0.55, M('#c0392b'), bx, 1.1, bz));
    }
    const span = gate * 2 + 1 + 1.1;
    g.add(Math.abs(tx) > 0.5 ? box(span, 0.35, 0.5, wood, gx, 3.0, gz) : box(0.5, 0.35, span, wood, gx, 3.0, gz));
    const sign = signBoard(title, 2.6);
    sign.position.set(gx - ux * 0.42, 3.55, gz - uz * 0.42);
    sign.rotation.y = Math.atan2(-ux, -uz);
    g.add(sign);
  }
  return g;
}

/** Banco de madeira com pés de pedra; o lado de sentar olha para +z local (rotY gira). */
export function bench(x: number, z: number, gy: number, rotY: number): THREE.Group {
  const g = new THREE.Group();
  const wood = M('#8a5a2e'), stone = M('#8d8d98');
  g.add(box(1.5, 0.1, 0.5, wood, 0, 0.42, 0));
  g.add(box(1.5, 0.45, 0.08, wood, 0, 0.62, -0.24));
  for (const sx of [-1, 1]) g.add(box(0.14, 0.42, 0.46, stone, sx * 0.6, 0, 0));
  g.position.set(x, gy, z); g.rotation.y = rotY;
  return g;
}

/** Canteiro redondo de pedra com flores coloridas. */
export function flowerBed(x: number, z: number, gy: number, r = 0.8, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#ff6b8a', '#ffd23f', '#ffffff', '#b58cff', '#ff9a3a', '#7ec8ff'];
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.28, 14), M('#8d8d98'), 0, 0.14, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.06, 14), M('#4b3321'), 0, 0.29, 0));
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.78, h = 0.18 + rnd() * 0.18;
    g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, h, 4), M('#3f8a3a'), Math.cos(a) * d, 0.3 + h / 2, Math.sin(a) * d));
    g.add(mesh(new THREE.SphereGeometry(0.095, 7, 6), M(cols[Math.floor(rnd() * cols.length)]), Math.cos(a) * d, 0.32 + h, Math.sin(a) * d));
  }
  g.position.set(x, gy, z);
  return g;
}
