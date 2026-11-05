// Atores 3D: personagens esqueléticos (KayKit, CC0) e criaturas procedurais simples.
import * as THREE from 'three';
import { clips, cloneModel, modelScale } from './models';
import { RACE_BY_ID } from '../data/races';

export interface Visual {
  root: THREE.Object3D;
  setMoving(moving: boolean, speedFactor?: number): void;
  attack(clip?: string): void;
  hit(): void;
  die(): void;
  revive(): void;
  flash(ms?: number): void;
  update(dt: number, now: number): void;
}

export interface ModelSpec {
  model: 'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Skeleton' | 'SkMinion' | 'SkMage' | 'SkRogue';
  scale?: number;
  eyeColor?: string;        // recolore os olhos brilhantes dos modelos de esqueleto
  skin?: string;            // cor da cabeça/rosto (monstros não-humanos)
  wide?: number;            // estica/afina o corpo (largura/profundidade) para variar a silhueta
  parts?: PartDef[];        // acessórios procedurais (chifres, presas, orelhas, olhos brilhantes...)
  opacity?: number;         // fantasmas/sombras
  show?: string[];          // itens nas mãos / acessórios visíveis
  hide?: string[];          // peças a esconder (ex.: chapéu)
  tint?: string;            // tinge o modelo todo
  cape?: string;            // tinge capa/chapéu/elmo
  melee?: string;           // clipe de ataque corpo a corpo
}

export interface PartDef { k: 'horn' | 'ears' | 'tusks' | 'fangs' | 'eyes' | 'crest' | 'crown' | 'tail' | 'spikes' | 'mane' | 'hornsBig' | 'nose'; c?: string; s?: number; }

const pm = (c: string, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : '#000', emissiveIntensity: e });
/** Monta um acessório. Eixos: +Y cima, +Z frente do personagem; unidades em tiles (personagem ≈ 1,7). */
function buildPart(d: PartDef, tint?: string): THREE.Object3D {
  const g = new THREE.Group(), sc = d.s ?? 1;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  const ivory = d.c ?? '#efe6cf';
  switch (d.k) {
    case 'horn': case 'hornsBig': {
      const big = d.k === 'hornsBig', mat = pm(d.c ?? '#d9ccb0');
      for (const sx of [-1, 1]) {
        const h = new THREE.Group(); h.position.set(sx * 0.13, 0.1, 0.02); h.rotation.z = -sx * (big ? 0.9 : 0.45); g.add(h);
        const a = new THREE.Mesh(new THREE.ConeGeometry(0.06 * sc, (big ? 0.42 : 0.24) * sc, 6), mat); a.position.y = (big ? 0.2 : 0.11) * sc; h.add(a);
        if (big) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.04 * sc, 0.26 * sc, 6), mat); b.position.set(-sx * 0.1 * sc, 0.46 * sc, 0); b.rotation.z = sx * 0.9; h.add(b); }
      }
      break;
    }
    case 'ears': {
      const mat = pm(d.c ?? tint ?? '#8bbf6a');
      for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.075 * sc, 0.34 * sc, 4), mat, sx * (0.14 + 0.1 * sc), 0.02, -0.02, 0, 0, -sx * 1.15);
      break;
    }
    case 'tusks': {
      const mat = pm(ivory);
      for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.04 * sc, 0.22 * sc, 5), mat, sx * 0.12, -0.17, 0.35, Math.PI - 0.25, 0, -sx * 0.12);
      break;
    }
    case 'fangs': {
      const mat = pm(ivory);
      for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.02 * sc, 0.1 * sc, 4), mat, sx * 0.07, -0.12, 0.31, Math.PI, 0, 0);
      break;
    }
    case 'eyes': {
      const mat = pm(d.c ?? '#ff3b2b', 1.4);
      for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.026 * sc, 8, 6), mat, sx * 0.11, 0.05, 0.31);
      break;
    }
    case 'crest': {
      const mat = pm(d.c ?? '#6b3a22');
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.04 * sc, (0.2 - Math.abs(i - 2) * 0.03) * sc, 4), mat, 0, 0.13 - i * 0.002, 0.12 - i * 0.07, -0.3, 0, 0);
      break;
    }
    case 'crown': {
      const mat = pm(d.c ?? '#f1c40f', 0.35);
      add(new THREE.CylinderGeometry(0.15 * sc, 0.17 * sc, 0.07 * sc, 10, 1, true), mat, 0, 0.5, 0);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.03 * sc, 0.1 * sc, 4), mat, Math.sin(a) * 0.16 * sc, 0.56, Math.cos(a) * 0.16 * sc); }
      break;
    }
    case 'mane': {
      const mat = pm(d.c ?? '#5a3a1e');
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new THREE.ConeGeometry(0.06 * sc, 0.26 * sc, 4), mat, Math.sin(a) * 0.22 * sc, -0.1, Math.cos(a) * 0.22 * sc - 0.02, Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2); }
      break;
    }
    case 'nose': {
      add(new THREE.ConeGeometry(0.05 * sc, 0.2 * sc, 5), pm(d.c ?? tint ?? '#7aa05a'), 0, -0.04, 0.33, Math.PI / 2, 0, 0);
      break;
    }
    case 'tail': {
      const mat = pm(d.c ?? tint ?? '#b0603a');
      add(new THREE.ConeGeometry(0.07 * sc, 0.6 * sc, 6), mat, 0, -0.12, -0.32 * sc, -1.9, 0, 0);
      break;
    }
    case 'spikes': {
      const mat = pm(d.c ?? '#d9ccb0');
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.05 * sc, 0.2 * sc, 4), mat, ((i % 2) - 0.5) * 0.14, 0.14 - i * 0.11, -0.16, -1.2, 0, 0);
      break;
    }
  }
  return g;
}
const PART_BONE: Record<PartDef['k'], string> = { horn: 'head', hornsBig: 'head', ears: 'head', tusks: 'head', fangs: 'head', eyes: 'head', crest: 'head', crown: 'head', mane: 'head', nose: 'head', tail: 'hips', spikes: 'chest' };
const HEAD_K: Record<string, number> = { Barbarian: 1.55, Knight: 1.1, Mage: 1.0, Rogue: 1.0, Skeleton: 1.15, SkMinion: 1.15, SkMage: 1.15, SkRogue: 1.15 };
const PART_OFF: Record<string, [number, number, number]> = { head: [0, 0.2, 0], hips: [0, 0, 0], chest: [0, 0, 0] };

