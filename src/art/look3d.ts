// Aplica a aparência (`Look`) a um personagem 3D: cabelo, olhos, rosto, adereço de cabeça e cor da roupa.
// O encaixe é medido na malha real da cabeça: lançamos raios contra a cabeça (já na pose do osso) e
// colamos cada peça na superfície, em vez de usar proporções fixas. Assim funciona igual nos 4 modelos KayKit,
// em qualquer raça/altura. As peças são filhas do osso da cabeça e seguem a animação.
import * as THREE from 'three';
import type { SkinnedActor } from './actors';
import { Look, OUTFIT_TINT } from '../data/looks';

const V3 = THREE.Vector3;
const HAT = /(Hat|Helmet)$/;
const mat = (c: string, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, emissive: e ? c : '#000', emissiveIntensity: e, side: THREE.DoubleSide });

/** Olhos desenhados no modelo (medidos): afastamento (fração da largura da cabeça) e altura (fração da altura, a partir do centro). */
const EYES: Record<string, { ex: number; ey: number }> = {
  Knight: { ex: 0.187, ey: -0.136 }, Mage: { ex: 0.184, ey: -0.039 }, Rogue: { ex: 0.181, ey: -0.079 }, Barbarian: { ex: 0.187, ey: -0.03 },
};

/** Superfície da cabeça em coordenadas do mundo, com lançamento de raios (Möller–Trumbore, dupla face). */
class Surface {
  private v: Float32Array;
  private ix: ArrayLike<number>;
  constructor(head: THREE.SkinnedMesh) {
    const pos = head.geometry.attributes.position;
    this.v = new Float32Array(pos.count * 3);
    const t = new V3();
    for (let i = 0; i < pos.count; i++) {
      t.fromBufferAttribute(pos, i); head.applyBoneTransform(i, t); t.applyMatrix4(head.matrixWorld);
      this.v[i * 3] = t.x; this.v[i * 3 + 1] = t.y; this.v[i * 3 + 2] = t.z;
    }
    this.ix = head.geometry.index ? head.geometry.index.array : Array.from({ length: pos.count }, (_, i) => i);
  }
  cast(o: THREE.Vector3, d: THREE.Vector3): THREE.Vector3 | null {
    const v = this.v, ix = this.ix;
    let best = Infinity;
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const e1x = v[b] - v[a], e1y = v[b + 1] - v[a + 1], e1z = v[b + 2] - v[a + 2];
      const e2x = v[c] - v[a], e2y = v[c + 1] - v[a + 1], e2z = v[c + 2] - v[a + 2];
      const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9) continue;
      const inv = 1 / det;
      const tx = o.x - v[a], ty = o.y - v[a + 1], tz = o.z - v[a + 2];
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const w = (d.x * qx + d.y * qy + d.z * qz) * inv;
      if (w < 0 || u + w > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t > 1e-5 && t < best) best = t;
    }
    return best === Infinity ? null : o.clone().addScaledVector(d, best);
  }
}

