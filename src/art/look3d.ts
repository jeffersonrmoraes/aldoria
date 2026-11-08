// Aplica a aparência (`Look`) a um personagem 3D: cabelo, olhos, rosto, adereço de cabeça e cor da roupa.
// Tudo procedural, preso ao osso da cabeça com proporções da caixa da cabeça (funciona nos 4 modelos KayKit).
import * as THREE from 'three';
import type { SkinnedActor } from './actors';
import { Look, OUTFIT_TINT } from '../data/looks';

const HAT = /(Hat|Helmet)$/;
const lam = (c: string, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : '#000', emissiveIntensity: e });

/** Ajuste fino por modelo (fração da altura da cabeça): altura dos olhos, afastamento e frente do rosto. */
const FACE: Record<string, { ey: number; ex: number; fz: number; skull: number }> = {
  Knight: { ey: 0.42, ex: 0.2, fz: 0.0, skull: 1 }, Barbarian: { ey: 0.42, ex: 0.2, fz: 0.0, skull: 1 },
  Mage: { ey: 0.42, ex: 0.2, fz: 0.0, skull: 1 }, Rogue: { ey: 0.42, ex: 0.2, fz: 0.0, skull: 1 },
};

export function applyLook(a: SkinnedActor, look: Look, tone: string) {
  const head = a.head, bone = a.headBone;
  // --- roupa: tinge corpo, braços, pernas e capa ---
  const tint = OUTFIT_TINT[look.outfit];
  a.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !tint) return;
    if (/_(Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape)$/.test(o.name)) (m.material as THREE.MeshStandardMaterial).color.set(tint).multiplyScalar(1.7);
  });
  if (!head || !bone) return;

  // chapéu/elmo da classe: só fica se o jogador escolheu "Da Classe"
  let hatShown = false;
  a.model.traverse((o) => {
    if (!HAT.test(o.name)) return;
    if (look.head === 'default') hatShown ||= o.visible; else o.visible = false;
  });

  a.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const fk = FACE[a.spec.model] ?? FACE.Knight;
  const bq = bone.getWorldQuaternion(new THREE.Quaternion());
  const bs = 1 / bone.getWorldScale(new THREE.Vector3()).x;
  const root = new THREE.Group();   // tudo da aparência fica aqui (fácil de remover)
  root.name = 'look';
  bone.add(root);
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], rot: [number, number, number] = [0, 0, 0], sc: [number, number, number] = [1, 1, 1]) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    // p em frações da caixa da cabeça (x largura, y altura a partir do centro, z profundidade)
    m.position.copy(bone.worldToLocal(new THREE.Vector3(c.x + p[0] * s.x, c.y + p[1] * s.y, c.z + p[2] * s.z)));
    m.quaternion.copy(bq.clone().invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot))));
    m.scale.set(bs * sc[0], bs * sc[1], bs * sc[2]);
    root.add(m);
    return m;
  };
  // unidades: 1 = tamanho da cabeça nos eixos x/y/z (as geometrias abaixo têm lado 1)
  const sph = (seg = 14) => new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.75));
  const cap = (lim = 0.58) => new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * lim);
  const box1 = () => new THREE.BoxGeometry(1, 1, 1);
  const cone = (seg = 6) => new THREE.ConeGeometry(0.5, 1, seg);
  const cyl = (seg = 14) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
  const sc3 = (x: number, y: number, z: number): [number, number, number] => [s.x * x, s.y * y, s.z * z];
  const hairM = lam(look.hairColor), skinM = lam(tone);

  // --- cabelo (cobre o cabelo desenhado no modelo) ---
  if (!hatShown && !['hood', 'helm', 'horns'].includes(look.head)) {
    const top = [0, 0.14, -0.02] as [number, number, number];
    const base = (mat: THREE.Material, k = 1.1, lim = 0.53) => mk(cap(lim), mat, top, [0, 0, 0], sc3(k, 0.82 * k, 1.04 * k));
    switch (look.hair) {
      case 'none': base(skinM, 1.06, 0.5); break;
      case 'short': base(hairM); for (const sx of [-1, 1]) mk(box1(), hairM, [sx * 0.52, 0.0, 0.0], [0, 0, 0], sc3(0.08, 0.3, 0.5)); break;
      case 'spiky':
        base(hairM, 1.08);
        for (let i = 0; i < 7; i++) { const t = (i / 6) * 2 - 1; mk(cone(5), hairM, [t * 0.36, 0.5 + (1 - Math.abs(t)) * 0.06, t * 0.05], [0, 0, -t * 0.55], sc3(0.2, 0.4, 0.2)); }
        break;
      case 'long':
        base(hairM, 1.12); mk(box1(), hairM, [0, -0.2, -0.46], [0, 0, 0], sc3(1.0, 1.0, 0.24));
        for (const sx of [-1, 1]) mk(box1(), hairM, [sx * 0.52, -0.12, -0.12], [0, 0, 0], sc3(0.1, 0.8, 0.6));
        break;
      case 'pony':
        base(hairM); mk(sph(), hairM, [0, 0.2, -0.52], [0, 0, 0], sc3(0.24, 0.24, 0.24));
        mk(cone(6), hairM, [0, -0.25, -0.62], [Math.PI, 0, 0], sc3(0.24, 0.8, 0.24));
        break;
      case 'bun': base(hairM); mk(sph(), hairM, [0, 0.62, -0.08], [0, 0, 0], sc3(0.34, 0.34, 0.34)); break;
      case 'mohawk':
        base(skinM, 1.06, 0.5);
        for (let i = 0; i < 6; i++) { const z = -0.42 + i * 0.17; mk(box1(), hairM, [0, 0.52 + Math.sin((i / 5) * Math.PI) * 0.1, z], [0, 0, 0], sc3(0.14, 0.34, 0.15)); }
        break;
      case 'afro': mk(sph(18), hairM, [0, 0.3, -0.08], [0, 0, 0], sc3(1.3, 1.0, 1.3)); break;
      case 'bob':
        base(hairM, 1.12); mk(box1(), hairM, [0, 0.0, -0.48], [0, 0, 0], sc3(1.05, 0.6, 0.22));
        for (const sx of [-1, 1]) mk(box1(), hairM, [sx * 0.53, 0.0, -0.1], [0, 0, 0], sc3(0.1, 0.5, 0.6));
        break;
      case 'braids':
        base(hairM);
        for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) mk(sph(8), hairM, [sx * 0.54, -0.02 - i * 0.18, -0.1 - i * 0.02], [0, 0, 0], sc3(0.18, 0.2, 0.18));
        break;
    }
  }

  // --- adereço de cabeça ---
  const gold = lam('#e8c050'), fabric = lam(tint ?? '#7a4ad0');
  switch (look.head) {
    case 'headband': mk(new THREE.TorusGeometry(0.5, 0.06, 6, 20), lam('#c83a3a'), [0, 0.28, 0], [Math.PI / 2, 0, 0], sc3(1.14, 1.14, 1.0)); break;
    case 'circlet':
      mk(new THREE.TorusGeometry(0.5, 0.035, 6, 20), gold, [0, 0.3, 0], [Math.PI / 2, 0, 0], sc3(1.14, 1.14, 1.0));
      mk(sph(8), lam('#58d8ff', 0.6), [0, 0.32, 0.56], [0, 0, 0], sc3(0.12, 0.12, 0.1)); break;
    case 'hood':
      mk(cap(0.7), fabric, [0, 0.08, -0.2], [0, 0, 0], sc3(1.22, 1.0, 1.1));
      mk(box1(), fabric, [0, -0.3, -0.58], [0, 0, 0], sc3(1.05, 0.7, 0.16)); break;
    case 'witch':
      mk(cyl(20), lam('#3a2a6a'), [0, 0.3, 0], [0, 0, 0], sc3(1.8, 0.07, 1.8));
      mk(new THREE.ConeGeometry(0.5, 1, 14), lam('#4a3a8a'), [0, 0.85, 0], [-0.1, 0, 0], sc3(1.0, 1.1, 1.0)); break;
    case 'feather':
      mk(cyl(18), lam('#2a6a4a'), [0, 0.3, 0], [0, 0, 0], sc3(1.5, 0.06, 1.5));
      mk(cyl(18), lam('#2a6a4a'), [0, 0.45, 0], [0, 0, 0], sc3(1.0, 0.3, 1.0));
      mk(cone(4), lam('#e04a6a'), [0.45, 0.7, -0.1], [0, 0, -0.7], sc3(0.1, 0.7, 0.04)); break;
    case 'helm':
      mk(cap(0.53), lam('#9a9aa5'), [0, 0.14, -0.02], [0, 0, 0], sc3(1.12, 0.86, 1.08));
      mk(box1(), lam('#8a8a95'), [0, 0.1, 0.55], [0, 0, 0], sc3(0.1, 0.5, 0.06)); break;
    case 'horns':
      mk(cap(0.53), lam('#7a7a85'), [0, 0.14, -0.02], [0, 0, 0], sc3(1.12, 0.86, 1.08));
      for (const sx of [-1, 1]) mk(cone(6), lam('#efe6cf'), [sx * 0.6, 0.5, 0], [0, 0, -sx * 0.9], sc3(0.2, 0.7, 0.2)); break;
    case 'crown':
      mk(cyl(14), gold, [0, 0.36, 0], [0, 0, 0], sc3(1.0, 0.16, 1.0));
      for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; mk(cone(4), gold, [Math.cos(t) * 0.46, 0.5, Math.sin(t) * 0.46], [0, 0, 0], sc3(0.14, 0.26, 0.14)); }
      break;
  }

  // --- olhos (íris colorida por cima dos olhos do modelo) ---
  const eyeW = { round: [0.13, 0.18], big: [0.17, 0.24], narrow: [0.17, 0.1], slit: [0.1, 0.2] }[look.eyes] ?? [0.15, 0.2];
  const front = 0.5 + fk.fz;
  for (const sx of [-1, 1]) {
    const p: [number, number, number] = [sx * fk.ex * 1.15, fk.ey - 0.5 - 0.04, front];
    mk(sph(10), lam(look.eyeColor), p, [0, 0, 0], sc3(eyeW[0], eyeW[1], 0.05));
    mk(sph(8), lam('#0a0a0a'), [p[0], p[1] - 0.005, p[2] + 0.02], [0, 0, 0], sc3(look.eyes === 'slit' ? 0.03 : eyeW[0] * 0.5, eyeW[1] * 0.7, 0.04));
    mk(sph(6), lam('#ffffff', 0.5), [p[0] + 0.02, p[1] + eyeW[1] * 0.22, p[2] + 0.04], [0, 0, 0], sc3(0.035, 0.035, 0.03));
  }

  // --- rosto ---
  const ink = lam('#1a1410');
  const fz = front + 0.02;
  switch (look.face) {
    case 'beard': mk(cone(8), hairM, [0, -0.45, 0.25], [Math.PI * 0.96, 0, 0], sc3(0.95, 0.45, 0.7)); mk(box1(), hairM, [0, -0.3, 0.44], [0, 0, 0], sc3(0.78, 0.1, 0.12)); break;
    case 'goatee': mk(cone(6), hairM, [0, -0.45, 0.42], [Math.PI * 0.9, 0, 0], sc3(0.22, 0.32, 0.2)); break;
    case 'stache':
      for (const sx of [-1, 1]) mk(box1(), hairM, [sx * 0.12, -0.24, fz], [0, 0, sx * 0.3], sc3(0.22, 0.06, 0.08)); break;
    case 'scar': mk(box1(), lam('#b8403a'), [0.2, fk.ey - 0.5 + 0.14, fz], [0, 0, 0.6], sc3(0.04, 0.34, 0.03)); break;
    case 'paint':
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) mk(box1(), lam(i ? '#f4f0e0' : '#c83a3a'), [sx * 0.3, fk.ey - 0.5 - 0.17 - i * 0.06, fz - 0.03], [0, 0, sx * 0.2], sc3(0.24, 0.04, 0.03));
      break;
    case 'freckles':
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) mk(sph(5), lam('#9a4a1e'), [sx * (0.14 + (i % 3) * 0.07), fk.ey - 0.5 - 0.17 - (i % 2) * 0.05, fz - 0.02], [0, 0, 0], sc3(0.045, 0.045, 0.045));
      break;
    case 'patch':
      mk(sph(10), ink, [0.23, fk.ey - 0.5 - 0.06, fz + 0.03], [0, 0, 0], sc3(0.26, 0.28, 0.06));
      mk(box1(), ink, [0, 0.12, 0], [0, 0, -0.18], sc3(1.15, 0.035, 1.05)); break;
    case 'goggles':
      for (const sx of [-1, 1]) {
        mk(new THREE.TorusGeometry(0.5, 0.12, 6, 14), lam('#9a6a2a'), [sx * 0.23, 0.2, front + 0.04], [0, 0, 0], sc3(0.3, 0.3, 0.1));
        mk(sph(10), lam('#7ad0ff', 0.4), [sx * 0.23, 0.2, front + 0.03], [0, 0, 0], sc3(0.24, 0.24, 0.05));
      }
      mk(box1(), lam('#5a3a1a'), [0, 0.2, 0], [0, 0, 0], sc3(1.12, 0.07, 1.04)); break;
  }
}