const HELD = /^(1H_|2H_|Knife|Mug|Throwable|Spellbook|Round_Shield|Badge_Shield|Rectangle_Shield|Spike_Shield|Barbarian_Round_Shield)/;

export class SkinnedActor implements Visual {
  root = new THREE.Group();
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  private act: Record<string, THREE.AnimationAction> = {};
  private cur = '';
  private busyUntil = 0;
  private moving = false;
  private speedF = 1;
  private deadFlag = false;
  private flashT = 0;
  private mats: THREE.MeshStandardMaterial[] = [];
  head: THREE.Mesh | null = null;
  headBone: THREE.Object3D | null = null;
  melee: string;

  constructor(public spec: ModelSpec, scaleMul = 1) {
    this.model = cloneModel(spec.model);
    const s = (spec.scale ?? 1) * scaleMul * modelScale(spec.model);
    this.model.scale.setScalar(s);
    this.root.add(this.model);
    this.melee = spec.melee ?? '1H_Melee_Attack_Slice_Diagonal';
    const show = new Set(spec.show ?? []);
    const hide = new Set(spec.hide ?? []);
    const tint = spec.tint ? new THREE.Color(spec.tint) : null;
    const cape = spec.cape ? new THREE.Color(spec.cape) : null;
    this.model.traverse((o) => {
      if (o.name === 'head') this.headBone = o;
      const mesh = o as THREE.Mesh;
      if (HELD.test(o.name)) o.visible = show.has(o.name);
      if (hide.has(o.name)) o.visible = false;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      this.mats.push(mat);
      if (/_Head$/.test(o.name)) this.head = mesh;
      if (tint && !/_(Head|Eyes)$/.test(o.name)) mat.color.copy(tint);
      if (spec.eyeColor && /_Eyes$/.test(o.name)) { mat.color.set(spec.eyeColor); mat.emissive.set(spec.eyeColor); mat.emissiveIntensity = 1.2; }
      if (spec.skin && /_Head$/.test(o.name)) mat.color.set(spec.skin);
      if (cape && /(Cape|Hat|Helmet|Cloak)$/.test(o.name)) mat.color.copy(cape);
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.play('Idle');
    this.mixer.update(Math.random() * 2);
    if (spec.opacity !== undefined) for (const m of this.mats) { m.transparent = true; m.opacity = spec.opacity; m.depthWrite = false; }
    if (spec.parts?.length) this.addParts(spec.parts, spec.tint);
    if (spec.wide) this.model.scale.x *= spec.wide, this.model.scale.z *= spec.wide;
  }

  /** Prende acessórios procedurais aos ossos (cabeça/quadril/peito), já alinhados aos eixos do personagem. */
  private addParts(parts: PartDef[], tint?: string) {
    this.root.updateMatrixWorld(true);
    const bones: Record<string, THREE.Object3D | undefined> = {};
    this.model.traverse((o) => { if (['head', 'hips', 'chest'].includes(o.name) && !bones[o.name]) bones[o.name] = o; });
    for (const d of parts) {
      const bn = PART_BONE[d.k], bone = bones[bn];
      if (!bone) continue;
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      bone.matrixWorld.decompose(p, q, sc);
      const wrap = new THREE.Group();
      wrap.quaternion.copy(q).invert();
      wrap.scale.set(1 / sc.x, 1 / sc.y, 1 / sc.z);
      const o = PART_OFF[bn];
      const part = buildPart(d, tint);
      const k = (bn === 'head' ? (HEAD_K[this.spec.model] ?? 1) : 1) * Math.pow(this.spec.scale ?? 1, 0.8);
      part.scale.setScalar(k);
      part.position.set(o[0] * k, o[1] * k + (d.k === 'eyes' && this.spec.model === 'Barbarian' ? -0.04 * k : 0), o[2] * k);
      // o rosto do Bárbaro é mais achatado: recua olhos/presas/nariz para encostar na face
      if (this.spec.model === 'Barbarian' && ['eyes', 'tusks', 'fangs', 'nose'].includes(d.k)) part.position.z -= (d.k === 'eyes' ? 0.05 : 0.1) * k;
      wrap.add(part);
      bone.add(wrap);
      part.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) mesh.castShadow = false; });
    }
  }

  /** Mostra apenas as peças seguradas indicadas (se o modelo tiver cada uma). */
  setHeld(names: string[]) {
    const want = new Set(names);
    this.model.traverse((o) => { if (HELD.test(o.name)) o.visible = want.has(o.name); });
  }
  has(name: string) { let f = false; this.model.traverse((o) => { if (o.name === name) f = true; }); return f; }

  /** Aplica tom de pele (multiplicando a cor da cabeça). */
  setSkin(tone: string) {
    if (!this.head) return;
    const c = new THREE.Color(tone);
    const ref = new THREE.Color('#f7c282');
    const m = this.head.material as THREE.MeshStandardMaterial;
    m.color.setRGB(Math.min(1.25, c.r / ref.r), Math.min(1.25, c.g / ref.g), Math.min(1.25, c.b / ref.b));
  }

  private action(name: string) {
    if (!this.act[name]) {
      const clip = clips[name] ?? clips.Idle;
      this.act[name] = this.mixer.clipAction(clip);
    }
    return this.act[name];
  }

  private play(name: string, fade = 0.15, speed = 1) {
    if (this.cur === name) { this.action(name).setEffectiveTimeScale(speed); return; }
    const next = this.action(name);
    next.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1).fadeIn(fade).play();
    if (this.cur) this.action(this.cur).fadeOut(fade);
    this.cur = name;
  }

  private once(name: string, speed = 1, fade = 0.08) {
    const a = this.action(name);
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    this.cur = '';
    a.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1).fadeIn(fade).play();
    for (const k of Object.keys(this.act)) if (this.act[k] !== a) this.act[k].fadeOut(fade);
    this.busyUntil = performance.now() + (a.getClip().duration / speed) * 1000 * 0.9;
    this.cur = '~' + name;
  }

  setMoving(moving: boolean, speedFactor = 1) { this.moving = moving; this.speedF = speedFactor; }
  attack(clip?: string) { if (this.deadFlag) return; this.once(clip ?? this.melee, 1.6); }
  hit() { if (this.deadFlag || performance.now() < this.busyUntil) return; this.once('Hit_A', 1.8); }
  die() {
    this.deadFlag = true;
    const a = this.action('Death_A');
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    for (const k of Object.keys(this.act)) if (this.act[k] !== a) this.act[k].fadeOut(0.1);
    a.reset().setEffectiveTimeScale(1.2).setEffectiveWeight(1).fadeIn(0.1).play();
    this.cur = '~death';
  }
  revive() {
    this.deadFlag = false; this.busyUntil = 0;
    this.action('Death_A').stop(); this.cur = ''; this.play('Idle', 0.01);
  }
  flash(ms = 80) {
    this.flashT = ms;
    for (const m of this.mats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.9; }
  }

  update(dt: number, _now: number) {
    if (this.flashT > 0) {
      this.flashT -= dt * 1000;
      if (this.flashT <= 0) for (const m of this.mats) { m.emissive.setHex(0); m.emissiveIntensity = 1; }
    }
    if (!this.deadFlag && performance.now() >= this.busyUntil) {
      if (this.cur.startsWith('~')) this.cur = '';
      if (this.moving) this.play('Running_A', 0.15, Math.max(0.5, this.speedF));
      else this.play('Idle', 0.2, 1);
    }
    this.mixer.update(dt);
  }
}