export function applyLook(a: SkinnedActor, look: Look, tone: string) {
  // --- roupa: tinge corpo, braços, pernas e capa ---
  const tint = OUTFIT_TINT[look.outfit];
  a.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !tint) return;
    if (/_(Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape)$/.test(o.name)) (m.material as THREE.MeshStandardMaterial).color.set(tint).multiplyScalar(1.7);
  });
  const head = a.head as THREE.SkinnedMesh | null, bone = a.headBone;
  if (!head || !bone || !(head as THREE.SkinnedMesh).isSkinnedMesh) return;

  // chapéu/elmo do modelo: só fica se o jogador escolheu "Da Classe"
  let hatShown = false;
  a.model.traverse((o) => {
    if (!HAT.test(o.name)) return;
    if (look.head === 'default') hatShown ||= o.visible; else o.visible = false;
  });

  a.model.updateMatrixWorld(true);
  const S = new Surface(head);
  const box = new THREE.Box3().setFromObject(head);
  const c = box.getCenter(new V3()), sz = box.getSize(new V3());
  const u = sz.y;                                   // unidade: altura da cabeça
  const eye = EYES[a.spec.model] ?? EYES.Knight;
  const E = c.y + eye.ey * sz.y;                    // altura dos olhos
  const EX = eye.ex * sz.x;                         // afastamento dos olhos
  const hairC = new THREE.Color(look.hairColor), skinC = new THREE.Color(tone);

  // --- cor do cabelo desenhado no modelo (cabelo, sobrancelhas, barba): vira a cor escolhida ---
  recolorBaked(a, head, c, E, u, look, hairC, skinC);

  const root = new THREE.Group();                   // peças em coordenadas do mundo (pose atual), presas ao osso
  root.name = 'look';
  root.matrixAutoUpdate = false;
  root.matrix.copy(bone.matrixWorld).invert();
  bone.add(root);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, p: THREE.Vector3, q?: THREE.Quaternion, s?: [number, number, number]) => {
    const me = new THREE.Mesh(geo, m);
    me.position.copy(p); if (q) me.quaternion.copy(q); if (s) me.scale.set(...s);
    me.castShadow = false; root.add(me); return me;
  };
  const qTo = (n: THREE.Vector3, up = new V3(0, 1, 0)) => new THREE.Quaternion().setFromUnitVectors(up, n);

  // ponto/normal da superfície à frente do rosto em (x, y)
  const front = (x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3; q: THREE.Quaternion } => {
    const hit = (xx: number, yy: number) => S.cast(new V3(xx, yy, c.z + 3), new V3(0, 0, -1));
    const p = hit(x, y) ?? new V3(x, y, c.z + sz.z * 0.4);
    const d = 0.03 * u;
    const px = hit(x + d, y), mx = hit(x - d, y), py = hit(x, y + d), my = hit(x, y - d);
    const n = new V3(0, 0, 1);
    if (px && mx && py && my) { n.copy(new V3().crossVectors(px.clone().sub(mx), py.clone().sub(my))); if (n.z < 0) n.negate(); n.normalize(); }
    return { p, n, q: qTo(n, new V3(0, 0, 1)) };
  };
  const out = (f: { p: THREE.Vector3; n: THREE.Vector3 }, k: number) => f.p.clone().addScaledVector(f.n, k * u);

  // anel horizontal da cabeça na altura y: centro e semi-eixos
  const ring = (y: number) => {
    const o = (dx: number, dz: number) => S.cast(new V3(c.x, y, c.z), new V3(dx, 0, dz));
    const r = o(1, 0), l = o(-1, 0), f = o(0, 1), b = o(0, -1);
    const x1 = r?.x ?? c.x + sz.x * 0.4, x0 = l?.x ?? c.x - sz.x * 0.4, z1 = f?.z ?? c.z + sz.z * 0.4, z0 = b?.z ?? c.z - sz.z * 0.4;
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 };
  };
  const pt = (th: number, ph: number, off = 0) => {      // ponto do crânio: th = ângulo a partir do topo, ph = 0 frente
    const d = new V3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
    const h = S.cast(c, d) ?? c.clone().addScaledVector(d, u * 0.45);
    return { p: h.clone().addScaledVector(d, off * u), d };
  };

  /** Casca que cobre o crânio acima de uma linha que depende da direção (fz: 1 frente, 0 lado, -1 nuca). */
  const shell = (m: THREE.Material, off: number, front: number, side: number, backY: number) => {
    const NP = 30, NR = 12;
    const pos: number[] = [], ids: number[] = [];
    const lim = (fz: number) => E + u * (fz >= 0 ? side + (front - side) * fz : side + (backY - side) * -fz);
    for (let i = 0; i < NP; i++) {
      const ph = (i / NP) * Math.PI * 2, sp = Math.sin(ph), cp = Math.cos(ph), yl = lim(cp);
      let thEnd = 0.15;
      for (let th = 0.1; th <= 2.5; th += 0.08) {
        const d = new V3(Math.sin(th) * sp, Math.cos(th), Math.sin(th) * cp);
        const h = S.cast(c, d);
        if (!h || h.y < yl) break;
        thEnd = th;
      }
      for (let j = 0; j <= NR; j++) {
        const q = pt((thEnd * j) / NR, ph, off);
        pos.push(q.p.x, q.p.y, q.p.z);
      }
    }
    for (let i = 0; i < NP; i++) for (let j = 0; j < NR; j++) {
      const a0 = i * (NR + 1) + j, b0 = ((i + 1) % NP) * (NR + 1) + j;
      ids.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ids); g.computeVertexNormals();
    return add(g, m, new V3());
  };

  const hairM = mat(look.hairColor), skinM = mat(tone);
  const sph = (n = 10) => new THREE.SphereGeometry(1, n, Math.round(n * 0.75));
  const cone = (n = 6) => new THREE.ConeGeometry(1, 1, n);
  const boxg = () => new THREE.BoxGeometry(1, 1, 1);
  const cylg = (n = 16) => new THREE.CylinderGeometry(1, 1, 1, n);

  // --- cabelo ---
  if (!hatShown && !['hood', 'helm', 'horns'].includes(look.head)) {
    const T = 0.032;                                 // espessura do cabelo
    /** cortina de cabelo que contorna a nuca e as laterais (abre à frente, onde fica o rosto) */
    const curtain = (yTop: number, h: number, span: number, pad = 0.05) => {
      const r = ring(E + yTop * u);
      const g = new THREE.CylinderGeometry(1, 1.14, 1, 28, 1, true, Math.PI - span / 2, span);
      add(g, hairM, new V3(r.cx, E + (yTop - h / 2) * u, r.cz - 0.02 * u), undefined, [r.rx + pad * u, h * u, r.rz + pad * u]);
    };
    const hatTop = look.head === 'witch' || look.head === 'feather';      // chapéus de aba: só o cabelo que sai por baixo
    const sh = (...args: Parameters<typeof shell>) => { if (!hatTop) shell(...args); };
    switch (hatTop && ['spiky', 'bun', 'mohawk', 'afro', 'short', 'none'].includes(look.hair) ? 'none' : look.hair) {
      case 'none': break;
      case 'short': shell(hairM, T, 0.17, 0.04, -0.2); break;
      case 'spiky': {
        shell(hairM, T, 0.17, 0.05, -0.15);
        const spike = (th: number, ph: number, len = 0.32) => { const q = pt(th, ph, T * 0.5); add(cone(5), hairM, q.p.clone().addScaledVector(q.d, len * u * 0.45), qTo(q.d), [0.1 * u, len * u, 0.1 * u]); };
        spike(0.05, 0, 0.4);
        for (let i = 0; i < 7; i++) spike(0.6, (i / 7) * Math.PI * 2 + 0.2, 0.3);
        for (let i = 0; i < 5; i++) spike(1.0, (i / 5) * Math.PI * 2 + 0.6, 0.26);
        break;
      }
      case 'long': sh(hairM, T, 0.17, -0.1, -0.4); curtain(0.0, 0.62, 3.6); break;
      case 'bob': sh(hairM, T, 0.17, -0.12, -0.14); curtain(0.0, 0.3, 3.4, 0.04); break;
      case 'pony': {
        sh(hairM, T, 0.17, 0.04, -0.2);
        const q = pt(1.95, Math.PI, 0.02);
        add(sph(), hairM, q.p.clone().addScaledVector(q.d, 0.06 * u), undefined, [0.1 * u, 0.1 * u, 0.1 * u]);
        add(cone(6), hairM, q.p.clone().add(new V3(0, -0.2 * u, -0.09 * u)), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI - 0.25, 0, 0)), [0.1 * u, 0.4 * u, 0.1 * u]);
        break;
      }
      case 'bun': {
        shell(hairM, T, 0.17, 0.04, -0.2);
        const q = pt(0.35, Math.PI, 0.08);
        add(sph(), hairM, q.p.clone().addScaledVector(q.d, 0.07 * u), undefined, [0.16 * u, 0.16 * u, 0.16 * u]);
        break;
      }
      case 'mohawk': {
        const crest: [number, number][] = [[1.0, 0], [0.7, 0], [0.4, 0], [0.12, 0], [0.3, Math.PI], [0.6, Math.PI], [0.9, Math.PI], [1.2, Math.PI], [1.45, Math.PI]];
        for (const [th, ph] of crest) { const q = pt(th, ph, 0.01); add(boxg(), hairM, q.p.clone().addScaledVector(q.d, 0.09 * u), qTo(q.d), [0.07 * u, 0.2 * u, 0.13 * u]); }
        break;
      }
      case 'afro': {
        shell(hairM, T, 0.2, 0.05, -0.2);
        const puff = (th: number, ph: number, r: number) => { const q = pt(th, ph, r * 0.8); add(sph(12), hairM, q.p, undefined, [r * u, r * u, r * u]); };
        puff(0.05, 0, 0.3);
        for (let i = 0; i < 8; i++) puff(0.65, (i / 8) * Math.PI * 2 + 0.2, 0.26);
        for (let i = 0; i < 9; i++) { const ph = (i / 9) * Math.PI * 2 + 0.1; if (Math.cos(ph) > 0.45) continue; puff(1.2, ph, 0.22); }
        break;
      }
      case 'braids': {
        sh(hairM, T, 0.17, 0.04, -0.2);
        for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
          const r = ring(E - 0.02 * u - i * 0.1 * u);
          add(sph(8), hairM, new V3(r.cx + s * (r.rx + 0.03 * u), E - 0.05 * u - i * 0.095 * u, r.cz - 0.12 * u - i * 0.01 * u), undefined, [0.065 * u, 0.075 * u, 0.065 * u]);
        }
        break;
      }
    }
  }

  // --- adereço de cabeça ---
  const gold = mat('#e8c050'), cloth = mat(tint ?? '#7a4ad0');
  const widest = (y0: number) => { let w = 0; for (let k = 0; k <= 3; k++) { const r = ring(y0 + k * 0.1 * u); w = Math.max(w, r.rx, r.rz); } return w; };   // maior raio do crânio acima de y0
  const band = (y: number, tube: number, m: THREE.Material, pad = 0.06) => {          // aro ao redor do crânio (por cima do cabelo)
    const r = ring(y);
    return add(new THREE.TorusGeometry(1, tube, 8, 28), m, new V3(r.cx, y, r.cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), [r.rx + pad * u, r.rz + pad * u, 1]);
  };
  switch (look.head) {
    case 'headband': band(E + 0.2 * u, 0.04, mat('#c83a3a')); break;
    case 'circlet': {
      band(E + 0.2 * u, 0.025, gold, 0.055);
      const f = front(c.x, E + 0.2 * u);
      add(sph(8), mat('#58d8ff', 0.7), out(f, 0.075), undefined, [0.035 * u, 0.045 * u, 0.03 * u]);
      break;
    }
    case 'crown': {
      const y = E + 0.26 * u, r = ring(y);
      add(cylg(24), gold, new V3(r.cx, y + 0.03 * u, r.cz), undefined, [r.rx + 0.06 * u, 0.11 * u, r.rz + 0.06 * u]);
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; add(cone(4), gold, new V3(r.cx + Math.sin(t) * (r.rx + 0.06 * u), y + 0.17 * u, r.cz + Math.cos(t) * (r.rz + 0.06 * u)), undefined, [0.045 * u, 0.15 * u, 0.045 * u]); }
      break;
    }
    case 'witch': {
      const y = E + 0.2 * u, r = ring(y), rr = widest(y);
      add(cylg(28), mat('#3a2a6a'), new V3(r.cx, y, r.cz), undefined, [rr * 1.9 + 0.1 * u, 0.03 * u, rr * 1.9 + 0.1 * u]);
      add(new THREE.ConeGeometry(1, 1, 20, 1, true), mat('#4a3a8a'), new V3(r.cx, y + 0.5 * u, r.cz - 0.02 * u), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, 0)), [rr + 0.12 * u, 1.1 * u, rr + 0.12 * u]);
      add(cylg(24), mat('#c8782a'), new V3(r.cx, y + 0.08 * u, r.cz), undefined, [rr + 0.075 * u, 0.1 * u, rr + 0.075 * u]);
      break;
    }
    case 'feather': {
      const y = E + 0.19 * u, r = ring(y), rr = widest(y);
      add(cylg(28), mat('#2a6a4a'), new V3(r.cx, y, r.cz), undefined, [rr * 1.7 + 0.1 * u, 0.03 * u, rr * 1.7 + 0.1 * u]);
      const ch = Math.max(0.24 * u, box.max.y - y + 0.07 * u);
      add(cylg(24), mat('#2a6a4a'), new V3(r.cx, y + ch / 2, r.cz), undefined, [rr + 0.065 * u, ch, rr + 0.065 * u]);
      add(cone(4), mat('#e04a6a'), new V3(r.cx + rr * 1.0, y + 0.3 * u, r.cz - rr * 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.75)), [0.05 * u, 0.5 * u, 0.02 * u]);
      break;
    }
    case 'hood': {
      shell(cloth, 0.075, 0.26, -0.02, -0.5);
      const r = ring(E - 0.2 * u);
      add(boxg(), cloth, new V3(r.cx, E - 0.45 * u, r.cz - r.rz - 0.06 * u), undefined, [r.rx * 2.1, 0.5 * u, 0.12 * u]);
      break;
    }
    case 'helm': case 'horns': {
      const iron = mat(look.head === 'helm' ? '#9a9aa5' : '#80808c');
      shell(iron, 0.05, 0.22, -0.1, -0.2);
      const f = front(c.x, E + 0.05 * u);
      add(boxg(), mat('#8a8a95'), out(f, 0.02), f.q.clone(), [0.06 * u, 0.0, 0.0]).visible = false;
      add(boxg(), mat('#8a8a95'), new V3(c.x, E + 0.07 * u, f.p.z + 0.04 * u), undefined, [0.06 * u, 0.33 * u, 0.05 * u]);
      if (look.head === 'horns') for (const s of [-1, 1]) {
        const q = pt(1.35, s * Math.PI / 2, 0.05);
        add(cone(7), mat('#efe6cf'), q.p.clone().add(new V3(s * 0.12 * u, 0.12 * u, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -s * 0.9)), [0.07 * u, 0.42 * u, 0.07 * u]);
      }
      break;
    }
  }

  // --- olhos: íris colorida colada sobre os olhos do modelo ---
  const shape = { round: [1, 1], big: [1.28, 1.32], narrow: [1.25, 0.62], slit: [0.8, 1.15] }[look.eyes] ?? [1, 1];
  const irisM = mat(look.eyeColor), pupM = mat('#0a0a0a'), glintM = mat('#ffffff', 0.6);
  for (const s of [-1, 1]) {
    const f = front(c.x + s * EX, E);
    const w = 0.052 * u * shape[0], h = 0.066 * u * shape[1];
    const iris = add(sph(14), irisM, out(f, 0.004), f.q, [w, h, 0.012 * u]);
    iris.quaternion.copy(f.q);
    add(sph(10), pupM, out(f, 0.008), f.q, [look.eyes === 'slit' ? w * 0.18 : w * 0.5, h * 0.62, 0.012 * u]);
    add(sph(6), glintM, out(f, 0.011).add(new V3(w * 0.3, h * 0.35, 0)), f.q, [w * 0.22, w * 0.22, 0.008 * u]);
  }

  // --- rosto ---
  const ink = mat('#1a1410');
  const ex = EX;
  switch (look.face) {
    case 'beard': {
      const f = front(c.x, E - 0.27 * u);
      add(sph(12), hairM, out(f, 0.02).add(new V3(0, -0.02 * u, -0.01 * u)), undefined, [0.27 * u, 0.2 * u, 0.15 * u]);
      for (const s of [-1, 1]) { const g = front(c.x + s * ex * 1.2, E - 0.2 * u); add(sph(10), hairM, out(g, 0.012), undefined, [0.1 * u, 0.17 * u, 0.1 * u]); }
      const m = front(c.x, E - 0.14 * u);
      add(boxg(), hairM, out(m, 0.01), m.q.clone(), [0.26 * u, 0.04 * u, 0.04 * u]);
      break;
    }
    case 'goatee': { const f = front(c.x, E - 0.29 * u); add(cone(6), hairM, out(f, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), [0.06 * u, 0.2 * u, 0.06 * u]); break; }
    case 'stache':
      for (const s of [-1, 1]) { const f = front(c.x + s * 0.06 * u, E - 0.145 * u); add(boxg(), hairM, out(f, 0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.35)).premultiply(f.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)))), [0.11 * u, 0.04 * u, 0.035 * u]); }
      break;
    case 'scar': { const f = front(c.x + ex * 1.05, E + 0.02 * u); add(boxg(), mat('#b8403a'), out(f, 0.008), f.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.5))), [0.018 * u, 0.3 * u, 0.012 * u]); break; }
    case 'paint':
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const f = front(c.x + s * ex * 1.15, E - 0.08 * u - i * 0.05 * u); add(boxg(), mat(i ? '#f4f0e0' : '#c83a3a'), out(f, 0.008), f.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.25))), [0.17 * u, 0.028 * u, 0.012 * u]); }
      break;
    case 'freckles':
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const f = front(c.x + s * (ex * 0.55 + (i % 3) * 0.04 * u), E - 0.07 * u - (i % 2) * 0.03 * u - (i > 2 ? 0.02 * u : 0)); add(sph(5), mat('#9a4a1e'), out(f, 0.004), undefined, [0.012 * u, 0.012 * u, 0.012 * u]); }
      break;
    case 'patch': {
      const f = front(c.x + ex, E);
      add(sph(12), ink, out(f, 0.012), f.q, [0.075 * u, 0.09 * u, 0.02 * u]);
      band(E + 0.08 * u, 0.012, ink, 0.03).rotation.z = 0.2;
      break;
    }
    case 'goggles': {
      band(E + 0.19 * u, 0.025, mat('#5a3a1a'), 0.06);
      for (const s of [-1, 1]) {
        const f = front(c.x + s * ex, E + 0.19 * u);
        add(new THREE.TorusGeometry(1, 0.28, 8, 18), mat('#9a6a2a'), out(f, 0.07), f.q, [0.065 * u, 0.065 * u, 0.065 * u]);
        add(sph(12), mat('#7ad0ff', 0.4), out(f, 0.07), f.q, [0.055 * u, 0.055 * u, 0.012 * u]);
      }
      break;
    }
  }
}

