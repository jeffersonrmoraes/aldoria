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
  model: 'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Skeleton';
  scale?: number;
  show?: string[];          // itens nas mãos / acessórios visíveis
  hide?: string[];          // peças a esconder (ex.: chapéu)
  tint?: string;            // tinge o modelo todo
  cape?: string;            // tinge capa/chapéu/elmo
  melee?: string;           // clipe de ataque corpo a corpo
}

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
      if (tint && !/_Head$/.test(o.name)) mat.color.copy(tint);
      if (cape && /(Cape|Hat|Helmet|Cloak)$/.test(o.name)) mat.color.copy(cape);
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.play('Idle');
    this.mixer.update(Math.random() * 2);
  }

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

  constructor(public kind: 'rat' | 'wolf' | 'slime') {
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
export const MOB_SPEC: Record<string, ModelSpec | 'rat' | 'wolf' | 'slime'> = {
  rat: 'rat', wolf: 'wolf', slime: 'slime',
  kobold: { model: 'Rogue', scale: 0.62, show: ['Knife'], tint: '#e5835a' },
  goblin: { model: 'Rogue', scale: 0.74, show: ['Knife'], tint: '#a6d878' },
  skeleton: { model: 'Skeleton' },
  zombie: { model: 'Barbarian', hide: ['Barbarian_Hat'], tint: '#9fb88a', melee: 'Unarmed_Melee_Attack_Punch_A' },
  orc: { model: 'Barbarian', scale: 1.12, show: ['1H_Axe'], tint: '#93c276' },
  bugbear: { model: 'Barbarian', scale: 1.4, show: ['2H_Axe'], tint: '#cf9a62', melee: '2H_Melee_Attack_Chop' },
  ogre: { model: 'Barbarian', scale: 1.9, hide: ['Barbarian_Hat'], tint: '#dbb487', melee: 'Unarmed_Melee_Attack_Punch_A' },
  gnarlmaw: { model: 'Barbarian', scale: 2.6, show: ['2H_Axe'], tint: '#e07562', melee: '2H_Melee_Attack_Chop' },
  // masmorras
  ratking: 'rat',
  goblinking: { model: 'Rogue', scale: 1.25, show: ['Knife', 'Knife_Offhand'], tint: '#86c85a', cape: '#d4a017' },
  cultist: { model: 'Mage', show: ['1H_Wand'], tint: '#a3a1b8', cape: '#3a3a48', melee: 'Spellcast_Shoot' },
  skelknight: { model: 'Skeleton', scale: 1.5, tint: '#b9c6ea' },
  warlord: { model: 'Barbarian', scale: 1.75, show: ['2H_Axe'], tint: '#6fae55', melee: '2H_Melee_Attack_Chop' },
  herald: { model: 'Mage', scale: 1.55, show: ['2H_Staff'], tint: '#b0a4d0', cape: '#15151f', melee: 'Spellcast_Shoot' },
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