// ---------- criaturas procedurais (rato, lobo, gosma) ----------
const lam = (c: string, o: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

export class ProcCreature implements Visual {
  root = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Mesh[] = [];
  private tail: THREE.Object3D | null = null;
  private moving = false;
  private t = Math.random() * 10;
  private atkT = 0;
  private deadFlag = false;
  private dieT = 0;
  private mats: THREE.MeshLambertMaterial[] = [];
  private flashT = 0;

  kind: 'rat' | 'wolf' | 'slime';
  constructor(variant: 'rat' | 'wolf' | 'slime' | 'jackal' | 'worg' | 'ratking') {
    this.kind = variant === 'jackal' || variant === 'worg' ? 'wolf' : variant === 'ratking' ? 'rat' : variant;
    const kind = this.kind;
    this.root.add(this.body);
    const add = (geo: THREE.BufferGeometry, mat: THREE.MeshLambertMaterial, x: number, y: number, z: number, parent: THREE.Object3D = this.body) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); this.mats.push(mat); return m;
    };
    if (kind === 'slime') {
      const mat = lam('#8fd6a0', { transparent: true, opacity: 0.88, emissive: '#1c5a34' });
      const b = add(new THREE.SphereGeometry(0.5, 16, 12), mat, 0, 0.32, 0); b.scale.set(1, 0.72, 1);
      const eye = lam('#102018');
      add(new THREE.SphereGeometry(0.07, 8, 6), eye, -0.17, 0.4, 0.42); add(new THREE.SphereGeometry(0.07, 8, 6), eye, 0.17, 0.4, 0.42);
      add(new THREE.SphereGeometry(0.16, 10, 8), lam('#bfffd0', { transparent: true, opacity: 0.6 }), 0.1, 0.2, 0.05);
    } else if (kind === 'rat') {
      const fur = lam('#7a6a5c'), pink = lam('#e8a8a0');
      add(new THREE.BoxGeometry(0.34, 0.26, 0.6), fur, 0, 0.22, 0);
      add(new THREE.BoxGeometry(0.24, 0.2, 0.24), fur, 0, 0.26, 0.38);
      add(new THREE.ConeGeometry(0.09, 0.2, 6).rotateX(Math.PI / 2), pink, 0, 0.24, 0.56);
      add(new THREE.SphereGeometry(0.07, 6, 5), lam('#222'), -0.09, 0.32, 0.46); add(new THREE.SphereGeometry(0.07, 6, 5), lam('#222'), 0.09, 0.32, 0.46);
      add(new THREE.SphereGeometry(0.08, 6, 5), pink, -0.1, 0.4, 0.3); add(new THREE.SphereGeometry(0.08, 6, 5), pink, 0.1, 0.4, 0.3);
      const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.3); this.body.add(tail); this.tail = tail;
      add(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5).rotateX(Math.PI / 2.3), pink, 0, 0, -0.22, tail);
      for (const [x, z] of [[-0.12, 0.18], [0.12, 0.18], [-0.12, -0.18], [0.12, -0.18]]) this.legs.push(add(new THREE.BoxGeometry(0.06, 0.12, 0.08), fur, x, 0.06, z));
      if (variant === 'ratking') {
        fur.color.set('#4a3a34'); fur.emissive.set('#1a0a08');
        const gold = lam('#f1c40f', { emissive: '#7a5a00' });
        add(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 8, 1, true), gold, 0, 0.45, 0.34);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.025, 0.09, 4), gold, Math.sin(a) * 0.11, 0.52, 0.34 + Math.cos(a) * 0.11); }
        for (const x of [-0.09, 0.09]) add(new THREE.SphereGeometry(0.035, 6, 5), lam('#ff3a2a', { emissive: '#ff2200' }), x, 0.32, 0.5);
        add(new THREE.ConeGeometry(0.03, 0.12, 4), lam('#efe6cf'), -0.06, 0.18, 0.62).rotation.x = Math.PI;
        add(new THREE.ConeGeometry(0.03, 0.12, 4), lam('#efe6cf'), 0.06, 0.18, 0.62).rotation.x = Math.PI;
      }
    } else {
      const fur = lam('#8a8c94'), dark = lam('#55575f');
      add(new THREE.BoxGeometry(0.44, 0.44, 1.0), fur, 0, 0.62, 0);
      add(new THREE.BoxGeometry(0.4, 0.38, 0.4), fur, 0, 0.78, 0.62);
      add(new THREE.BoxGeometry(0.22, 0.18, 0.3), dark, 0, 0.7, 0.9);
      add(new THREE.ConeGeometry(0.07, 0.18, 4), dark, -0.12, 1.06, 0.58); add(new THREE.ConeGeometry(0.07, 0.18, 4), dark, 0.12, 1.06, 0.58);
      add(new THREE.SphereGeometry(0.04, 6, 5), lam('#ffd23f', { emissive: '#aa8800' }), -0.1, 0.84, 0.82); add(new THREE.SphereGeometry(0.04, 6, 5), lam('#ffd23f', { emissive: '#aa8800' }), 0.1, 0.84, 0.82);
      const tail = new THREE.Group(); tail.position.set(0, 0.8, -0.5); this.body.add(tail); this.tail = tail;
      add(new THREE.ConeGeometry(0.1, 0.55, 6).rotateX(-Math.PI / 2.4), fur, 0, -0.1, -0.2, tail);
      for (const [x, z] of [[-0.15, 0.36], [0.15, 0.36], [-0.15, -0.36], [0.15, -0.36]]) this.legs.push(add(new THREE.BoxGeometry(0.12, 0.4, 0.12), dark, x, 0.2, z));
      if (variant === 'jackal') {
        // chacal: pelagem areia, focinho fino e orelhas enormes
        fur.color.set('#c9a25a'); dark.color.set('#7a5a2a');
        add(new THREE.ConeGeometry(0.1, 0.34, 4), fur, -0.14, 1.12, 0.56).rotation.z = 0.15;
        add(new THREE.ConeGeometry(0.1, 0.34, 4), fur, 0.14, 1.12, 0.56).rotation.z = -0.15;
      } else if (variant === 'worg') {
        // worg: pelo negro eriçado, crina de espinhos e olhos vermelhos
        fur.color.set('#33333b'); dark.color.set('#1c1c22');
        for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.06, 0.2, 4), dark, 0, 0.9 - i * 0.02, 0.4 - i * 0.2).rotation.x = -0.2;
        const red = lam('#ff3a2a', { emissive: '#ff1a00' });
        add(new THREE.SphereGeometry(0.045, 6, 5), red, -0.1, 0.84, 0.82); add(new THREE.SphereGeometry(0.045, 6, 5), red, 0.1, 0.84, 0.82);
        for (const x of [-0.05, 0.05]) add(new THREE.ConeGeometry(0.025, 0.1, 4), lam('#efe6cf'), x, 0.6, 1.0).rotation.x = Math.PI;
      }
    }
  }

  setMoving(m: boolean) { this.moving = m; }
  attack() { this.atkT = 0.28; }
  hit() { this.flash(); }
  die() { this.deadFlag = true; this.dieT = 0; }
  revive() { this.deadFlag = false; this.flashT = 0; this.body.rotation.set(0, 0, 0); this.body.scale.set(1, 1, 1); this.body.position.set(0, 0, 0); for (const m of this.mats) m.emissive.setHex(m.userData.e ?? 0); }
  flash(ms = 80) {
    this.flashT = ms;
    for (const m of this.mats) { if (m.userData.e === undefined) m.userData.e = m.emissive.getHex(); m.emissive.setHex(0xffffff); }
  }

  update(dt: number, _now: number) {
    this.t += dt * (this.moving ? 1 : 0.4);
    if (this.flashT > 0) { this.flashT -= dt * 1000; if (this.flashT <= 0) for (const m of this.mats) m.emissive.setHex(m.userData.e ?? 0); }
    if (this.deadFlag) {
      this.dieT += dt;
      const k = Math.min(1, this.dieT / 0.5);
      if (this.kind === 'slime') this.body.scale.set(1 + k * 0.4, 1 - k * 0.85, 1 + k * 0.4);
      else { this.body.rotation.z = k * Math.PI / 2; this.body.position.y = k * 0.18; }
      return;
    }
    const lunge = this.atkT > 0 ? Math.sin((1 - this.atkT / 0.28) * Math.PI) * 0.35 : 0;
    this.atkT = Math.max(0, this.atkT - dt);
    if (this.kind === 'slime') {
      const hop = this.moving ? Math.abs(Math.sin(this.t * 6)) * 0.28 : 0;
      this.body.position.set(0, hop, lunge);
      const sq = 1 + Math.sin(this.t * (this.moving ? 12 : 3)) * 0.06;
      this.body.scale.set(1 / sq, sq, 1 / sq);
    } else {
      const f = this.kind === 'wolf' ? 11 : 16;
      this.legs.forEach((l, i) => { l.rotation.x = this.moving ? Math.sin(this.t * f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7 : 0; });
      this.body.position.set(0, this.moving ? Math.abs(Math.sin(this.t * f)) * 0.05 : 0, lunge);
      if (this.tail) this.tail.rotation.y = Math.sin(this.t * 8) * 0.5;
    }
  }
}