/** Troca a cor do cabelo/sobrancelhas/barba desenhados na textura da cabeça (por cor de vértice). */
const texCache = new WeakMap<object, { w: number; h: number; d: Uint8ClampedArray }>();
function recolorBaked(a: SkinnedActor, head: THREE.SkinnedMesh, c: THREE.Vector3, E: number, u: number, look: Look, hairC: THREE.Color, skinC: THREE.Color) {
  const m = head.material as THREE.MeshStandardMaterial;
  const img = m.map?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!img) return;
  let tex = texCache.get(img);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d')!; g.drawImage(img, 0, 0);
    tex = { w: cv.width, h: cv.height, d: g.getImageData(0, 0, cv.width, cv.height).data };
    texCache.set(img, tex);
  }
  const geo = head.geometry = head.geometry.clone();
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const cols = new Float32Array(pos.count * 3).fill(1);
  const t = new V3(), base = m.color.clone();
  // cor real da pele no modelo (média dos vértices de pele): evita diferença de tom ao "raspar" o cabelo
  const skinAvg = new THREE.Color(0, 0, 0); let ns = 0;
  for (let i = 0; i < pos.count; i++) {
    const px = Math.min(tex.w - 1, Math.floor(uv.getX(i) * tex.w)), py = Math.min(tex.h - 1, Math.floor(uv.getY(i) * tex.h));
    const k = (py * tex.w + px) * 4, r = tex.d[k], g = tex.d[k + 1], b = tex.d[k + 2];
    if (r >= 200 && g >= 150 && b >= 105 && r - b >= 45) { skinAvg.add(new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiply(base)); ns++; }
  }
  if (ns) skinAvg.multiplyScalar(1 / ns); else skinAvg.copy(skinC);
  const bald = look.hair === 'none' || look.hair === 'mohawk';
  const noBeard = a.spec.model === 'Barbarian' && look.face !== 'beard';
  for (let i = 0; i < pos.count; i++) {
    t.fromBufferAttribute(pos, i); head.applyBoneTransform(i, t); t.applyMatrix4(head.matrixWorld);
    const px = Math.min(tex.w - 1, Math.floor(uv.getX(i) * tex.w)), py = Math.min(tex.h - 1, Math.floor(uv.getY(i) * tex.h));
    const k = (py * tex.w + px) * 4, r = tex.d[k], g = tex.d[k + 1], b = tex.d[k + 2];
    const skin = r >= 200 && g >= 150 && b >= 105 && r - b >= 45;
    const dark = r < 70 && g < 70 && b < 70;
    const inEye = dark && t.y > E - 0.07 * u && t.y < E + 0.065 * u && t.z > c.z && Math.abs(t.x - c.x) < 0.3 * u;
    const metal = b >= g && g >= r && r + g + b > 400;
    const cloth = b > r + 25;
    if (skin || inEye || metal || cloth) continue;
    const beard = t.y < E - 0.06 * u && t.z > c.z;
    const target = beard ? (noBeard ? skinAvg : hairC) : (bald ? skinAvg : hairC);
    const orig = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiply(base);
    cols[i * 3] = Math.min(60, target.r / Math.max(0.02, orig.r));
    cols[i * 3 + 1] = Math.min(60, target.g / Math.max(0.02, orig.g));
    cols[i * 3 + 2] = Math.min(60, target.b / Math.max(0.02, orig.b));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  m.vertexColors = true; m.needsUpdate = true;
}
