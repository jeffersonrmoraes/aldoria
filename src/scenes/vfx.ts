import * as THREE from 'three';

/** Efeitos visuais leves (partículas, projéteis, golpes) usados pelo combate. Tudo é MeshBasicMaterial com fade-out. */
export interface FxItem { update(dt: number): boolean }
export interface FxCtx { root: THREE.Group; list: FxItem[] }

export type ProjKind = 'arrow' | 'quarrel' | 'orb' | 'fire' | 'beam' | 'note' | 'thorn' | 'radiant' | 'skull' | 'prism' | 'dagger';
export type SlashKind = 'slash' | 'chop' | 'stab' | 'punch' | 'dance' | 'holy' | 'arcane';

/** Efeito de ataque básico de cada classe. */
export const CLASS_FX: Record<string, { proj?: ProjKind; slash?: SlashKind; color: number; color2?: number }> = {
  ranger: { proj: 'arrow', color: 0xd9c08a, color2: 0x9be37a },
  wizard: { proj: 'orb', color: 0x6ab0ff, color2: 0xbfe0ff },
  sorcerer: { proj: 'fire', color: 0xff7a1a, color2: 0xffd23f },
  warlock: { proj: 'beam', color: 0xb06aff, color2: 0xff7aff },
  bard: { proj: 'note', color: 0xff7ad9, color2: 0xffe08a },
  druid: { proj: 'thorn', color: 0x7ae07a, color2: 0xd9ff8a },
  cleric: { proj: 'radiant', color: 0xfff2a8, color2: 0xffffff },
  necromancer: { proj: 'skull', color: 0x6aff9a, color2: 0x1f6a3a },
  illusionist: { proj: 'prism', color: 0xff7ae0, color2: 0x7ae0ff },
  fighter: { slash: 'slash', color: 0xe8f0ff },
  paladin: { slash: 'holy', color: 0xffe08a },
  barbarian: { slash: 'chop', color: 0xff6a3a },
  monk: { slash: 'punch', color: 0xffd9a0 },
  rogue: { slash: 'stab', color: 0xd8d8f0 },
  eldknight: { slash: 'arcane', color: 0x6ab0ff },
  bladesinger: { slash: 'dance', color: 0xc78bff },
};

const sphere = new THREE.SphereGeometry(1, 6, 5);
const mat = (color: number | string, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });

export class Vfx {
  constructor(private c: FxCtx) {}
  private add(o: THREE.Object3D, fn: (dt: number) => boolean) {
    this.c.root.add(o);
    this.c.list.push({ update: (dt) => { const alive = fn(dt); if (!alive) { this.c.root.remove(o); o.traverse((x) => { const m = x as THREE.Mesh; if (m.material && !(m.geometry === sphere)) { /* geometria própria */ } if (m.material) (m.material as THREE.Material).dispose?.(); }); } return alive; } });
  }