// ---------- aparência dos jogadores ----------
export const CLASS_LOOK: Record<string, ModelSpec> = {
  barbarian: { model: 'Barbarian', show: ['2H_Axe'], melee: '2H_Melee_Attack_Chop' },
  fighter: { model: 'Knight', show: ['1H_Sword', 'Round_Shield'] },
  paladin: { model: 'Knight', show: ['1H_Sword', 'Badge_Shield'], cape: '#f2c84a' },
  cleric: { model: 'Mage', show: ['1H_Wand', 'Spellbook'], cape: '#f4f0ff' },
  wizard: { model: 'Mage', show: ['2H_Staff'] },
  sorcerer: { model: 'Mage', show: ['1H_Wand'], cape: '#e05050' },
  warlock: { model: 'Mage', show: ['1H_Wand', 'Spellbook_open'], cape: '#8a50d0' },
  druid: { model: 'Mage', show: ['2H_Staff'], cape: '#58b060' },
  bard: { model: 'Rogue', show: ['Knife'], cape: '#e060a0' },
  rogue: { model: 'Rogue', show: ['Knife', 'Knife_Offhand'] },
  ranger: { model: 'Rogue', show: ['2H_Crossbow'], cape: '#4a8a4a' },
  monk: { model: 'Barbarian', hide: ['Barbarian_Hat'], melee: 'Unarmed_Melee_Attack_Punch_A' },
  necromancer: { model: 'Mage', show: ['1H_Wand', 'Spellbook_open'], cape: '#2a8a5a' },
  eldknight: { model: 'Knight', show: ['1H_Sword', 'Badge_Shield'], cape: '#4a6ad0' },
  bladesinger: { model: 'Rogue', show: ['Knife', 'Knife_Offhand'], cape: '#a060e0' },
  illusionist: { model: 'Mage', show: ['1H_Wand'], cape: '#d060d0' },
};

export function playerActor(raceId: string, classId: string, tone: string): SkinnedActor {
  const race = RACE_BY_ID[raceId];
  const a = new SkinnedActor(CLASS_LOOK[classId], race.look.scale ?? 1);
  a.setSkin(tone);
  addRacialTraits(a, race.look, tone);
  return a;
}

function addRacialTraits(a: SkinnedActor, look: (typeof RACE_BY_ID)[string]['look'], tone: string) {
  if (!a.head || !a.headBone) return;
  a.model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.head);
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const bone = a.headBone;
  const mk = (geo: THREE.BufferGeometry, color: string, p: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.castShadow = true;
    const wp = new THREE.Vector3(center.x + p[0] * size.x, center.y + p[1] * size.y, center.z + p[2] * size.z);
    bone.add(m);
    m.position.copy(bone.worldToLocal(wp));
    const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
    const bq = bone.getWorldQuaternion(new THREE.Quaternion());
    m.quaternion.copy(bq.invert().multiply(wq));
    m.scale.setScalar(1 / bone.getWorldScale(new THREE.Vector3()).x);
    return m;
  };
  const u = size.y; // referência de tamanho (unidades do modelo)
  if (look.ears) for (const s of [-1, 1]) mk(new THREE.ConeGeometry(u * 0.09, u * 0.5, 4), tone, [s * 0.55, 0.05, 0], [0, 0, -s * 1.15]);
  if (look.horns) for (const s of [-1, 1]) mk(new THREE.ConeGeometry(u * 0.08, u * 0.4, 6), '#7a2030', [s * 0.3, 0.62, 0.0], [0, 0, -s * 0.35]);
  if (look.tusks) for (const s of [-1, 1]) mk(new THREE.ConeGeometry(u * 0.045, u * 0.2, 5), '#f4efe0', [s * 0.18, -0.28, 0.5], [0.3, 0, 0]);
  if (look.snout) mk(new THREE.BoxGeometry(u * 0.5, u * 0.3, u * 0.38), tone, [0, -0.2, 0.55]);
  if (look.beard) mk(new THREE.ConeGeometry(u * 0.28, u * 0.55, 6), '#8a4b2a', [0, -0.5, 0.35], [Math.PI * 0.9, 0, 0]);
  if (look.bigNose) mk(new THREE.SphereGeometry(u * 0.12, 8, 6), tone, [0, -0.1, 0.55]);
}