  spark(pos: THREE.Vector3, color: number, n = 8, speed = 2.5, life = 0.5, size = 0.07, up = 1.2) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, mat(color, 0.95)); m.scale.setScalar(size * (0.6 + Math.random() * 0.8)); m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      const v = new THREE.Vector3(Math.cos(a) * s, Math.random() * speed * 0.7 + up, Math.sin(a) * s);
      let t = 0; const L = life * (0.6 + Math.random() * 0.6);
      this.add(m, (dt) => { t += dt; v.y -= 5 * dt; m.position.addScaledVector(v, dt); (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - t / L)); return t < L; });
    }
  }
  /** partículas que sobem em volta de um ponto (curas, auras) */
  rise(pos: THREE.Vector3, color: number, n = 12, radius = 0.8, life = 0.9) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, mat(color, 0.9)); m.scale.setScalar(0.05 + Math.random() * 0.05);
      const a = Math.random() * Math.PI * 2, r = radius * (0.4 + Math.random() * 0.6);
      m.position.set(pos.x + Math.cos(a) * r, pos.y + Math.random() * 0.4, pos.z + Math.sin(a) * r);
      let t = -Math.random() * 0.25; const sp = 1.2 + Math.random() * 1.2;
      m.visible = false;
      this.add(m, (dt) => { t += dt; if (t < 0) return true; m.visible = true; m.position.y += sp * dt; (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t / life)); return t < life; });
    }
  }
  pillar(pos: THREE.Vector3, color: number, h = 5, life = 0.45, r = 0.35) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.5, h, 10, 1, true), mat(color, 0.7));
    m.position.set(pos.x, pos.y + h / 2, pos.z);
    let t = 0;
    this.add(m, (dt) => { t += dt; const k = t / life; m.scale.set(1 + k * 0.6, 1, 1 + k * 0.6); (m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k); if (k >= 1) m.geometry.dispose(); return k < 1; });
  }
  ring(pos: THREE.Vector3, color: number, radius = 1.2, life = 0.35, y = 0.12) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(pos.x, pos.y + y, pos.z);
    let t = 0;
    this.add(m, (dt) => { t += dt / life; m.scale.setScalar(0.2 + Math.min(1, t) * radius); (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - Math.min(1, t)); if (t >= 1) m.geometry.dispose(); return t < 1; });
  }
  /** estrela de impacto */
  impact(pos: THREE.Vector3, color: number, big = false) {
    this.spark(pos, color, big ? 14 : 8, big ? 3.4 : 2.4, 0.45, 0.07);
    this.spark(pos, 0xffffff, 3, 1.6, 0.3, 0.05);
    this.ring(new THREE.Vector3(pos.x, pos.y - 0.3, pos.z), color, big ? 1.4 : 0.8, 0.28, 0.35);
  }

  /** golpe corpo a corpo: arco de lâmina, soco, estocada... `face` é o ângulo y do personagem */
  slash(pos: THREE.Vector3, face: number, kind: SlashKind, color: number, big = false) {
    const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
    const g = new THREE.Group(); g.position.copy(pos).addScaledVector(fwd, 0.7); g.position.y += 0.1;
    const arc = (r0: number, r1: number, len: number, col: number, op = 0.9) => {
      const geo = new THREE.RingGeometry(r0, r1, 20, 1, -Math.PI / 2 - len / 2, len).rotateX(-Math.PI / 2);
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    };
    const parts: THREE.Mesh[] = [];
    let dur = 0.24, from = 0.9, to = -0.9;
    if (kind === 'slash' || kind === 'holy' || kind === 'arcane') {
      const s = big ? 1.25 : 1; parts.push(arc(0.5 * s, 1.15 * s, 1.8, color), arc(0.9 * s, 1.1 * s, 2.0, 0xffffff, 0.8));
      if (kind === 'holy') this.spark(pos.clone().addScaledVector(fwd, 0.9), 0xfff2a8, 6, 1.4, 0.7, 0.06, 1.8);
      if (kind === 'arcane') this.spark(pos.clone().addScaledVector(fwd, 0.9), 0x9ad0ff, 6, 2, 0.5, 0.05);
    } else if (kind === 'chop') {
      parts.push(arc(0.4, 1.5, 2.3, color), arc(1.2, 1.5, 2.5, 0xffd0a0, 0.8)); dur = 0.3; from = 1.1; to = -1.1;
      this.ring(pos.clone().addScaledVector(fwd, 1.1), 0xff9a5a, 1.1, 0.3, 0.1);
    } else if (kind === 'dance') {
      parts.push(arc(0.5, 1.1, 1.7, color), arc(0.8, 1.2, 1.9, 0xffffff, 0.7)); dur = 0.2;
      const g2 = new THREE.Group(); g2.position.copy(g.position); g2.rotation.y = face - 0.4; g2.add(arc(0.6, 1.0, 1.6, 0xe6c7ff, 0.8)); this.sweep(g2, face - 0.4, 0.9, -0.9, 0.2);
    } else if (kind === 'stab') {
      for (const a of [0.45, -0.45]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.5), mat(color, 0.95)); b.rotation.y = a; b.position.z = 0.4; g.add(b); }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), mat(0xffffff, 0.9)); star.position.set(0, 0.2, 1.05); g.add(star);
      g.rotation.y = face; dur = 0.2;
      let t = 0; this.add(g, (dt) => { t += dt / dur; g.position.addScaledVector(fwd, dt * 3); g.children.forEach((c) => { const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = Math.max(0, 0.95 * (1 - t)); }); return t < 1; });
      return;
    } else if (kind === 'punch') {
      this.ring(pos.clone().addScaledVector(fwd, 0.9), color, 1.0, 0.25, 0.8); this.ring(pos.clone().addScaledVector(fwd, 1.3), 0xffffff, 0.7, 0.2, 0.8);
      this.spark(pos.clone().addScaledVector(fwd, 1.0).setY(pos.y + 0.8), 0xffe8b0, 5, 2.2, 0.3, 0.05);
      return;
    }
    parts.forEach((p) => g.add(p));
    this.sweep(g, face, from, to, dur);
  }
  private sweep(g: THREE.Group, face: number, from: number, to: number, dur: number) {
    let t = 0; g.rotation.y = face + from;
    this.add(g, (dt) => {
      t += dt / dur; const k = Math.min(1, t);
      g.rotation.y = face + from + (to - from) * k; g.scale.setScalar(1 + k * 0.2);
      g.children.forEach((c) => { const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m) m.opacity = Math.max(0, (m.userData.o ??= m.opacity) * (1 - k * k)); });
      return k < 1;
    });
  }

  /** projétil de ataque à distância; `target` é reavaliado a cada quadro (o alvo se move) */
  projectile(kind: ProjKind, from: THREE.Vector3, target: () => THREE.Vector3, color: number, color2: number, dur: number, done: () => void) {
    const grp = new THREE.Group(); grp.position.copy(from);
    let spin: THREE.Object3D | null = null; let arcH = 0.0; let trail = 0.035;
    const core = (r: number, c: number, op = 1) => { const m = new THREE.Mesh(sphere, mat(c, op)); m.scale.setScalar(r); grp.add(m); return m; };
    switch (kind) {
      case 'arrow': case 'quarrel': {
        const L = kind === 'arrow' ? 0.8 : 0.45;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 5).rotateX(Math.PI / 2), mat(0xd9c08a));
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5).rotateX(Math.PI / 2), mat(0xe8e8f0)); head.position.z = L / 2 + 0.05;
        const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.14), mat(color2)); fl.position.z = -L / 2;
        grp.add(shaft, head, fl); arcH = kind === 'arrow' ? 0.9 : 0.15; break;
      }
      case 'orb': core(0.13, 0xffffff); core(0.28, color, 0.5); break;
      case 'fire': core(0.14, color2); core(0.3, color, 0.6); trail = 0.02; break;
      case 'prism': core(0.14, 0xffffff); core(0.28, color, 0.55); break;
      case 'skull': {
        core(0.17, 0xe8f0e0); const eL = core(0.04, 0x0a3a1a), eR = core(0.04, 0x0a3a1a); eL.position.set(-0.07, 0.03, 0.14); eR.position.set(0.07, 0.03, 0.14);
        const j = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), mat(0xe8f0e0)); j.position.set(0, -0.12, 0.08); grp.add(j); core(0.32, color, 0.35); break;
      }
      case 'note': {
        core(0.1, color); const stem = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), mat(color2)); stem.position.set(0.08, 0.15, 0); grp.add(stem);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), mat(color2)); flag.position.set(0.14, 0.3, 0); grp.add(flag); spin = grp; break;
      }
      case 'thorn': {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 5).rotateX(Math.PI / 2), mat(color)); grp.add(c);
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.1), mat(color2)); l.position.z = -0.15; grp.add(l); break;
      }
      case 'dagger': { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.4), mat(0xe8e8f0)); grp.add(b); spin = b; break; }
      case 'beam': case 'radiant': break;
    }
    const to0 = target();
    if (kind === 'beam') {
      // raio sombrio instantâneo do conjurador até o alvo
      const len = from.distanceTo(to0);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 6).rotateX(Math.PI / 2), mat(color2, 0.95));
      const g2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 6).rotateX(Math.PI / 2), mat(color, 0.45));
      const holder = new THREE.Group(); holder.add(b, g2); holder.position.copy(from).lerp(to0, 0.5); holder.lookAt(to0);
      let t = 0;
      this.add(holder, (dt) => { t += dt; const k = t / 0.18; holder.scale.set(1 - k * 0.7, 1 - k * 0.7, 1); (b.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k); (g2.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k); if (k >= 0.35 && !(holder.userData.done)) { holder.userData.done = 1; done(); this.impact(to0, color, true); } if (k >= 1) { b.geometry.dispose(); g2.geometry.dispose(); } return k < 1; });
      this.spark(from, color, 5, 1.5, 0.3);
      return;
    }
    if (kind === 'radiant') {
      // luz sagrada que desce sobre o alvo
      const pos = to0.clone();
      this.ring(new THREE.Vector3(pos.x, pos.y - 0.6, pos.z), color, 1.0, 0.35, 0.1);
      let t = 0, fired = false;
      const holder = new THREE.Group(); this.c.root.add(holder); holder.position.copy(pos);
      this.c.list.push({ update: (dt) => { t += dt; if (!fired && t > dur * 0.6) { fired = true; this.pillar(new THREE.Vector3(pos.x, pos.y - 0.7, pos.z), color, 6, 0.5, 0.4); this.impact(pos, color2, true); this.spark(pos, 0xffffff, 6, 1.4, 0.8, 0.05, 2); done(); } if (t > dur * 0.6 + 0.1) { this.c.root.remove(holder); return false; } return true; } });
      return;
    }
    this.c.root.add(grp);
    let t = 0, tr = 0, hue = 0;
    this.c.list.push({
      update: (dt) => {
        t += dt / dur; tr += dt; hue += dt * 3;
        const to = target();
        const prev = grp.position.clone();
        grp.position.lerpVectors(from, to, Math.min(1, t));
        if (arcH) grp.position.y += Math.sin(Math.PI * Math.min(1, t)) * arcH;
        const dir = grp.position.clone().sub(prev);
        if (dir.lengthSq() > 1e-8 && !spin) grp.lookAt(grp.position.clone().add(dir));
        if (spin) spin.rotation.z += dt * 14;
        if (kind === 'note') grp.position.y += Math.sin(t * 18) * 0.012;
        if (kind === 'prism') { const c = new THREE.Color().setHSL(hue % 1, 0.9, 0.6); ((grp.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(c); }
        if (tr > trail) {
          tr = 0;
          const col = kind === 'prism' ? new THREE.Color().setHSL(hue % 1, 0.9, 0.6).getHex() : (kind === 'skull' ? color : color2 || color);
          this.spark(grp.position, col, kind === 'fire' ? 2 : 1, 0.5, kind === 'skull' ? 0.7 : 0.35, kind === 'arrow' ? 0.03 : 0.06, kind === 'skull' ? 0.4 : 0.1);
        }
        if (t >= 1) { this.c.root.remove(grp); grp.traverse((x) => ((x as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.()); this.impact(to, color, kind === 'fire'); done(); return false; }
        return true;
      },
    });
  }
}