// ---------- monstros ----------
export const MOB_SPEC: Record<string, ModelSpec | 'rat' | 'wolf' | 'slime' | 'jackal' | 'worg' | 'ratking'> = {
  rat: 'rat', wolf: 'wolf', slime: 'slime', jackal: 'jackal', worg: 'worg',
  // Pequenos: kobold (réptil de chifres e cauda), goblin (orelhas enormes)
  kobold: { model: 'Rogue', skin: '#e08a5a', scale: 0.62, show: ['Knife'], tint: '#d9704a', parts: [{ k: 'horn', c: '#7a4a2a', s: 0.9 }, { k: 'tail', c: '#c25a3a' }, { k: 'eyes', c: '#ffe03a' }, { k: 'nose', c: '#c25a3a' }] },
  goblin: { model: 'Rogue', skin: '#9fd86f', scale: 0.74, show: ['Knife'], tint: '#8fcf5f', parts: [{ k: 'ears', s: 1.5 }, { k: 'eyes', c: '#ff5a2a' }, { k: 'nose', c: '#79b84a', s: 1.2 }] },
  // Mortos-vivos: cada um com um modelo/cor diferente
  skeleton: { model: 'SkMinion', scale: 0.95, eyeColor: '#6fe0ff' },
  zombie: { model: 'Barbarian', skin: '#a8bf94', hide: ['Barbarian_Hat'], tint: '#8fa87a', wide: 1.05, melee: 'Unarmed_Melee_Attack_Punch_A', parts: [{ k: 'eyes', c: '#d8e84a' }] },
  ghoul: { model: 'SkMinion', scale: 1.0, wide: 0.9, tint: '#9fc4a8', eyeColor: '#fff04a', parts: [{ k: 'fangs', c: '#f4f4d0', s: 1.5 }], melee: 'Unarmed_Melee_Attack_Punch_A' },
  shadow: { model: 'SkRogue', scale: 1.15, tint: '#3a2a5a', opacity: 0.6, eyeColor: '#c060ff' },
  skelknight: { model: 'Skeleton', scale: 1.5, tint: '#8aa0d8', eyeColor: '#4aa8ff', parts: [{ k: 'spikes', c: '#9fb0d8' }] },
  // Humanos
  bandit: { model: 'Rogue', scale: 0.95, show: ['Knife'], tint: '#c99a6a', cape: '#5a2a2a' },
  cultist: { model: 'Mage', skin: '#b8a8c8', show: ['1H_Wand'], tint: '#8a7aa8', cape: '#2a1a38', melee: 'Spellcast_Shoot', parts: [{ k: 'eyes', c: '#ff3b3b' }] },
  hobgoblin: { model: 'Knight', skin: '#d8804a', scale: 0.92, show: ['1H_Sword', 'Round_Shield'], tint: '#c4683a', parts: [{ k: 'ears', c: '#c4683a', s: 1.1 }, { k: 'eyes', c: '#ffcc2a' }, { k: 'fangs', s: 1.2 }] },
  // Orcs e parentes: presas, chifres e crinas distintas
  orc: { model: 'Barbarian', hide: ['Barbarian_Hat'], skin: '#8fc86a', scale: 1.12, show: ['1H_Axe'], tint: '#7fb85e', wide: 1.1, parts: [{ k: 'tusks', s: 1.2 }, { k: 'eyes', c: '#ff4a2a' }] },
  orcshaman: { model: 'Mage', skin: '#7ab85a', scale: 1.05, show: ['2H_Staff'], tint: '#6aa84a', cape: '#5a2a6a', melee: 'Spellcast_Shoot', parts: [{ k: 'tusks' }, { k: 'horn', c: '#e8e0c0', s: 1.3 }, { k: 'eyes', c: '#7aff5a' }] },
  gnoll: { model: 'Barbarian', hide: ['Barbarian_Hat'], skin: '#e0b878', scale: 1.1, show: ['1H_Axe'], tint: '#d8b068', wide: 0.95, parts: [{ k: 'ears', c: '#8a6a3a', s: 1.1 }, { k: 'mane', c: '#6a4a22' }, { k: 'tail', c: '#8a6a3a' }, { k: 'fangs', s: 1.3 }, { k: 'eyes', c: '#ff7a2a' }] },
  bugbear: { model: 'Barbarian', skin: '#c08a58', scale: 1.4, show: ['2H_Axe'], tint: '#b07a48', wide: 1.15, melee: '2H_Melee_Attack_Chop', parts: [{ k: 'ears', c: '#8a5a32' }, { k: 'mane', c: '#4a2e18', s: 1.2 }, { k: 'eyes', c: '#ffb02a' }] },
  ogre: { model: 'Barbarian', skin: '#e0c088', scale: 1.9, hide: ['Barbarian_Hat'], tint: '#d9b878', wide: 1.4, melee: 'Unarmed_Melee_Attack_Punch_A', parts: [{ k: 'tusks', s: 1.0 }, { k: 'nose', c: '#c9a468', s: 1 }, { k: 'eyes', c: '#ff6a2a', s: 0.7 }] },
  troll: { model: 'Barbarian', skin: '#6aaa6a', scale: 2.0, hide: ['Barbarian_Hat'], tint: '#4f9a5a', wide: 0.85, melee: 'Unarmed_Melee_Attack_Punch_A', parts: [{ k: 'nose', c: '#3f8a4a', s: 1.3 }, { k: 'tusks', s: 1.1 }, { k: 'spikes', c: '#2a6a34' }, { k: 'eyes', c: '#ff2a2a', s: 1 }] },
  gnarlmaw: { model: 'Barbarian', hide: ['Barbarian_Hat'], skin: '#e0604a', scale: 2.6, show: ['2H_Axe'], tint: '#d04a3a', wide: 1.2, melee: '2H_Melee_Attack_Chop', parts: [{ k: 'hornsBig', c: '#2a1a14', s: 1.1 }, { k: 'tusks', s: 1.0 }, { k: 'spikes', c: '#2a1a14', s: 1.0 }, { k: 'eyes', c: '#ffe03a', s: 1.0 }] },
  // masmorras
  ratking: 'ratking',
  goblinking: { model: 'Rogue', skin: '#80d04f', scale: 1.25, show: ['Knife', 'Knife_Offhand'], tint: '#6fc03f', cape: '#d4a017', parts: [{ k: 'ears', s: 1.8 }, { k: 'crown' }, { k: 'eyes', c: '#ff3a1a', s: 1.3 }, { k: 'nose', c: '#5aa030', s: 1.4 }] },
  warlord: { model: 'Barbarian', hide: ['Barbarian_Hat'], skin: '#6aaa55', scale: 1.75, show: ['2H_Axe'], tint: '#5a9a45', wide: 1.2, melee: '2H_Melee_Attack_Chop', parts: [{ k: 'hornsBig', c: '#c8b890', s: 0.9 }, { k: 'tusks', s: 1.0 }, { k: 'spikes', c: '#8a8a95' }, { k: 'eyes', c: '#ff2a1a', s: 1 }] },
  herald: { model: 'SkMage', scale: 1.55, tint: '#9a7ad0', melee: 'Spellcast_Shoot', parts: [{ k: 'crown', c: '#b080ff', s: 1.1 }], eyeColor: '#d070ff' },
};

export function mobVisual(id: string, defScale: number): Visual {
  const s = MOB_SPEC[id];
  if (typeof s === 'string') {
    const c = new ProcCreature(s);
    c.root.scale.setScalar(defScale);
    return c;
  }
  return new SkinnedActor(s);
}

export const NPC_SPEC: Record<string, ModelSpec> = {
  captain: { model: 'Knight', show: ['Rectangle_Shield'], cape: '#3a5fc0' },
  merchant: { model: 'Rogue', show: [], cape: '#a05ad0' },
  sage: { model: 'Mage', show: ['2H_Staff'], cape: '#5aa0e0' },
  healer: { model: 'Mage', show: ['1H_Wand'], cape: '#f4f0ff' },
  guard: { model: 'Knight', show: ['1H_Sword', 'Rectangle_Shield'], cape: '#b03030' },
  smith: { model: 'Barbarian', hide: ['Barbarian_Hat'], show: ['1H_Axe'], tint: '#d9a37a' },
  innkeeper: { model: 'Rogue', show: ['Mug'], cape: '#c07a2a' },
  priest: { model: 'Mage', show: ['Spellbook'], cape: '#f2d98a' },
  archer: { model: 'Rogue', show: ['2H_Crossbow'], cape: '#4a8a4a' },
  monk: { model: 'Barbarian', hide: ['Barbarian_Hat'], tint: '#e0b588' },
  rogue: { model: 'Rogue', show: ['Knife', 'Knife_Offhand'], cape: '#3b3b4f' },
  cleric: { model: 'Mage', show: ['Spellbook'], cape: '#f2d98a' },
  druid: { model: 'Mage', show: ['2H_Staff'], cape: '#58b060' },
  bard: { model: 'Rogue', show: ['Mug'], cape: '#e060a0' },
  necro: { model: 'Mage', show: ['Spellbook_open'], cape: '#2a8a5a' },
  barbarian: { model: 'Barbarian', hide: ['Barbarian_Hat'], show: ['2H_Axe'], tint: '#d9a37a' },
};

/** Peças seguradas de acordo com o equipamento (arma e mão esquerda); onde o modelo não tem a peça, mantém o padrão da classe. */
export function applyEquipment(a: SkinnedActor, classId: string, eq: { mainhand?: { name: string; twoHanded?: boolean }; offhand?: { name: string; offKind?: string } }) {
  const def = new Set(CLASS_LOOK[classId].show ?? []);
  const out = new Set<string>(def);
  const w = eq.mainhand, o = eq.offhand;
  const pick = (want: string[]) => want.find((n) => a.has(n));
  const swap = (group: RegExp, name: string | undefined) => { if (!name) return; for (const n of [...out]) if (group.test(n)) out.delete(n); out.add(name); };
  if (w) {
    const n = w.name.toLowerCase(), two = !!w.twoHanded;
    const fists = /manopla|punho|kama|bast[ãa]o de combate/.test(n);
    let prop: string | undefined;
    if (a.has('1H_Sword')) prop = fists ? undefined : /machad|martelo|ma[çc]a/.test(n) ? undefined : two ? '2H_Sword' : '1H_Sword';
    else if (a.has('1H_Axe')) prop = fists ? undefined : /espada|montante|l[âa]mina|rapieira|adaga/.test(n) ? undefined : two ? '2H_Axe' : '1H_Axe';
    else if (a.has('2H_Staff')) prop = /cajado|bord[ãa]o|cetro|foice|lâmina/.test(n) && two ? '2H_Staff' : /livro|grim[óo]rio|tomo/.test(n) ? 'Spellbook_open' : '1H_Wand';
    else if (a.has('Knife')) prop = /besta de pulso/.test(n) ? pick(['1H_Crossbow']) : /arco|besta/.test(n) ? pick(['2H_Crossbow']) : 'Knife';
    if (prop && !fists) swap(/^(1H_|2H_|Knife$|Spellbook_open)/, prop);
    if (a.has('Knife') && /arco|besta/.test(n)) out.delete('Knife_Offhand');
  }
  // mão esquerda: escudo só se estiver equipado
  const shields = ['Round_Shield', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', 'Barbarian_Round_Shield'];
  if (a.has('Round_Shield') || a.has('Barbarian_Round_Shield')) {
    for (const sh of shields) out.delete(sh);
    if (o?.offKind === 'shield') {
      const n = o.name.toLowerCase();
      out.add(a.has('Barbarian_Round_Shield') ? 'Barbarian_Round_Shield' : /espinho|spike/.test(n) ? 'Spike_Shield' : /(sol|aurora|radiante|guardi)/.test(n) ? 'Badge_Shield' : /torre|retangular|placa/.test(n) ? 'Rectangle_Shield' : 'Round_Shield');
    }
  }
  if (a.has('Knife_Offhand') && w && !/arco|besta/.test(w.name.toLowerCase())) { if (o?.offKind === 'weapon') out.add('Knife_Offhand'); else out.delete('Knife_Offhand'); }
  if (a.has('1H_Sword_Offhand')) { if (o?.offKind === 'weapon') out.add('1H_Sword_Offhand'); else out.delete('1H_Sword_Offhand'); }
  if (a.has('1H_Axe_Offhand')) { if (o?.offKind === 'weapon') out.add('1H_Axe_Offhand'); else out.delete('1H_Axe_Offhand'); }
  if (a.has('Spellbook')) { if (o?.offKind === 'focus' && /livro|grim[óo]rio|tomo/.test(o.name.toLowerCase())) out.add('Spellbook'); else if (!def.has('Spellbook')) out.delete('Spellbook'); else if (o && o.offKind !== 'focus') out.delete('Spellbook'); }
  a.setHeld([...out]);
}
