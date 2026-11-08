import * as THREE from 'three';
import { CURRENT_CHAPTER } from '../chapters';
import { QUESTS, TILE, WorldData, ZONES, ZoneDef, zoneAt, CX, CY, GATE_HALF } from '../chapters/chapter1';
import { TOWN_R, FOUNTAIN } from '../chapters/mapdims';
import { DUNGEON_BY_ID, DungeonDef, FRAGMENT_BY_ID, MAIN_QUESTS } from '../chapters/story1';
import { generateDungeon } from '../chapters/dungeon';
import { BUILDINGS, BuildingDef, VILLAGES, WAYPOINTS, doorTile, FACE_VEC } from '../chapters/town';
import { sfx, setMusicZone, startMusic } from '../game/audio';
import { reveal, setMapSource } from '../game/mapdata';
import { bench, buildBuilding, buildTownWall, flowerBed, lampPost } from './buildings';
import { buildInterior } from './interiors';
import { buildDungeon, buildPortal } from './dungeonView';
import { CLASS_BY_ID } from '../data/classes';
import { RACE_BY_ID } from '../data/races';
import { MOBS, MobDef, eliteOf } from '../data/monsters';
import { BOSSES, BossAbility } from '../game/bosses';
import { Buff, SkillDef, d20, rand, roll } from '../data/rules';
import { allowedOff, genItem, randGold, rollDrop, RARITY_COLORS, Slot } from '../data/items';
import { MATS, addMats, rollMats } from '../data/materials';
import { bus } from '../game/bus';
import { addItem, derive, Derived, gainXp, player, save, xpForCurrent, xpForNext } from '../game/state';
import { CHAR_H } from '../art/models';
import { MOB_SPEC, NPC_SPEC, SkinnedActor, Visual, applyEquipment, mobVisual, playerActor } from '../art/actors';
import { House, Terrain, buildTerrain } from './terrain';
import { CLASS_FX, ProjKind, Vfx } from './vfx';
import { enchProc } from '../data/enchants';
import { skillMod } from '../data/progression';
import { actionOf } from '../game/keys';
import { dumpValue } from '../data/economy';
import { NetClient } from '../net/online';
import { RemotePlayers } from '../net/remotes';
import { onlineWanted } from '../net/config';
import { getToken } from '../net/account';
import type { HitMsg, HurtMsg, KillMsg, SheetMsg } from '../net/protocol';
import { eliteAt, killXp, skillAt as sharedSkillAt, worldSig } from '../game/combat';

interface Mob {
  def: MobDef;
  v: Visual;
  h: number;
  x: number; y: number; hx: number; hy: number; face: number;
  hp: number; max: number;
  state: 'idle' | 'chase' | 'back';
  nextAtk: number; slow: number; stun: number;
  dead: boolean; deadAt: number; respawn: number; wanderAt: number;
  vx: number; vy: number;
  label?: HTMLDivElement; bar?: HTMLElement;
  boss?: BossState; ghost?: boolean; owner?: Mob;
  /** índice do ponto de spawn no mundo aberto (igual no servidor) e estado vindo dele no modo online */
  idx?: number; tx?: number; ty?: number; sf?: number;
}
interface Area { k: 'c' | 'cone' | 'rect' | 'donut'; x: number; y: number; r: number; inner?: number; ang?: number; half?: number; len?: number; w?: number }
interface Cast { ab: BossAbility; start: number; end: number; dur: number; cancelled: boolean }
interface BossState { phase: number; cds: Record<string, number>; next: number; cast: Cast | null; last: string }
interface Npc { id: string; name: string; x: number; y: number; v: SkinnedActor; label: HTMLDivElement; path?: { x: number; y: number }[]; pi?: number; face?: number }
interface Portal { x: number; y: number; kind: 'in' | 'out' | 'door'; dungeon: string; building?: string; group: THREE.Group; tick(t: number): void; label: HTMLDivElement }
interface Loc {
  id: string; group: THREE.Group; solid: Uint8Array; w: number; h: number;
  groundY: (x: number, y: number) => number; houses: House[];
  mobs: Mob[]; npcs: Npc[]; portals: Portal[]; start: { x: number; y: number };
  zoneOf: (tx: number, ty: number) => string; zones: Record<string, ZoneDef>;
  dungeon?: DungeonDef; braziers?: THREE.Vector3[];
  interior?: { env: [string, string, number]; light: string; pulse: (t: number) => void; def: BuildingDef };
  arena?: { room: { x: number; y: number; w: number; h: number }; ring: { x: number; y: number }[]; gate: THREE.Group | null };
}
interface ActiveBuff { until: number; buff: Buff }
interface Minion { v: Visual; x: number; y: number; until: number; nextAtk: number; face: number; ring: THREE.Mesh }
interface Dot { m: Mob; left: number; next: number; dmg: number; color: number }
interface Fx { update(dt: number): boolean }

const ZONE_SKY: Record<string, [string, string, number]> = {
  town: ['#9fd5ff', '#cfe8ff', 1.0], fields: ['#9fd5ff', '#cfe8ff', 1.0], forest: ['#6f9f86', '#7da58f', 0.8],
  crypt: ['#6b6890', '#7d7aa0', 0.7], orcs: ['#e0a070', '#e8b48a', 0.95], ogre: ['#8a4a4a', '#9a5a55', 0.7],
  v_floresta: ['#6f9f86', '#7da58f', 0.9], v_cripta: ['#6b6890', '#7d7aa0', 0.8], v_orcs: ['#e0a070', '#e8b48a', 1.0], v_ogro: ['#8a4a4a', '#9a5a55', 0.8],
};
const mobHeight = (id: string, scale = 1) => {
  const s = MOB_SPEC[id];
  if (s === 'rat' || s === 'ratking') return 0.55 * scale; if (s === 'wolf' || s === 'jackal' || s === 'worg') return 1.15 * scale; if (s === 'slime') return 0.75 * scale;
  if (typeof s === 'string') return CHAR_H;
  return CHAR_H * (s.scale ?? 1);
};
const CAST_SCALE = 0.55; // casts de chefe ~45% mais rápidos
const def_boss = (id: string): BossState | undefined => (BOSSES[id] ? { phase: 0, cds: {}, next: 0, cast: null, last: '' } : undefined);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export class World3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private labels: HTMLDivElement;
  private box: HTMLElement;
  private world!: WorldData;
  private terrain!: Terrain;
  private loc!: Loc;
  private over!: Loc;
  private mapW = 0; private mapH = 0;
  private overPos = { x: 0, y: 0 };
  private pLight = new THREE.PointLight('#ffc27a', 0, 18, 2);
  private torchLights: THREE.PointLight[] = [];
  private torchAt = 0;
  private mobs: Mob[] = [];
  private npcs: Npc[] = [];
  private p = { x: 0, y: 0, face: 0 };
  private pv!: SkinnedActor;
  private pLabel!: HTMLDivElement;
  private ring!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private d!: Derived;
  private target: Mob | null = null;
  private chase = false;
  private goal: { x: number; y: number } | null = null;
  private nextAtk = 0;
  private cds: Record<string, number> = {};
  private potCd = 0;
  private buffs: ActiveBuff[] = [];
  private dashUntil = 0;
  private pending: { start: number; end: number; run: () => void; root?: boolean } | null = null; // conjuração cancelável (classes à distância)
  private dashV = { x: 0, y: 0 };
  private lastHit = -99999;
  private dead = false;
  private relentlessAt = 0;
  private zoneId = '';
  private hudAt = 0; private saveAt = 0; private zoneChk = 0; private wpAt = 0;
  private now = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private fx: Fx[] = [];
  private fxRoot = new THREE.Group();
  private vfx!: Vfx;
  private minions: Minion[] = [];
  private dots: Dot[] = [];
  private keys = new Set<string>();
  private revealAt = 0;
  private lastRC = 0;
  private yaw = 0; private zoom = 1;
  private camPos = new THREE.Vector3();
  private shake = 0;
  private mouse = new THREE.Vector2();
  private mouseG = { x: 0, y: 0 };
  private drag: { x: number; yaw: number } | null = null;
  private raf = 0;
  private last = 0;
  private ray = new THREE.Raycaster();
  private cleanup: (() => void)[] = [];
  private net: NetClient | null = null;
  /** o servidor confirmou que simula os monstros do mundo aberto (mundo idêntico ao deste cliente) */
  private srvReady = false;
  private remotes: RemotePlayers | null = null;
  private fogCol = new THREE.Color('#cfe8ff');
  private skyCol = new THREE.Color('#9fd5ff');
  private hemiI = 1;

  constructor(private parent: HTMLElement) {
    startMusic();
    this.box = parent;
    parent.innerHTML = '';
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.appendChild(this.renderer.domElement);
    this.labels = document.createElement('div');
    this.labels.id = 'labels';
    parent.appendChild(this.labels);

    this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 200);
    this.scene.background = this.skyCol;
    this.scene.fog = new THREE.Fog(this.fogCol, 30, 70);
    this.hemi = new THREE.HemisphereLight('#dff0ff', '#6a5a48', 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    const self = this;
    this.vfx = new Vfx({ root: this.fxRoot, get list() { return self.fx; } });
    this.build();
    this.bind();
    this.initNet();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- construção ----------
  private build() {
    this.world = CURRENT_CHAPTER.module.generateWorld();
    const terrain = buildTerrain(this.world);
    this.terrain = terrain;
    this.scene.add(this.pLight);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffa860', 0, 12, 2); this.torchLights.push(l); this.scene.add(l); }
    const overMobs: Mob[] = [], overNpcs: Npc[] = [], overPortals: Portal[] = [];

    this.p.x = player.pos.x || this.world.start.x;
    this.p.y = player.pos.y || this.world.start.y;
    if (this.hits(this.p.x, this.p.y, 5)) { this.p.x = this.world.start.x; this.p.y = this.world.start.y; } // save antigo: posição inválida no mapa novo
    setMapSource({ world: this.world, pos: () => (this.loc === this.over ? { x: this.p.x, y: this.p.y } : { ...this.overPos }) });
    reveal(this.p.x / TILE, this.p.y / TILE, 14);
    this.pv = playerActor(player.raceId, player.classId, player.tone, player.look);
    this.scene.add(this.pv.root);
    applyEquipment(this.pv as SkinnedActor, player.classId, player.equipped);
    this.pLabel = this.mkLabel(`${player.name}`, '#fff3c4');

    for (const n of this.world.npcs) {
      const v = new SkinnedActor(NPC_SPEC[n.id]);
      v.root.position.set(n.x / TILE, this.terrain.groundY(n.x, n.y), n.y / TILE);
      v.root.rotation.y = n.face ?? 0;
      overNpcs.push({ id: n.id, name: n.name, x: n.x, y: n.y, v, label: this.mkLabel(n.name, n.id === 'guard' ? '#bcd4ff' : '#ffe9a8'), path: n.path, pi: 1, face: n.face });
    }

    this.world.spawns.forEach((sp, si) => {
      const base = MOBS.find((m) => m.id === sp.mob)!;
      const def = !sp.boss && !base.boss && eliteAt(si) ? eliteOf(base) : base;
      const v = mobVisual(def.id, def.scale);
      v.root.position.set(sp.x / TILE, this.terrain.groundY(sp.x, sp.y), sp.y / TILE);
      v.root.rotation.y = Math.random() * 6.28;
      overMobs.push({
        def, v, h: mobHeight(def.id, def.scale), x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, face: v.root.rotation.y, hp: def.hp, max: def.hp,
        state: 'idle', nextAtk: 0, slow: 0, stun: 0, dead: false, deadAt: 0, respawn: 0, wanderAt: rand(0, 3000), vx: 0, vy: 0,
        boss: def_boss(def.id), idx: sp.boss || base.boss ? undefined : si,
      });
    });

    for (const d of this.world.dungeons) {
      const df = DUNGEON_BY_ID[d.id];
      const pt = buildPortal(df.theme.portal);
      pt.group.position.set(d.x / TILE, terrain.groundY(d.x, d.y), d.y / TILE);
      overPortals.push({ x: d.x, y: d.y, kind: 'in', dungeon: d.id, group: pt.group, tick: pt.update, label: this.mkLabel(df.name, '#d9c8ff') });
    }
    for (const f of this.world.finds) {
      const fq = QUESTS.find((z) => z.id === f.q)!;
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: fq.find!.color }));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: fq.find!.color, transparent: true, opacity: 0.6 }));
      core.position.y = 0.7; halo.position.y = 0.15;
      g.add(core, halo);
      g.position.set(f.x / TILE, terrain.groundY(f.x, f.y), f.y / TILE);
      g.visible = false;
      terrain.group.add(g);
      this.finds.push({ key: `${f.q}:${f.i}`, q: f.q, x: f.x, y: f.y, g, core });
    }
    for (const bd of BUILDINGS) {
      terrain.group.add(buildBuilding(bd, terrain.groundY((bd.x0 + bd.w / 2) * TILE, (bd.y0 + bd.h / 2) * TILE)));
      const d = doorTile(bd), lab = this.mkLabel(bd.name, '#ffe9a8');
      lab.style.visibility = 'hidden';
      overPortals.push({ x: d.tx * TILE + 8, y: d.ty * TILE + 8, kind: 'door', dungeon: '', building: bd.id, group: new THREE.Group(), tick: () => {}, label: lab });
    }
    terrain.group.add(buildTownWall(CX, CY, TOWN_R, GATE_HALF, terrain.groundY(CX * TILE, CY * TILE), 'Pouso do Viajante'));
    const lg = terrain.groundY(CX * TILE, CY * TILE);
    for (let i = 0; i < 10; i++) { const an = ((i + 0.5) / 10) * Math.PI * 2; terrain.group.add(lampPost(CX + 0.5 + Math.cos(an) * 16.4, CY + 0.5 + Math.sin(an) * 16.4, lg)); }
    const fx = FOUNTAIN.x + 0.5, fz = FOUNTAIN.y + 0.5;
    for (const [dx, dz] of [[-6.4, -4.2], [6.4, -4.2], [-6.4, 5.4], [6.4, 5.4]]) terrain.group.add(lampPost(fx + dx, fz + dz, lg));
    // bancos virados para a fonte e canteiros de flores na praça
    for (const [dx, dz] of [[-3.9, -3.0], [3.9, -3.0], [-3.9, 3.2], [3.9, 3.2], [-6.2, 0.1], [6.2, 0.1]]) {
      terrain.group.add(bench(fx + dx, fz + dz, lg, Math.atan2(-dx, -dz)));
    }
    let seed = 1;
    for (const [dx, dz] of [[-2.6, -5.6], [2.6, -5.6], [-3.0, 6.0], [3.0, 6.0], [-7.4, -1.8], [7.4, -1.8], [-7.4, 2.0], [7.4, 2.0]]) terrain.group.add(flowerBed(fx + dx, fz + dz, lg, 0.75, seed++));
    for (const sx of [-2.2, 2.2]) terrain.group.add(flowerBed(CX + 0.5 + sx, CY - 2.6, lg, 0.5, seed++));   // vasos junto à porta da igreja
    // vilas dos biomas: muralha, postes, bancos e canteiros em volta da fonte
    for (const v of VILLAGES) {
      const vg = terrain.groundY(v.cx * TILE, v.cy * TILE);
      terrain.group.add(buildTownWall(v.cx, v.cy, v.r, GATE_HALF, vg, v.name));
      for (let i = 0; i < 6; i++) { const an = ((i + 0.5) / 6) * Math.PI * 2; terrain.group.add(lampPost(v.cx + 0.5 + Math.cos(an) * 6.2, v.cy + 0.5 + Math.sin(an) * 6.2, vg)); }
      for (const [dx, dz] of [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.8], [3.6, 2.8]]) terrain.group.add(bench(v.cx + 0.5 + dx, v.cy + 0.5 + dz, vg, Math.atan2(-dx, -dz)));
      let sd = 40;
      for (const [dx, dz] of [[-2.4, -4.4], [2.4, -4.4], [-2.4, 4.6], [2.4, 4.6]]) terrain.group.add(flowerBed(v.cx + 0.5 + dx, v.cy + 0.5 + dz, vg, 0.7, sd++));
    }
    this.over = {
      id: 'world', group: terrain.group, solid: terrain.solid, w: this.mapWorld().w, h: this.mapWorld().h, groundY: terrain.groundY, houses: terrain.houses,
      mobs: overMobs, npcs: overNpcs, portals: overPortals, start: this.world.start, zoneOf: zoneAt, zones: ZONES,
    };
    this.scene.add(this.fxRoot);
    this.setLoc(this.over);

    const ringGeo = new THREE.RingGeometry(0.62, 0.74, 40).rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95, depthWrite: false }));
    this.ring.visible = false; this.scene.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.visible = false; this.scene.add(this.marker);

    this.camPos.set(this.p.x / TILE, 0, this.p.y / TILE);
    this.d = derive(player);
    bus.emit('log', `Bem-vindo, ${player.name}! Entre no Quartel da Guarda (Capitão Brann) e na Torre do Sábio (Orin) para receber missões — as portas ficam na praça.`, '#ffe9a8');
  }

  private mapWorld() { return { w: this.world.tiles[0].length, h: this.world.tiles.length }; }

  private setLoc(loc: Loc) {
    const old = this.loc;
    if (old) {
      this.scene.remove(old.group);
      for (const m of old.mobs) { this.scene.remove(m.v.root); if (m.label) m.label.style.display = 'none'; if (m.boss) m.boss.cast = null; }
      for (const mn of this.minions) this.scene.remove(mn.v.root, mn.ring);
      this.minions = []; this.dots = [];
      this.fxRoot.clear(); this.fx = [];
      for (const n of old.npcs) { this.scene.remove(n.v.root); n.label.style.display = 'none'; }
      for (const p of old.portals) { this.scene.remove(p.group); p.label.style.display = 'none'; }
    }
    this.remotes?.clear();
    this.loc = loc;
    this.terrain = { group: loc.group, houses: loc.houses, groundY: loc.groundY, solid: loc.solid };
    this.mobs = loc.mobs; this.npcs = loc.npcs; this.mapW = loc.w; this.mapH = loc.h;
    this.scene.add(loc.group);
    for (const m of loc.mobs) this.scene.add(m.v.root);
    for (const n of loc.npcs) this.scene.add(n.v.root);
    for (const p of loc.portals) this.scene.add(p.group);
    (this.scene.fog as THREE.Fog).near = loc.dungeon ? 12 : 30;
    (this.scene.fog as THREE.Fog).far = loc.dungeon ? 42 : 70;
    this.target = null; this.chase = false; this.goal = null; if (this.marker) this.marker.visible = false;
    this.zoneId = ''; this.zoneChk = 0;
    setMusicZone('fields', { dungeon: !!loc.dungeon, interior: !!loc.interior });
    if (old && old !== loc) sfx.door();
    if (loc.interior) { const e = loc.interior.env; this.skyCol.set(e[0]); this.fogCol.set(e[1]); this.hemiI = e[2]; }
    const th = loc.dungeon?.theme;
    if (th) { this.skyCol.set(th.sky); this.fogCol.set(th.fog); this.hemiI = th.ambient; }
  }

  /** Linha de visão simples entre um monstro e o jogador (usada nas masmorras). */
  private los(m: { x: number; y: number }) {
    const dx = this.p.x - m.x, dy = this.p.y - m.y, n = Math.ceil(Math.hypot(dx, dy) / 8);
    for (let i = 1; i < n; i++) if (this.blockedPx(m.x + (dx * i) / n, m.y + (dy * i) / n)) return false;
    return true;
  }

  private nearFountain() {
    if (this.loc !== this.over || this.dead) return null;
    for (const w of WAYPOINTS) if (Math.hypot(this.p.x - (w.x + 0.5) * TILE, this.p.y - (w.y + 0.5) * TILE) < 58) return w;
    return null;
  }

  private teleportTo(id: string) {
    const w = WAYPOINTS.find((q) => q.id === id);
    if (!w || this.loc !== this.over || this.dead) return;
    this.p.x = (w.x + 0.5) * TILE; this.p.y = (w.y + 2.9) * TILE;
    this.target = null; this.pending = null; this.chase = false; this.goal = null;
    bus.emit('log', `✨ Você é envolvido pela luz da fonte e reaparece em ${w.name}.`, '#9ad8ff');
  }

  private nearPortal() {
    for (const p of this.loc.portals) if (this.distTo(p) < 34) return p;
    return null;
  }

  private usePortal(p: Portal) {
    if (this.dead) return;
    if (p.kind === 'out') { this.exitDungeon(); return; }
    if (p.kind === 'door') { this.enterBuilding(BUILDINGS.find((b) => b.id === p.building)!, p); return; }
    const def = DUNGEON_BY_ID[p.dungeon];
    if (def.needs && player.story.fragments.length < def.needs) {
      bus.emit('log', `A porta rúnica permanece selada. Ela exige ${def.needs} fragmentos do Selo (você tem ${player.story.fragments.length}).`, '#ff8a8a');
      return;
    }
    this.enterDungeon(def, p);
  }

  private enterBuilding(def: BuildingDef, from: Portal) {
    const iv = buildInterior(def);
    const npcs: Npc[] = iv.npcs.map((n) => {
      const v = new SkinnedActor(NPC_SPEC[n.id]);
      v.root.position.set(n.x, 0, n.y); v.root.rotation.y = n.face;
      return { id: n.id, name: n.name, x: n.x * TILE, y: n.y * TILE, v, label: this.mkLabel(n.name, '#ffe9a8') };
    });
    const door = new THREE.Group();
    const portals: Portal[] = [{ x: iv.exit.x, y: iv.exit.y, kind: 'out', dungeon: '', group: door, tick: () => {}, label: this.mkLabel('Saída', '#bfe0ff') }];
    const loc: Loc = {
      id: def.id, group: iv.group, solid: iv.solid, w: iv.w, h: iv.h, groundY: () => 0, houses: [],
      mobs: [], npcs, portals, start: iv.start, braziers: iv.lights,
      interior: { env: iv.env, light: iv.light, pulse: iv.pulse, def },
      zoneOf: () => def.id, zones: { [def.id]: { id: def.id, name: def.name, levels: 'Zona segura', mobs: [], count: 0, safe: true } },
    };
    this.overPos = { x: from.x + FACE_VEC[def.facing][0] * 22, y: from.y + FACE_VEC[def.facing][1] * 22 };
    this.setLoc(loc);
    this.p.x = iv.start.x; this.p.y = iv.start.y; this.p.face = Math.PI;
    this.camPos.set(this.p.x / TILE, 0, this.p.y / TILE);
    bus.emit('banner', def.name);
    save();
  }

  private enterDungeon(def: DungeonDef, from: Portal) {
    const dg = generateDungeon(def);
    const view = buildDungeon(dg, def);
    const mobs: Mob[] = [];
    for (const sp of dg.spawns) {
      const md = MOBS.find((m) => m.id === sp.mob)!;
      const v = mobVisual(md.id, md.scale);
      v.root.position.set(sp.x / TILE, 0, sp.y / TILE);
      mobs.push({
        def: md, v, h: mobHeight(md.id, md.scale), x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, face: Math.random() * 6.28, hp: md.hp, max: md.hp,
        state: 'idle', nextAtk: 0, slow: 0, stun: 0, dead: false, deadAt: 0, respawn: 0, wanderAt: rand(0, 3000), vx: 0, vy: 0,
        boss: def_boss(md.id),
      });
    }
    const pt = buildPortal('#5aa8ff');
    pt.group.position.set(dg.exit.x / TILE, 0, dg.exit.y / TILE);
    view.group.add(new THREE.Group());
    const portals: Portal[] = [{ x: dg.exit.x, y: dg.exit.y, kind: 'out', dungeon: def.id, group: pt.group, tick: pt.update, label: this.mkLabel('Saída', '#bfe0ff') }];
    const loc: Loc = {
      id: def.id, group: view.group, solid: view.solid, w: view.w, h: view.h, groundY: () => 0, houses: [],
      mobs, npcs: [], portals, start: dg.start, dungeon: def, braziers: view.braziers,
      zoneOf: () => def.id, zones: { [def.id]: { id: def.id, name: def.name, levels: def.levels, mobs: [], count: 0 } },
    };
    const br = dg.rooms[dg.rooms.length - 1], ring: { x: number; y: number }[] = [];
    for (let y = br.y - 1; y <= br.y + br.h; y++) for (let x = br.x - 1; x <= br.x + br.w; x++) {
      const edge = x === br.x - 1 || x === br.x + br.w || y === br.y - 1 || y === br.y + br.h;
      if (edge && dg.floor[y * dg.w + x]) ring.push({ x, y });
    }
    loc.arena = { room: br, ring, gate: null };
    this.overPos = { x: from.x, y: from.y + 34 };
    this.setLoc(loc);
    this.p.x = dg.start.x; this.p.y = dg.start.y; this.p.face = 0;
    this.camPos.set(this.p.x / TILE, 0, this.p.y / TILE);
    bus.emit('banner', def.name);
    bus.emit('log', def.intro, '#d9c8ff');
    if (player.level < def.minLevel) bus.emit('log', `Perigo: recomendado nível ${def.minLevel}+ (você é nível ${player.level}).`, '#ff8a8a');
    save();
  }

  private exitDungeon() {
    const old = this.loc;
    this.setLoc(this.over);
    this.p.x = this.overPos.x; this.p.y = this.overPos.y; this.p.face = 0;
    this.camPos.set(this.p.x / TILE, 0, this.p.y / TILE);
    this.after(50, () => {
      old.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); } });
      for (const mb of old.mobs) if (mb.label) mb.label.remove();
      for (const pt of old.portals) pt.label.remove();
    });
    bus.emit('log', old.interior ? 'Você saiu para a rua.' : 'Você voltou à superfície.', '#bfe0ff');
    for (const n of old.npcs) n.label.remove();
    save();
  }

  private bind() {
    const el = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement, e: K, f: (ev: HTMLElementEventMap[K]) => void) => { t.addEventListener(e, f as EventListener); this.cleanup.push(() => t.removeEventListener(e, f as EventListener)); };
    const onW = <K extends keyof WindowEventMap>(e: K, f: (ev: WindowEventMap[K]) => void) => { window.addEventListener(e, f as EventListener); this.cleanup.push(() => window.removeEventListener(e, f as EventListener)); };
    on(el, 'contextmenu', (e) => e.preventDefault());
    on(el, 'pointerdown', (e) => {
      this.setMouse(e);
      if (e.button === 2) {
        const now = performance.now();
        if (now - this.lastRC < 350) { this.yaw = 0; this.zoom = 1; this.drag = null; this.lastRC = 0; return; }
        this.lastRC = now;
        this.drag = { x: e.clientX, yaw: this.yaw }; el.setPointerCapture(e.pointerId); return;
      }
      if (e.button === 0) this.onClick();
    });
    on(el, 'pointermove', (e) => {
      this.setMouse(e);
      if (this.drag) this.yaw = this.drag.yaw - (e.clientX - this.drag.x) * 0.008;
      else this.hover();
    });
    on(el, 'pointerup', (e) => { if (e.button === 2) this.drag = null; });
    on(el, 'wheel', (e) => { e.preventDefault(); this.zoom = Math.min(1.5, Math.max(0.55, this.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); });
    onW('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (e.repeat) return;
      const act = actionOf(k);
      if (act && act.startsWith('skill')) this.useSkill(Number(act.slice(5)) - 1);
      else if (act === 'potHeal') this.usePotion('heal');
      else if (act === 'potEnergy') this.usePotion('energy');
      else if (k === 'enter') this.openChat();
      else if (k === 'e') { const n = this.nearNpc(); if (n) bus.emit('npc', n.id); else { const pt = this.nearPortal(); if (pt) this.usePortal(pt); else if (this.nearFountain()) bus.emit('fountain'); } }
    });
    onW('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    onW('blur', () => this.keys.clear());
    onW('resize', () => this.resize());
    const ro = new ResizeObserver(() => this.resize()); ro.observe(this.box); this.cleanup.push(() => ro.disconnect());

    const handlers: [string, (...a: any[]) => void][] = [
      ['skill', (i: number) => this.useSkill(i)],
      ['teleport', (id: string) => this.teleportTo(id)],
      ['potion', (k: 'heal' | 'energy') => this.usePotion(k)],
      ['blessing', (_n: string, buff: Buff, ms: number) => { this.buffs.push({ until: this.now + ms, buff }); }],
      ['recalc', () => { applyEquipment(this.pv as SkinnedActor, player.classId, player.equipped); this.d = derive(player); player.hp = Math.min(player.hp, this.d.maxHp); player.en = Math.min(player.en, this.d.maxEn); }],
      ['levelup', () => { sfx.levelUp(); this.ringFx(this.p.x, this.p.y, 0xf1c40f, 3.2); this.ringFx(this.p.x, this.p.y, 0xffffff, 2); }],
    ];
    for (const [e, f] of handlers) { bus.removeAllListeners(e === 'levelup' ? '__none' : e); bus.on(e, f); this.cleanup.push(() => bus.off(e, f)); }
  }

  // ---------- online (fase 1: presença e chat) ----------
  private initNet() {
    this.remotes = new RemotePlayers(this.scene, this.labels);
    const chat = document.getElementById('chat') as HTMLInputElement | null;
    if (chat) {
      chat.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { const t = chat.value.trim(); if (t) this.net?.chat(t); chat.value = ''; chat.classList.add('hidden'); chat.blur(); }
        else if (e.key === 'Escape') { chat.value = ''; chat.classList.add('hidden'); chat.blur(); }
      };
      chat.onkeyup = (e) => e.stopPropagation();
    }
    if (!onlineWanted()) { bus.emit('net', 'off'); return; }
    if (!getToken()) { bus.emit('net', 'off'); bus.emit('log', 'Para jogar online, entre na sua conta no menu inicial.', '#ffb3a0'); return; }
    let lastSt = '';
    this.net = new NetClient({
      status: (s, d) => {
        bus.emit('net', s, d); if (d && s !== lastSt) bus.emit('log', d, s === 'error' ? '#ffb3a0' : '#9fe3ff'); lastSt = s;
        if (s !== 'on') this.srvReady = false;     // caiu a conexão: os monstros voltam a ser simulados localmente
      },
      warn: (m) => bus.emit('log', `O servidor ignorou itens que o jogo não gera (não valem online): ${m.items.join('; ')}`, '#ffb3a0'),
      ready: (m) => {
        const ok = m.h === worldSig(this.world.spawns);
        if (ok && !this.srvReady) bus.emit('log', 'Monstros do mundo agora são compartilhados com os outros jogadores.', '#9fe3ff');
        if (!ok) bus.emit('log', 'O servidor tem uma versão diferente do mundo — monstros seguem locais. Recarregue a página (Ctrl+F5).', '#ffb3a0');
        this.srvReady = ok;
        this.net?.resendSheet();
      },
      mobs: (a) => this.onMobs(a),
      hit: (h) => this.onSrvHit(h),
      matk: (m) => { const mob = this.over.mobs[m.m]; if (mob && !mob.dead && this.isSrv(mob) && mob.v.root.visible) mob.v.attack(); },
      hurt: (h) => this.onSrvHurt(h),
      kill: (k) => this.onSrvKill(k),
      roster: (l) => this.remotes?.setRoster(l),
      join: (p) => this.remotes?.add(p),
      leave: (id) => this.remotes?.remove(id),
      snap: (s) => this.remotes?.snap(s),
      chat: (m) => {
        if (m.ch === 'sistema') { bus.emit('log', m.t, '#ffb3a0'); return; }
        if (m.ch === 'grupo') { bus.emit('log', `[Grupo] ${m.name}: ${m.t}`, '#b8f5a8'); return; }
        bus.emit('log', `${m.name}: ${m.t}`, m.id === this.net?.selfId ? '#fff3c4' : '#cfe9ff');
        if (m.id !== this.net?.selfId) this.remotes?.say(m.id, m.t);
      },
    });
    void this.net.connect({ name: player.name, raceId: player.raceId, classId: player.classId, tone: player.tone, look: player.look as unknown as Record<string, unknown> | undefined, level: player.level, tok: getToken() });
  }

  // ---------- monstros do servidor (modo online) ----------
  /** objetos das missões de achar coisas (visíveis só com a missão ativa e ainda não recolhidos) */
  private finds: { key: string; q: string; x: number; y: number; g: THREE.Group; core: THREE.Mesh }[] = [];
  private cmpAt = 0;
  /** bússola: aponta para o objeto de missão mais próximo (relativo à câmera) */
  private updateCompass(now: number) {
    if (now < this.cmpAt) return;
    this.cmpAt = now + 90;
    let best: (typeof this.finds)[number] | null = null, bd = Infinity;
    if (this.loc === this.over) for (const f of this.finds) {
      const st = player.quests[f.q];
      if (!st || st.state !== 'active' || st.got?.includes(f.key)) continue;
      const d = Math.hypot(f.x - this.p.x, f.y - this.p.y);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) { bus.emit('compass', null); return; }
    const dx = (best.x - this.p.x) / TILE, dz = (best.y - this.p.y) / TILE;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const sx = dx * cy - dz * sy, up = -dx * sy - dz * cy;     // componentes na tela (direita, frente)
    const fq = QUESTS.find((z) => z.id === best!.q)!;
    bus.emit('compass', { ang: Math.atan2(-up, sx) , dist: bd / TILE, name: fq.find!.name, icon: fq.find!.icon });
  }
  private updateFinds(now: number) {
    this.updateCompass(now);
    for (const f of this.finds) {
      const st = player.quests[f.q];
      const on = this.loc === this.over && !!st && st.state === 'active' && !st.got?.includes(f.key);
      f.g.visible = on;
      if (!on) continue;
      f.core.position.y = 0.7 + Math.sin(now / 400 + f.x) * 0.12; f.core.rotation.y = now / 600;
      if (Math.hypot(f.x - this.p.x, f.y - this.p.y) < TILE * 2.4) {
        const fq = QUESTS.find((z) => z.id === f.q)!;
        (st.got ??= []).push(f.key);
        st.progress = st.got.length;
        sfx.loot(2);
        this.vfx.rise(this.P(f.x, f.y, 0.4), fq.find!.color, 14, 0.7, 0.9);
        if (st.progress >= fq.count) { st.state = 'ready'; bus.emit('log', `${fq.find!.name} ${st.progress}/${fq.count} — missão cumprida: ${fq.title}! Volte ao Capitão Brann.`, '#7ee787'); }
        else bus.emit('log', `Você encontrou: ${fq.find!.name} (${st.progress}/${fq.count})`, '#ffe9a8');
        save();
      }
    }
  }
  private srvOn() { return this.srvReady && this.net?.status === 'on' && this.loc === this.over; }
  private isSrv(m: Mob) { return m.idx !== undefined && this.srvOn(); }

  private sheetMsg(): SheetMsg {
    return { raceId: player.raceId, classId: player.classId, level: player.level, equipped: player.equipped as Record<string, unknown>, skills: player.skills, attrs: player.attrs, wskills: player.wskills, bar: player.bar };
  }

  /** instantâneo de monstros próximos: [idx, x, y, hp, flags, face] (flags: 1 morto, 2 perseguindo, 4 andando) */
  private onMobs(a: number[]) {
    if (!this.srvOn()) return;
    const list = this.over.mobs;
    for (let k = 0; k + 5 < a.length; k += 6) {
      const m = list[a[k]];
      if (!m || m.idx === undefined) continue;
      m.tx = a[k + 1]; m.ty = a[k + 2]; m.hp = a[k + 3]; m.sf = a[k + 4]; m.face = a[k + 5];
      m.state = m.sf & 2 ? 'chase' : 'idle';
      if (m.sf & 1) { if (!m.dead) this.srvDie(m); }
      else if (m.dead) { m.dead = false; m.x = m.tx; m.y = m.ty; m.v.revive(); m.v.root.visible = true; }
    }
  }
  private srvDie(m: Mob) {
    m.dead = true; m.vx = m.vy = 0; m.deadAt = this.now;
    if (Math.hypot(this.p.x - m.x, this.p.y - m.y) < 400) sfx.mobDie();
    m.v.setMoving(false); m.v.die();
    if (this.target === m) { this.target = null; this.chase = false; }
  }
  private updateSrvMob(m: Mob, now: number, dt: number) {
    const root = m.v.root;
    const far = Math.hypot(this.p.x - m.x, this.p.y - m.y) > 620;
    if (m.dead) {
      if (root.visible && now - m.deadAt > 1800) root.visible = false;
      else if (root.visible && !far) m.v.update(dt, now);
      return;
    }
    root.visible = !far;
    if (m.tx !== undefined && m.ty !== undefined) {
      const dx = m.tx - m.x, dy = m.ty - m.y;
      if (Math.abs(dx) + Math.abs(dy) > 70) { m.x = m.tx; m.y = m.ty; }
      else { const k = Math.min(1, dt * 12); m.x += dx * k; m.y += dy * k; }
    }
    const moving = ((m.sf ?? 0) & 4) !== 0;
    m.v.setMoving(moving, moving ? m.def.speed / 60 : 0);
    root.position.copy(this.P(m.x, m.y));
    this.turn(root, m.face, dt);
    if (!far) m.v.update(dt, now);
  }
  /** resultado (decidido no servidor) de um golpe em um monstro */
  private onSrvHit(h: HitMsg) {
    const m = this.over.mobs[h.m];
    if (!m || m.dead || !this.srvOn() || !m.v.root.visible) return;
    const mine = h.by === this.net?.selfId;
    if (h.k === 'm') { if (mine) { sfx.miss(); this.float(this.P(m.x, m.y, m.h + 0.1), 'Errou', '#b8b8c8', 7); } return; }
    const crit = h.c === 1;
    m.hp = Math.max(0, m.hp - h.d);
    if (mine || h.k !== 'p') sfx.hit(crit);
    this.float(this.P(m.x, m.y, m.h * 0.9), (crit ? '¡' : '') + h.d + (crit ? '!' : ''), crit ? '#ffd23f' : mine ? '#ffffff' : '#cfd6ff', crit ? 12 : mine ? 9 : 7);
    this.burst(this.P(m.x, m.y, m.h * 0.55), h.col ?? (mine ? CLASS_BY_ID[player.classId].atkColor : 0xcfd6ff));
    if (crit) this.vfx.impact(this.P(m.x, m.y, m.h * 0.6), 0xffd23f, true);
    m.v.flash(); m.v.hit();
    if (!mine) return;
    if (!this.target) this.target = m;
    if ((h.k === 'h' || h.k === 'd') && this.d.lifesteal > 0 && player.hp < this.d.maxHp) {
      const g = Math.max(1, Math.round(h.d * this.d.lifesteal));
      player.hp = Math.min(this.d.maxHp, player.hp + g);
      this.float(this.P(this.p.x, this.p.y, 2.0), '+' + g, '#ff8aa0', 7);
    }
    if (h.k === 'd') {
      const g = Math.max(1, Math.round(h.d * 0.5));
      player.hp = Math.min(this.d.maxHp, player.hp + g);
      this.float(this.P(this.p.x, this.p.y, 2.1), '+' + g, '#7ee787', 9);
      this.vfx.rise(this.P(this.p.x, this.p.y, 0), 0x7ee787, 8, 0.6, 0.9);
    }
  }
  /** golpe de um monstro em mim (acerto e dano decididos no servidor) */
  private onSrvHurt(h: HurtMsg) {
    if (this.dead || !this.srvOn()) return;
    const head = this.P(this.p.x, this.p.y, 2.0);
    if (h.d <= 0) { this.float(head, 'Esquivou', '#b8b8c8', 7); return; }
    const m = this.over.mobs[h.m];
    if (m && !this.target && !m.dead) this.target = m;
    this.lastHit = this.now;
    player.hp -= h.d; sfx.hurt();
    this.float(head, '-' + h.d, h.c ? '#ff5050' : '#ff8a8a', h.c ? 11 : 9);
    this.pv.flash(); this.pv.hit();
    this.shake = 0.08;
    if (player.hp <= 0) this.die(this.now);
  }
  /** recompensa de uma morte da qual participei: XP e ouro calculados pelo servidor */
  private onSrvKill(k: KillMsg) {
    const m = this.over.mobs[k.m];
    if (!m || !this.srvOn()) return;
    this.grantKill(m.def, k.xp, k.gold, m);
  }

  private openChat() {
    if (this.net?.status !== 'on') return;
    const chat = document.getElementById('chat') as HTMLInputElement | null;
    if (!chat) return;
    this.keys.clear();
    chat.classList.remove('hidden'); chat.focus();
  }

  /** Teste/depuração: move o jogador para uma posição em tiles. */
  teleport(tx: number, ty: number) { this.p.x = tx * TILE + 8; this.p.y = ty * TILE + 8; this.camPos.set(tx, 0, ty); }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.net?.disconnect(); this.remotes?.dispose();
    this.cleanup.forEach((f) => f());
    this.renderer.dispose();
    this.parent.innerHTML = '';
  }

  private resize() {
    const w = this.box.clientWidth || window.innerWidth, h = this.box.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- utilidades ----------
  private after(ms: number, fn: () => void) { this.timers.push({ at: this.now + ms, fn }); }
  private P(x: number, y: number, h = 0) { return new THREE.Vector3(x / TILE, this.terrain.groundY(x, y) + h, y / TILE); }
  private screen(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.box.clientWidth, y: (-p.y * 0.5 + 0.5) * this.box.clientHeight, behind: p.z > 1 };
  }
  private mkLabel(name: string, color: string) {
    const el = document.createElement('div');
    el.className = 'lb'; el.style.color = color; el.textContent = name;
    this.labels.appendChild(el);
    return el;
  }
  private place(el: HTMLElement, v: THREE.Vector3) {
    const s = this.screen(v);
    if (s.behind) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.transform = `translate(${s.x.toFixed(0)}px,${s.y.toFixed(0)}px) translate(-50%,-100%)`;
  }
  private float(pos: THREE.Vector3, txt: string, color = '#ffffff', size = 9) {
    const s = this.screen(pos);
    const el = document.createElement('div');
    el.className = 'ft'; el.textContent = txt; el.style.color = color; el.style.fontSize = Math.round(size * 1.7) + 'px';
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    el.addEventListener('animationend', () => el.remove());
    this.labels.appendChild(el);
  }

  private buffSum(): Required<Buff> {
    const t = this.now;
    const s = { ac: 0, dmg: 0, speed: 0, regen: 0, atkSpeed: 0 };
    this.buffs = this.buffs.filter((b) => b.until > t);
    for (const b of this.buffs) for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += b.buff[k] ?? 0;
    return s;
  }

  private distTo(m: { x: number; y: number }) { return Math.hypot(this.p.x - m.x, this.p.y - m.y); }
  private nearest(range: number): Mob | null {
    let best: Mob | null = null, bd = range;
    for (const m of this.mobs) { if (m.dead) continue; const dd = this.distTo(m); if (dd <= bd) { bd = dd; best = m; } }
    return best;
  }
  private pickTarget(range: number): Mob | null {
    if (this.target && !this.target.dead && this.distTo(this.target) <= range) return this.target;
    const n = this.nearest(range);
    if (n) this.target = n;
    return n;
  }
  private nearNpc() {
    for (const n of this.npcs) if (this.distTo(n) < 34) return n;
    return null;
  }

  // ---------- efeitos visuais ----------
  private ringFx(x: number, y: number, color: number, radius: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(this.P(x, y, 0.15)); this.fxRoot.add(m);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt / 0.4; const k = Math.min(1, t); m.scale.setScalar(0.2 + k * radius); (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k); if (k >= 1) { this.fxRoot.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); return false; } return true; } });
  }
  private burst(pos: THREE.Vector3, color: number) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos); this.fxRoot.add(m);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt / 0.22; m.scale.setScalar(1 + t * 1.6); (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t); if (t >= 1) { this.fxRoot.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); return false; } return true; } });
  }
  private sector(x: number, y: number, ang: number, rad: number, color: number) {
    const pts: number[] = [];
    const n = 16, a0 = ang - 0.7, a1 = ang + 0.7;
    for (let i = 0; i < n; i++) {
      const u = a0 + ((a1 - a0) * i) / n, w = a0 + ((a1 - a0) * (i + 1)) / n;
      pts.push(0, 0, 0, Math.cos(u) * rad, 0, Math.sin(u) * rad, Math.cos(w) * rad, 0, Math.sin(w) * rad);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(this.P(x, y, 0.2)); this.fxRoot.add(m);
    let t = 0;
    this.fx.push({ update: (dt) => { t += dt / 0.35; (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t); if (t >= 1) { this.fxRoot.remove(m); g.dispose(); (m.material as THREE.Material).dispose(); return false; } return true; } });
  }

  /** efeito de projétil da classe (a besta de pulso do patrulheiro dispara virotes curtos) */
  private weaponFxKind(): ProjKind | undefined {
    const w = player.equipped.mainhand;
    if (player.classId === 'ranger' && w && /^(besta de pulso|braçadeira)/i.test(w.name)) return 'quarrel';
    return CLASS_FX[player.classId]?.proj;
  }
  private shoot(m: Mob, color: number, onHit: () => void, delay = 0, kind?: ProjKind) {
    const fire = () => {
      const fx = CLASS_FX[player.classId];
      const k = kind ?? this.weaponFxKind() ?? 'orb';
      const from = this.P(this.p.x, this.p.y, CHAR_H * 0.65);
      const dist = Math.hypot(this.p.x - m.x, this.p.y - m.y);
      const dur = Math.max(0.12, dist * (k === 'arrow' ? 0.0042 : k === 'skull' || k === 'note' ? 0.0046 : 0.0032));
      this.vfx.projectile(k, from, () => this.P(m.x, m.y, m.h * 0.55), color, fx?.color2 ?? color, dur, () => { if (!m.dead) onHit(); });
    };
    if (delay) this.after(delay, fire); else fire();
  }

  // ---------- entrada ----------
  private setMouse(e: PointerEvent | MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const pt = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), pt)) { this.mouseG.x = pt.x * TILE; this.mouseG.y = pt.z * TILE; }
  }
  private pickAt(): { mob?: Mob; npc?: Npc; portal?: Portal } {
    let best = 1e9; const out: { mob?: Mob; npc?: Npc; portal?: Portal } = {};
    const sph = new THREE.Sphere(), hit = new THREE.Vector3();
    for (const m of this.mobs) {
      if (m.dead || !m.v.root.visible) continue;
      sph.center.copy(this.P(m.x, m.y, m.h * 0.5)); sph.radius = Math.max(0.55, m.h * 0.38);
      if (this.ray.ray.intersectSphere(sph, hit)) { const dd = hit.distanceTo(this.ray.ray.origin); if (dd < best) { best = dd; out.mob = m; out.npc = undefined; } }
    }
    for (const n of this.npcs) {
      sph.center.copy(this.P(n.x, n.y, 0.8)); sph.radius = 0.7;
      if (this.ray.ray.intersectSphere(sph, hit)) { const dd = hit.distanceTo(this.ray.ray.origin); if (dd < best) { best = dd; out.npc = n; out.mob = undefined; } }
    }
    for (const pt of this.loc.portals) {
      sph.center.copy(this.P(pt.x, pt.y, 1.4)); sph.radius = 1.7;
      if (this.ray.ray.intersectSphere(sph, hit)) { const dd = hit.distanceTo(this.ray.ray.origin); if (dd < best) { best = dd; out.portal = pt; out.mob = undefined; out.npc = undefined; } }
    }
    return out;
  }
  private hover() { this.renderer.domElement.style.cursor = (() => { const k = this.pickAt(); return k.mob ? 'crosshair' : k.npc || k.portal ? 'pointer' : 'default'; })(); }
  private onClick() {
    if (this.dead) return;
    const { mob, npc, portal } = this.pickAt();
    if (portal) { if (this.distTo(portal) < 40) this.usePortal(portal); else { this.goal = { x: portal.x, y: portal.kind === 'door' ? portal.y : portal.y + 26 }; this.chase = false; } return; }
    if (mob) { this.target = mob; this.chase = true; this.goal = null; return; }
    if (npc && this.distTo(npc) < 40) { bus.emit('npc', npc.id); return; }
    this.goal = { x: npc ? npc.x : this.mouseG.x, y: npc ? npc.y + 14 : this.mouseG.y }; this.chase = false;
    this.marker.visible = true; this.marker.position.copy(this.P(this.goal.x, this.goal.y, 0.12));
  }

  // ---------- colisão ----------
  private blockedPx(x: number, y: number) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.mapW || ty >= this.mapH) return true;
    return this.terrain.solid[ty * this.mapW + tx] === 1;
  }
  private hits(x: number, y: number, r: number) { return this.blockedPx(x - r, y - r) || this.blockedPx(x + r, y - r) || this.blockedPx(x - r, y + r) || this.blockedPx(x + r, y + r); }
  private move(e: { x: number; y: number }, vx: number, vy: number, dt: number, r = 4) {
    const nx = e.x + vx * dt; if (!this.hits(nx, e.y, r)) e.x = nx;
    const ny = e.y + vy * dt; if (!this.hits(e.x, ny, r)) e.y = ny;
  }
  private turn(obj: THREE.Object3D, target: number, dt: number) {
    let d = target - obj.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    obj.rotation.y += d * Math.min(1, dt * 14);
  }

  // ---------- laço principal ----------
  private frame(t: number) {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    this.now += dt * 1000;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    const now = this.now;
    this.d = derive(player);
    const buff = this.buffSum();
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= now) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    const cur = this.fx; this.fx = [];
    for (const f of cur) if (f.update(dt)) this.fx.push(f); // efeitos criados durante o update (ex.: burst do onHit) sobrevivem

    this.updateArena(now);
    if (!this.dead) this.updatePlayer(now, dt, buff);
    for (const m of this.mobs.slice()) this.updateMob(m, now, dt, buff);
    this.updateMinions(now, dt);
    this.updateDots(now);

    if (!this.dead) {
      player.en = Math.min(this.d.maxEn, player.en + this.d.regenEn * dt);
      const calm = now - this.lastHit > 5000;
      player.hp = Math.min(this.d.maxHp, player.hp + ((calm ? this.d.regenHp : 0) + buff.regen) * dt);
    }

    // jogador no mundo
    const pr = this.pv.root;
    pr.position.copy(this.P(this.p.x, this.p.y));
    this.turn(pr, this.p.face, dt);
    this.pv.update(dt, now);
    this.remotes?.update(dt, now, (x, y, h) => this.P(x, y, h), (el, v) => this.place(el, v));
    this.net?.tick(now, this.p.x, this.p.y, this.p.face, this.pv.isMoving, this.loc.id, this.dead);
    this.net?.sheet(this.sheetMsg(), now);
    for (const n of this.npcs) {
      const near = this.distTo(n) < 90;
      if (n.path && !(near && this.distTo(n) < 40)) {
        const t = n.path[n.pi! % n.path.length], dx = t.x - n.x, dy = t.y - n.y, d = Math.hypot(dx, dy);
        if (d < 3) n.pi = (n.pi! + 1) % n.path.length;
        else { n.x += (dx / d) * 24 * dt; n.y += (dy / d) * 24 * dt; this.turn(n.v.root, Math.atan2(dx, dy), dt); }
        n.v.setMoving(true, 0.45);
        n.v.root.position.set(n.x / TILE, this.terrain.groundY(n.x, n.y), n.y / TILE);
      } else {
        if (n.path) n.v.setMoving(false);
        if (near) this.turn(n.v.root, Math.atan2(this.p.x - n.x, this.p.y - n.y), dt);
        else if (n.face != null) this.turn(n.v.root, n.face, dt);
      }
      n.v.update(dt, now);
    }

    // casas ficam translúcidas quando escondem o jogador
    for (const h of this.terrain.houses) {
      const px = this.p.x / TILE, pz = this.p.y / TILE;
      const hide = Math.abs(px - h.cx) < 3.4 && pz < h.cz + 1.4 && pz > h.cz - 7.5;
      h.fade += ((hide ? 1 : 0) - h.fade) * Math.min(1, dt * 8);
      for (const m of h.mats) { m.transparent = h.fade > 0.02; (m as THREE.MeshLambertMaterial).opacity = 1 - h.fade * 0.78; m.depthWrite = h.fade < 0.5; }
    }

    // portais, ambiente (superfície por zona; masmorra por tema) e luzes
    for (const pt of this.loc.portals) { pt.tick(now / 1000); this.place(pt.label, this.P(pt.x, pt.y, 4.1)); }
    const dd = this.loc.dungeon;
    const iv = this.loc.interior;
    if (iv) iv.pulse(now / 1000);
    const lightCol = dd ? dd.theme.light : iv ? iv.light : null;
    const z: [string, string, number] = dd ? [dd.theme.sky, dd.theme.fog, dd.theme.ambient] : iv ? iv.env : (ZONE_SKY[this.zoneId] ?? ZONE_SKY.fields);
    this.pLight.intensity = dd ? 11 : iv ? 6 : 0;
    this.pLight.color.set(lightCol ?? '#ffc27a');
    this.pLight.position.copy(this.P(this.p.x, this.p.y, 3.4));
    if (lightCol && now > this.torchAt) {
      this.torchAt = now + 250;
      const px = this.p.x / TILE, pz = this.p.y / TILE;
      const near = [...(this.loc.braziers ?? [])].sort((a, b) => (a.x - px) ** 2 + (a.z - pz) ** 2 - ((b.x - px) ** 2 + (b.z - pz) ** 2)).slice(0, 4);
      this.torchLights.forEach((l, i) => { if (near[i]) { l.position.copy(near[i]); l.intensity = 14 + Math.sin(now * 0.01 + i) * 2; l.color.set(lightCol); } else l.intensity = 0; });
    } else if (!lightCol) for (const l of this.torchLights) l.intensity = 0;
    this.skyCol.lerp(new THREE.Color(z[0]), dt * 1.5);
    this.fogCol.lerp(new THREE.Color(z[1]), dt * 1.5);
    (this.scene.fog as THREE.Fog).color.copy(this.fogCol);
    this.hemiI += (z[2] - this.hemiI) * dt * 1.5; this.hemi.intensity = 1.05 * this.hemiI;
    this.sun.intensity = dd ? 1.0 : iv ? 0.7 : 2.1 * (0.55 + this.hemiI * 0.45);

    // câmera
    const tgt = new THREE.Vector3(this.p.x / TILE, this.terrain.groundY(this.p.x, this.p.y) + 0.8, this.p.y / TILE);
    this.camPos.lerp(tgt, 1 - Math.exp(-dt * 7));
    const pitch = 0.74, dist = 24 * this.zoom;
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch)).multiplyScalar(dist);
    this.camera.position.copy(this.camPos).add(off);
    if (this.shake > 0) { this.shake -= dt; this.camera.position.x += (Math.random() - 0.5) * 0.12; this.camera.position.y += (Math.random() - 0.5) * 0.12; }
    this.camera.lookAt(this.camPos);
    this.sun.position.copy(this.camPos).add(new THREE.Vector3(-11, 22, 9));
    this.sun.target.position.copy(this.camPos);

    // alvo, marcador, rótulos
    const t = this.target && !this.target.dead ? this.target : null;
    this.ring.visible = !!t;
    if (t) {
      this.ring.position.copy(this.P(t.x, t.y, 0.1));
      this.ring.scale.setScalar(Math.max(0.9, t.h * 0.55) * (1 + Math.sin(now * 0.008) * 0.06));
    }
    if (this.goal) { if (Math.hypot(this.goal.x - this.p.x, this.goal.y - this.p.y) < 6) { this.goal = null; this.marker.visible = false; } else this.marker.rotation.y += dt * 3; }
    this.place(this.pLabel, this.P(this.p.x, this.p.y, CHAR_H * (RACE_BY_ID[player.raceId].look.scale ?? 1) + 0.35));
    for (const n of this.npcs) this.place(n.label, this.P(n.x, n.y, CHAR_H + 0.3));
    for (const m of this.mobs) this.mobLabel(m, t);

    // zona / HUD / save
    if (now > this.zoneChk) {
      this.zoneChk = now + 400;
      const zn = this.loc.zoneOf(Math.floor(this.p.x / TILE), Math.floor(this.p.y / TILE));
      if (zn !== this.zoneId) { this.zoneId = zn; setMusicZone(zn); bus.emit('zone', this.loc.zones[zn]); }
    }
    this.updateFinds(now);
    this.terrain.update?.(now / 1000);
    if (this.loc === this.over && now > this.wpAt) {
      this.wpAt = now + 700;
      const w = WAYPOINTS.find((q) => q.zone === this.zoneId);
      if (w && !(player.wp ??= []).includes(w.id)) { player.wp.push(w.id); bus.emit('log', `✨ Fonte de ${w.name} descoberta! Toque nela ([E]) para teleportar entre as fontes.`, '#9ad8ff'); save(); }
    }
    if (this.loc === this.over && now > this.revealAt) { this.revealAt = now + 400; reveal(this.p.x / TILE, this.p.y / TILE, 12); }
    if (now > this.hudAt) { this.hudAt = now + 100; this.emitHud(now); }
    if (now > this.saveAt) { this.saveAt = now + 8000; player.pos = this.loc === this.over ? { x: this.p.x, y: this.p.y } : { ...this.overPos }; save(); }
  }

  private mobLabel(m: Mob, target: Mob | null) {
    const near = !m.dead && m.v.root.visible && Math.hypot(this.p.x - m.x, this.p.y - m.y) < 220;
    const want = near && (m.hp < m.max || !!m.def.elite || m === target || (!!m.boss && m.state === 'chase'));
    if (!want) { if (m.label) m.label.style.display = 'none'; return; }
    if (!m.label) {
      const el = document.createElement('div'); el.className = 'lb';
      el.innerHTML = `<div class="nm"></div><div class="hb"><i></i></div>`;
      (el.querySelector('.nm') as HTMLElement).textContent = `${m.def.name} · Nv ${m.def.level}`;
      if (m.def.elite) (el.querySelector('.nm') as HTMLElement).style.color = '#ffd23f';
      this.labels.appendChild(el); m.label = el; m.bar = el.querySelector('i') as HTMLElement;
    }
    m.bar!.style.width = Math.max(0, (m.hp / m.max) * 100) + '%';
    m.bar!.style.background = m.def.boss ? '#c0392b' : '#d9453d';
    this.place(m.label, this.P(m.x, m.y, m.h + 0.3));
  }

  private updatePlayer(now: number, dt: number, buff: Required<Buff>) {
    if (this.pending && now >= this.pending.end) { const pd = this.pending; this.pending = null; pd.run(); }
    if (now < this.dashUntil) { this.move(this.p, this.dashV.x, this.dashV.y, dt); this.pv.setMoving(true, 1.4); return; }
    const k = this.keys;
    const ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const iz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    let vx = ix * cy + iz * sy, vy = -ix * sy + iz * cy;
    const speed = this.d.speed * (1 + buff.speed);
    if (ix || iz) { this.chase = false; this.goal = null; this.marker.visible = false; }
    else if (this.chase && this.target && !this.target.dead) {
      if (this.distTo(this.target) > this.d.range * 0.85) { vx = this.target.x - this.p.x; vy = this.target.y - this.p.y; }
    } else if (this.goal) {
      const dx = this.goal.x - this.p.x, dy = this.goal.y - this.p.y;
      if (Math.hypot(dx, dy) > 4) { vx = dx; vy = dy; } else { this.goal = null; this.marker.visible = false; }
    }
    if (this.pending?.root) { vx = 0; vy = 0; } // habilidade de alvo: personagem para na hora e não cancela
    if (vx || vy) {
      if (this.pending) this.cancelCast();
      const l = Math.hypot(vx, vy);
      this.move(this.p, (vx / l) * speed, (vy / l) * speed, dt);
      this.p.face = Math.atan2(vx, vy);
      this.pv.setMoving(true, speed / 70); sfx.step();
    } else this.pv.setMoving(false);

    const t = this.target;
    if (t && t.dead) this.target = null;
    else if (t && now >= this.nextAtk && this.distTo(t) <= this.d.range) {
      if (this.d.style === 'melee') {
        this.nextAtk = now + this.d.interval / (1 + buff.atkSpeed);
        this.basicAttack(t, buff);
      } else if (!vx && !vy && !this.pending) {
        // à distância: precisa ficar parado durante a conjuração; andar cancela o ataque
        this.nextAtk = now + this.d.interval / (1 + buff.atkSpeed);
        this.faceTo(t.x, t.y); this.pv.attack(this.attackClip());
        const W = this.d.style === 'magic' ? 300 : 210;
        this.pending = { start: now, end: now + W, run: () => { if (!t.dead && this.distTo(t) <= this.d.range * 1.1) this.basicAttack(t, this.buffSum(), true); } };
      }
    }
  }

  private cancelCast() {
    this.pending = null; this.nextAtk = this.now; // cancelou: pode atacar de novo na hora
    this.float(this.P(this.p.x, this.p.y, 2.1), 'Cancelado', '#b8b8c8', 7);
  }
  private faceTo(x: number, y: number) { this.p.face = Math.atan2(x - this.p.x, y - this.p.y); }
  private attackClip(): string | undefined {
    const st = this.d.style;
    if (st === 'magic') return 'Spellcast_Shoot';
    if (st === 'ranged') return player.classId === 'ranger' ? '1H_Ranged_Shoot' : 'Spellcast_Shoot';
    return undefined;
  }

  private basicAttack(m: Mob, buff: Required<Buff>, fromWindup = false) {
    const d = this.d;
    const cls = CLASS_BY_ID[player.classId];
    const fx = CLASS_FX[player.classId];
    if (this.isSrv(m)) this.net!.attack(m.idx!);   // online: o servidor rola o ataque e o dano
    let r = d20();
    if (r === 1 && RACE_BY_ID[player.raceId].mods.luck) r = d20();
    if (d.style !== 'melee') {
      // D&D: atirar com inimigo adjacente ou além do alcance normal impõe desvantagem
      const adj = this.mobs.some((x) => !x.dead && x.state === 'chase' && this.distTo(x) < 30);
      if (adj || this.distTo(m) > d.range * 0.75) r = Math.min(r, d20());
    }
    const crit = r >= d.crit || (r !== 1 && Math.random() < d.critPct);
    const hit = r !== 1 && (crit || r + d.atk >= m.def.ac);
    let dmg = roll(d.dice[0], d.dice[1]);
    if (crit) dmg += roll(d.dice[0], d.dice[1]);
    if (d.offDice) dmg += roll(d.offDice[0], d.offDice[1]) + d.offPlus;   // ataque extra da mão esquerda
    dmg = Math.max(1, Math.round((dmg + d.dmgBonus + buff.dmg) * (1 + d.dmgPct)));
    this.faceTo(m.x, m.y);
    if (!fromWindup) this.pv.attack(this.attackClip());
    if (d.style === 'melee') {
      sfx.swing((fx?.slash ?? 'slash') as 'slash');
      this.after(110, () => this.vfx.slash(this.P(this.p.x, this.p.y, 1.0), this.p.face, fx?.slash ?? 'slash', fx?.color ?? cls.atkColor, crit));
      this.after(180, () => { if (m.dead) return; if (hit) this.damage(m, dmg, crit, cls.atkColor); else this.miss(m); });
    } else {
      this.rangedSfx(fx?.proj);
      this.shoot(m, cls.atkColor, () => { if (hit) this.damage(m, dmg, crit, cls.atkColor); else this.miss(m); });
    }
  }

  private rangedSfx(k?: string) {
    if (k === 'arrow') sfx.arrow(); else if (k === 'quarrel' || k === 'dagger') sfx.bolt();
    else sfx.magic((k ?? 'orb') as 'orb');
  }
  private miss(m: Mob) { if (this.isSrv(m)) return; sfx.miss(); this.float(this.P(m.x, m.y, m.h + 0.1), 'Errou', '#b8b8c8', 7); }

  private damage(m: Mob, dmg: number, crit: boolean, color = 0xffffff, noProc = false) {
    if (m.dead || this.isSrv(m)) return;      // monstros do servidor só recebem dano pelo servidor
    m.hp -= dmg;
    sfx.hit(crit);
    this.float(this.P(m.x, m.y, m.h * 0.9), (crit ? '¡' : '') + dmg + (crit ? '!' : ''), crit ? '#ffd23f' : '#ffffff', crit ? 12 : 9);
    this.burst(this.P(m.x, m.y, m.h * 0.55), color);
    if (crit) this.vfx.impact(this.P(m.x, m.y, m.h * 0.6), 0xffd23f, true);
    m.v.flash(); m.v.hit();
    if (!noProc) {
      if (this.d.lifesteal > 0 && player.hp < this.d.maxHp) {
        const h = Math.max(1, Math.round(dmg * this.d.lifesteal));
        player.hp = Math.min(this.d.maxHp, player.hp + h);
        this.float(this.P(this.p.x, this.p.y, 2.0), '+' + h, '#ff8aa0', 7);
        if (Math.random() < 0.5) this.vfx.rise(this.P(this.p.x, this.p.y, 0.3), 0xff4d6d, 3, 0.4, 0.7);
      }
      this.procs(m);
    }
    if (m.state !== 'chase') m.state = 'chase';
    if (!this.target) this.target = m;
    if (m.hp <= 0) this.kill(m);
  }

  /** efeitos de encantamento da arma que disparam ao acertar */
  private procs(m: Mob) {
    const pr = enchProc(player.equipped.mainhand?.ench);
    if (!pr || m.dead || Math.random() >= pr.chance) return;
    const pos = this.P(m.x, m.y, m.h * 0.55);
    const hurt = (t: Mob, n: number, col: number) => this.damage(t, n, false, col, true);
    if (pr.kind === 'fire') {
      this.vfx.spark(pos, 0xff6a1a, 12, 2.6, 0.7, 0.08, 2.2); this.vfx.pillar(this.P(m.x, m.y, 0), 0xff7a1a, 2.2, 0.4, 0.3);
      hurt(m, pr.dmg, 0xff6a1a);
      this.dots.push({ m, left: 4, next: this.now + 700, dmg: Math.max(1, Math.round(pr.dmg * 0.5)), color: 0xff6a1a });
    } else if (pr.kind === 'frost') {
      this.vfx.spark(pos, 0x9be7ff, 12, 2.2, 0.8, 0.07, 1.4); this.vfx.ring(this.P(m.x, m.y, 0), 0x9be7ff, 1.2, 0.4);
      m.slow = this.now + 3500; hurt(m, pr.dmg, 0x9be7ff);
    } else if (pr.kind === 'bolt') {
      let from = m; hurt(m, pr.dmg, 0xffe96a);
      const hit = new Set<Mob>([m]);
      for (let i = 0; i < 2; i++) {
        const nx = this.mobs.filter((t) => !t.dead && !hit.has(t) && Math.hypot(t.x - from.x, t.y - from.y) < 80).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
        if (!nx) break;
        hit.add(nx);
        const a = this.P(from.x, from.y, from.h * 0.6), b = this.P(nx.x, nx.y, nx.h * 0.6);
        for (let k = 0; k < 5; k++) this.vfx.spark(a.clone().lerp(b, k / 4), 0xffe96a, 2, 0.8, 0.3, 0.06);
        hurt(nx, Math.round(pr.dmg * 0.7), 0xffe96a); from = nx;
      }
      this.vfx.impact(pos, 0xffe96a, true);
    } else {
      this.vfx.spark(pos, 0x7aff5a, 10, 1.6, 0.8, 0.06, 1.2);
      this.dots.push({ m, left: 6, next: this.now + 600, dmg: pr.dmg, color: 0x7aff5a });
    }
  }
  private updateDots(now: number) {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const d = this.dots[i];
      if (d.m.dead) { this.dots.splice(i, 1); continue; }
      if (now >= d.next) {
        d.next = now + 700; d.left--;
        this.damage(d.m, d.dmg, false, d.color, true);
        this.vfx.spark(this.P(d.m.x, d.m.y, d.m.h * 0.5), d.color, 3, 0.8, 0.4, 0.05);
        if (d.left <= 0) this.dots.splice(i, 1);
      }
    }
  }

  private kill(m: Mob) {
    m.dead = true; m.vx = m.vy = 0;
    if (m.def.boss) sfx.boss(); else sfx.mobDie();
    m.v.setMoving(false); m.v.die();
    m.deadAt = this.now;
    if (m.boss) this.bossReset(m);
    m.respawn = this.now + (m.def.boss ? (this.loc.dungeon ? Infinity : 120000) : rand(18000, 28000));
    if (m.boss && this.loc.arena?.gate) this.openArena();
    if (this.target === m) { this.target = null; this.chase = false; }
    const xp = killXp(m.def, player.level, player.raceId, this.d.xpPct);
    const gold = Math.round(randGold(m.def.level) * (m.def.boss ? 6 : 1) * (1 + this.d.goldPct));
    this.grantKill(m.def, xp, gold, m);
  }

  /** recompensas de uma morte (XP/ouro vêm do cálculo local ou, online, do servidor); sorteios de item continuam locais */
  private grantKill(def: MobDef, xp: number, gold: number, m: { x: number; y: number; h: number }) {
    const cls = CLASS_BY_ID[player.classId];
    player.gold += gold; player.kills++; sfx.coin();
    this.float(this.P(m.x, m.y, m.h + 0.5), `+${xp} XP`, '#c084fc', 8);
    gainXp(xp);
    bus.emit('log', `${def.name} derrotado: +${xp} XP, +${gold} ouro`, '#d8d0f0');
    if (this.d.manaKill > 0 && player.en < this.d.maxEn) {
      player.en = Math.min(this.d.maxEn, player.en + this.d.manaKill);
      this.float(this.P(this.p.x, this.p.y, 2.0), '+' + this.d.manaKill + ' EN', '#8ab4ff', 8);
      this.vfx.rise(this.P(this.p.x, this.p.y, 0.3), 0x6ab0ff, 6, 0.5, 0.8);
    }
    for (const q of [...QUESTS, ...MAIN_QUESTS]) {
      const st = player.quests[q.id];
      if (st && st.state === 'active' && q.mob === def.id) {
        st.progress++;
        if (st.progress >= q.count) { st.state = 'ready'; bus.emit('log', `Missão cumprida: ${q.title}! Volte ao ${'main' in q ? 'Sábio Orin' : 'Capitão Brann'}.`, '#7ee787'); }
      }
    }
    if (def.fragment && !player.story.fragments.includes(def.fragment)) {
      player.story.fragments.push(def.fragment);
      bus.emit('story', { kind: 'fragment', id: def.fragment });
      bus.emit('log', `Você obteve: ${FRAGMENT_BY_ID[def.fragment].name}!`, '#ffd23f');
    }
    const boss = !!def.boss;
    const drop = rollDrop(boss, !!def.elite);          // equipamento é raro: 1% Comum, e cada raridade acima ainda mais rara
    if (drop !== null) {
      const r = Math.random();
      const off = allowedOff(cls);
      const slot: Slot = r < 0.24 ? 'mainhand' : r < 0.4 ? 'body' : r < 0.52 ? 'head' : r < 0.64 ? 'legs' : r < 0.78 && off.length ? 'offhand' : 'accessory';
      const it = genItem({ slot, level: def.level, style: cls.style, rarity: drop, armorMax: cls.armor, off, cid: cls.id });
      sfx.loot(it.rarity);
      if (addItem(it)) bus.emit('log', `Item encontrado: ${it.name}`, RARITY_COLORS[it.rarity]);
      else { const g = dumpValue(it); player.gold += g; bus.emit('log', `Mochila cheia: ${it.name} vendido por ${g} ouro`, '#f1c40f'); }
    }
    const mats = rollMats(def.level, !!def.elite, boss);       // materiais de forja
    if (Object.keys(mats).length) {
      player.mats ??= {};
      addMats(player.mats, mats);
      bus.emit('log', 'Coletou: ' + MATS.filter((x) => mats[x.id]).map((x) => `${x.icon} ${mats[x.id]} ${x.name}`).join(' · '), '#c9d1d9');
    }
    if (Math.random() < 0.14) { player.potions.heal++; bus.emit('log', 'Você encontrou uma Poção de Cura.', '#ff8a8a'); }
    if (Math.random() < 0.07) { player.potions.energy++; bus.emit('log', 'Você encontrou uma Poção de Energia.', '#8ab4ff'); }
  }

  // ---------- habilidades ----------
  /** habilidade com os bônus da árvore de habilidades aplicados (regra compartilhada com o servidor) */
  private skillAt(i: number): SkillDef | undefined { return sharedSkillAt(player, i); }

  private useSkill(i: number) {
    if (this.dead) return;
    const sk = this.skillAt(i);
    if (!sk) return;
    const now = this.now;
    if (player.level < sk.unlock) { bus.emit('log', `${sk.name} desbloqueia no nível ${sk.unlock}.`, '#a79cc4'); return; }
    if ((this.cds[sk.id] ?? 0) > now) return;
    if (player.en < sk.cost) { bus.emit('log', 'Energia insuficiente.', '#8ab4ff'); (sfx.nope(), bus.emit('nope', i)); return; }
    const run = () => {
      if (player.en < sk.cost) { (sfx.nope(), bus.emit('nope', i)); return; }
      if (this.perform(sk, i)) { player.en -= sk.cost; this.cds[sk.id] = this.now + sk.cd; }
      else (sfx.nope(), bus.emit('nope', i));
    };
    if (this.d.style !== 'melee' && (sk.kind === 'bolt' || sk.kind === 'strike')) {
      this.pv.attack(this.attackClip());
      const W = this.d.style === 'magic' ? 340 : 250;
      this.pending = { start: now, end: now + W, run, root: true };
    } else { if (sk.kind === 'dash') this.pending = null; run(); }
  }

  private calc(mult: number, buff: Required<Buff>) {
    const d = this.d;
    const crit = d20() >= d.crit || Math.random() < d.critPct;
    let dmg = roll(d.dice[0], d.dice[1]);
    if (crit) dmg += roll(d.dice[0], d.dice[1]);
    return { dmg: Math.max(1, Math.round((dmg + d.dmgBonus + buff.dmg) * mult * (1 + d.dmgPct))), crit };
  }

  private perform(sk: SkillDef, si: number): boolean {
    const buff = this.buffSum();
    const color = sk.color ?? 0xffffff;
    const hits = sk.hits ?? 1;
    const fx = CLASS_FX[player.classId];
    const cast = (clip?: string) => this.pv.attack(clip ?? this.attackClip());
    const foot = () => this.P(this.p.x, this.p.y, 0);
    { const sk0 = sk.kind; if (sk0 === 'nova') sfx.nova(); else if (sk0 === 'heal' || sk0 === 'buff') sfx.buff(); else if (sk0 === 'summon') sfx.summon(); else if (sk0 === 'bolt' || sk0 === 'drain') this.rangedSfx(fx?.proj ?? 'orb'); else sfx.skill(); }
    switch (sk.kind) {
      case 'strike': {
        const m = this.pickTarget(sk.range ?? 30);
        if (!m) { bus.emit('log', 'Nenhum alvo ao alcance.', '#a79cc4'); return false; }
        if (this.isSrv(m)) this.net!.skill(si, m.idx);
        this.faceTo(m.x, m.y); cast();
        for (let h = 0; h < hits; h++) {
          this.after(120 + h * 140, () => this.vfx.slash(this.P(this.p.x, this.p.y, 1.0), this.p.face, fx?.slash ?? 'slash', fx?.color ?? 0xffe08a, true));
          this.after(180 + h * 140, () => {
            if (m.dead) return;
            const r = this.calc(sk.mult ?? 1, buff);
            this.damage(m, r.dmg, r.crit, 0xffe08a);
            if (sk.stun) m.stun = this.now + sk.stun;
          });
        }
        return true;
      }
      case 'bolt': case 'drain': {
        const m = this.pickTarget(sk.range ?? 130);
        if (!m) { bus.emit('log', 'Nenhum alvo ao alcance.', '#a79cc4'); return false; }
        if (this.isSrv(m)) this.net!.skill(si, m.idx);
        this.faceTo(m.x, m.y); cast('Spellcast_Shoot');
        for (let h = 0; h < hits; h++) {
          const r = this.calc(sk.mult ?? 1, buff);
          this.shoot(m, color, () => {
            this.damage(m, r.dmg, r.crit, color);
            if (sk.kind === 'drain') {
              const g = Math.max(1, Math.round(r.dmg * 0.5));
              player.hp = Math.min(this.d.maxHp, player.hp + g);
              this.float(this.P(this.p.x, this.p.y, 2.1), '+' + g, '#7ee787', 9);
              const a = this.P(m.x, m.y, m.h * 0.5), b = this.P(this.p.x, this.p.y, 1.0);
              for (let k = 0; k < 8; k++) this.vfx.spark(a.clone().lerp(b, k / 7), color, 1, 0.4, 0.5, 0.07, 0.2);
              this.vfx.rise(foot(), color, 8, 0.6, 0.9);
            }
          }, 200 + h * 140);
        }
        return true;
      }
      case 'summon': {
        const alive = this.minions.filter((x) => x.until > this.now);
        if (alive.length >= 2) this.removeMinion(alive[0]);
        const a = Math.random() * 6.28, x = this.p.x + Math.cos(a) * 24, y = this.p.y + Math.sin(a) * 24;
        this.spawnMinion(x, y, sk.dur ?? 20000, color);
        cast('Spellcast_Shoot');
        this.float(this.P(this.p.x, this.p.y, 2.3), sk.name, '#9bffc0', 8);
        return true;
      }
      case 'nova': {
        if (this.srvOn()) this.net!.skill(si);
        cast('Spellcast_Shoot');
        const rad = (sk.radius ?? 60) / TILE;
        this.ringFx(this.p.x, this.p.y, color, rad);
        this.vfx.ring(foot(), 0xffffff, rad * 0.8, 0.45);
        this.vfx.pillar(foot(), color, 3.5, 0.5, 0.5);
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; this.vfx.spark(foot().add(new THREE.Vector3(Math.cos(a) * rad * 0.6, 0.1, Math.sin(a) * rad * 0.6)), color, 2, 1.8, 0.6, 0.07, 2.4); }
        for (const m of this.mobs) {
          if (m.dead || this.distTo(m) > (sk.radius ?? 60)) continue;
          const r = this.calc(sk.mult ?? 1, buff);
          this.damage(m, r.dmg, r.crit, color);
          this.vfx.impact(this.P(m.x, m.y, m.h * 0.5), color);
          if (sk.slow) m.slow = this.now + 3500;
          if (sk.stun) m.stun = this.now + sk.stun;
        }
        return true;
      }
      case 'cone': {
        const t = this.pickTarget(sk.radius ?? 80) ?? this.nearest(sk.radius ?? 80);
        const ang = t ? Math.atan2(t.y - this.p.y, t.x - this.p.x) : Math.atan2(Math.cos(this.p.face), Math.sin(this.p.face));
        const rad = sk.radius ?? 80;
        if (this.srvOn()) this.net!.skill(si, t?.idx, ang);
        this.p.face = Math.atan2(Math.cos(ang), Math.sin(ang)); cast('Spellcast_Shoot');
        this.sector(this.p.x, this.p.y, ang, rad / TILE, color);
        for (let i = 0; i < 26; i++) {
          const aa = ang + (Math.random() - 0.5) * 1.3, rr = (0.3 + Math.random() * 0.7) * (rad / TILE);
          this.after(i * 12, () => this.vfx.spark(this.P(this.p.x, this.p.y, 0.9).add(new THREE.Vector3(Math.cos(aa) * rr, 0, Math.sin(aa) * rr)), color, 1, 0.7, 0.5, 0.09, 0.6));
        }
        for (const m of this.mobs) {
          if (m.dead || this.distTo(m) > rad) continue;
          const a = Math.atan2(m.y - this.p.y, m.x - this.p.x);
          if (Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) > 0.75) continue;
          const r = this.calc(sk.mult ?? 1, buff);
          this.damage(m, r.dmg, r.crit, color);
        }
        return true;
      }
      case 'heal': {
        const amt = Math.max(4, Math.round((roll(2, 8) + this.d.md[CLASS_BY_ID[player.classId].primary] + player.level) * (sk.mult ?? 1)));
        player.hp = Math.min(this.d.maxHp, player.hp + amt);
        cast('Spellcast_Shoot');
        this.float(this.P(this.p.x, this.p.y, 2.2), '+' + amt, '#7ee787', 10);
        this.ringFx(this.p.x, this.p.y, 0x7ee787, 1.8);
        this.vfx.rise(foot(), 0x7ee787, 18, 0.9, 1.1); this.vfx.pillar(foot(), 0x9bffb0, 4, 0.6, 0.4);
        return true;
      }
      case 'buff': {
        if (this.srvOn()) this.net!.skill(si);
        this.buffs.push({ until: this.now + (sk.dur ?? 8000), buff: sk.buff ?? {} });
        this.ringFx(this.p.x, this.p.y, 0xf1c40f, 1.6);
        this.vfx.rise(foot(), fx?.color ?? 0xffe066, 16, 0.8, 1.0); this.vfx.ring(foot(), 0xffffff, 1.4, 0.5);
        this.float(this.P(this.p.x, this.p.y, 2.2), sk.name, '#ffe066', 8);
        return true;
      }
      case 'dash': {
        if (this.srvOn()) this.net!.skill(si);
        let dx = this.mouseG.x - this.p.x, dy = this.mouseG.y - this.p.y;
        const l = Math.hypot(dx, dy);
        if (l < 6) { dx = Math.sin(this.p.face); dy = Math.cos(this.p.face); } else { dx /= l; dy /= l; }
        this.dashV = { x: dx * 330, y: dy * 330 };
        this.dashUntil = this.now + 150;
        this.p.face = Math.atan2(dx, dy);
        for (let i = 0; i < 6; i++) this.after(i * 25, () => this.vfx.spark(this.P(this.p.x, this.p.y, 0.8), fx?.color ?? 0xffffff, 3, 0.8, 0.45, 0.09, 0.3));
        this.after(160, () => {
          cast();
          this.vfx.slash(this.P(this.p.x, this.p.y, 1.0), this.p.face, fx?.slash ?? 'slash', fx?.color ?? 0xffe08a, true);
          this.vfx.ring(foot(), fx?.color ?? 0xffffff, 1.3, 0.35);
          for (const m of this.mobs) {
            if (m.dead || this.distTo(m) > (sk.range ?? 30) + 8) continue;
            const r = this.calc(sk.mult ?? 1, this.buffSum());
            this.damage(m, r.dmg, r.crit, 0xffe08a);
          }
        });
        return true;
      }
    }
    return false;
  }

  // ---------- aliados invocados (Necromante) ----------
  private spawnMinion(x: number, y: number, dur: number, color: number) {
    const v = mobVisual('skeleton', 1);
    v.root.position.copy(this.P(x, y));
    this.scene.add(v.root);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(ring);
    this.minions.push({ v, x, y, until: this.now + dur, nextAtk: this.now + 800, face: 0, ring });
    this.vfx.pillar(this.P(x, y, 0), color, 3, 0.7, 0.45); this.vfx.rise(this.P(x, y, 0), color, 14, 0.6, 1.0); this.vfx.ring(this.P(x, y, 0), color, 1.4, 0.5);
  }
  private removeMinion(mn: Minion) {
    this.scene.remove(mn.v.root, mn.ring);
    this.vfx.spark(this.P(mn.x, mn.y, 0.8), 0x6aff9a, 10, 1.6, 0.7, 0.07);
    const i = this.minions.indexOf(mn); if (i >= 0) this.minions.splice(i, 1);
  }
  private updateMinions(now: number, dt: number) {
    for (const mn of this.minions.slice()) {
      if (now >= mn.until) { this.removeMinion(mn); continue; }
      // alvo: o mais próximo do esqueleto (ou do jogador, se não houver inimigos por perto)
      let tgt: Mob | null = null, best = 120;
      for (const m of this.mobs) { if (m.dead || m.ghost) continue; const d = Math.hypot(m.x - mn.x, m.y - mn.y); if (d < best && Math.hypot(m.x - this.p.x, m.y - this.p.y) < 190) { best = d; tgt = m; } }
      let gx = this.p.x + 18, gy = this.p.y + 14, speed = 70;
      if (tgt) { gx = tgt.x; gy = tgt.y; speed = 78; }
      const dx = gx - mn.x, dy = gy - mn.y, d = Math.hypot(dx, dy);
      const stop = tgt ? 20 : 26;
      if (d > stop) { const nx = mn.x + (dx / d) * speed * dt, ny = mn.y + (dy / d) * speed * dt; if (!this.blockedPx(nx, ny)) { mn.x = nx; mn.y = ny; } mn.face = Math.atan2(dx, dy); mn.v.setMoving(true, 1); }
      else mn.v.setMoving(false);
      if (!tgt && d > 160) { mn.x = this.p.x; mn.y = this.p.y; }
      if (tgt && d <= 24 && now >= mn.nextAtk) {
        mn.nextAtk = now + 1150; mn.face = Math.atan2(tgt.x - mn.x, tgt.y - mn.y); mn.v.attack();
        if (this.isSrv(tgt)) this.net!.minion(tgt.idx!);
        const dmg = Math.max(1, roll(1, 6) + player.level + Math.round(this.d.dmgBonus * 0.6));
        this.after(220, () => { if (!tgt!.dead) { this.damage(tgt!, dmg, false, 0x6aff9a, true); this.vfx.spark(this.P(tgt!.x, tgt!.y, tgt!.h * 0.5), 0x6aff9a, 5, 1.4, 0.4, 0.06); } });
      }
      const r = mn.v.root; r.position.copy(this.P(mn.x, mn.y)); this.turn(r, mn.face, dt);
      mn.ring.position.copy(this.P(mn.x, mn.y, 0.12)); mn.ring.scale.setScalar(1 + Math.sin(now * 0.008) * 0.08);
      (mn.ring.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, (mn.until - now) / 1500) ;
      mn.v.update(dt, now);
    }
  }

  private usePotion(kind: 'heal' | 'energy') {
    if (this.dead) return;
    const now = this.now;
    if (now < this.potCd) return;
    if (player.potions[kind] <= 0) { bus.emit('log', 'Você não tem essa poção.', '#a79cc4'); return; }
    const pos = this.P(this.p.x, this.p.y, 2.2);
    sfx.potion();
    if (kind === 'heal') {
      if (player.hp >= this.d.maxHp) return;
      const a = 30 + player.level * 8;
      player.hp = Math.min(this.d.maxHp, player.hp + a);
      this.float(pos, '+' + a, '#7ee787', 10); this.ringFx(this.p.x, this.p.y, 0xff7a7a, 1.4);
    } else {
      if (player.en >= this.d.maxEn) return;
      const a = 40 + player.level * 4;
      player.en = Math.min(this.d.maxEn, player.en + a);
      this.float(pos, '+' + a + ' EN', '#8ab4ff', 9); this.ringFx(this.p.x, this.p.y, 0x6a9aff, 1.4);
    }
    player.potions[kind]--;
    this.potCd = now + 6000;
  }

  // ---------- monstros ----------
  private updateMob(m: Mob, now: number, dt: number, buff: Required<Buff>) {
    if (this.isSrv(m)) { this.updateSrvMob(m, now, dt); return; }
    const root = m.v.root;
    const far = Math.hypot(this.p.x - m.x, this.p.y - m.y) > 620;
    if (m.dead) {
      if (m.ghost) {
        if (now - m.deadAt > 1800) { this.scene.remove(root); m.label?.remove(); const i = this.mobs.indexOf(m); if (i >= 0) this.mobs.splice(i, 1); }
        else m.v.update(dt, now);
        return;
      }
      if (root.visible && now - m.deadAt > 1800) root.visible = false;
      else if (root.visible && !far) m.v.update(dt, now);
      if (now >= m.respawn) {
        m.dead = false; m.hp = m.max; m.state = 'idle'; m.stun = 0; m.slow = 0; m.x = m.hx; m.y = m.hy;
        m.v.revive(); root.visible = true;
      }
      return;
    }
    root.visible = !far;
    if (far) { if (m.state === 'idle') return; }
    if (m.stun > now) { m.vx = m.vy = 0; m.v.setMoving(false); m.v.update(dt, now); return; }
    const sp = m.def.speed * (m.slow > now ? 0.5 : 1);
    const inTown = !!ZONES[this.zoneId]?.safe;
    const dp = Math.hypot(m.x - this.p.x, m.y - this.p.y);
    const dh = Math.hypot(m.x - m.hx, m.y - m.hy);
    const rad = 4 * Math.max(1, m.def.scale * 0.6);

    if (m.state === 'idle') {
      if (!this.dead && !inTown && dp < m.def.aggro && (!this.loc.dungeon || this.los(m))) m.state = 'chase';
      else if (now > m.wanderAt) {
        m.wanderAt = now + rand(1500, 4000);
        if (Math.random() < 0.45) { m.vx = m.vy = 0; }
        else { const a = Math.random() * Math.PI * 2; m.vx = Math.cos(a) * sp * 0.4; m.vy = Math.sin(a) * sp * 0.4; }
        if (dh > 40) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); m.vx = Math.cos(a) * sp * 0.4; m.vy = Math.sin(a) * sp * 0.4; }
      }
    }
    if (m.state === 'chase') {
      if (this.dead || inTown || dh > (m.boss ? 640 : 230)) m.state = 'back';
      else if (m.boss && this.bossAI(m, now, dp)) { m.vx = m.vy = 0; }
      else {
        const reach = 12 * Math.max(1, m.def.scale * 0.7);
        m.face = Math.atan2(this.p.x - m.x, this.p.y - m.y);
        if (dp > reach) {
          const a = Math.atan2(this.p.y - m.y, this.p.x - m.x);
          m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp;
        } else {
          m.vx = m.vy = 0;
          if (now >= m.nextAtk) { m.nextAtk = now + m.def.atkInterval; m.v.attack(); this.after(260, () => { if (!m.dead && !this.dead) this.mobAttack(m, this.now, this.buffSum()); }); }
        }
      }
    }
    if (m.state === 'back') {
      if (m.boss) this.bossReset(m);
      if (dh < 8) { m.state = 'idle'; m.hp = m.max; m.vx = m.vy = 0; if (this.target === m) this.target = null; }
      else {
        const a = Math.atan2(m.hy - m.y, m.hx - m.x);
        m.vx = Math.cos(a) * m.def.speed * 1.3; m.vy = Math.sin(a) * m.def.speed * 1.3;
        m.hp = Math.min(m.max, m.hp + m.max * 0.1 * dt);
      }
    }
    const moving = Math.hypot(m.vx, m.vy) > 1;
    if (moving) { const ox = m.x, oy = m.y; this.move(m, m.vx, m.vy, dt, rad);
      if (this.loc === this.over && !m.boss && ZONES[zoneAt(Math.floor(m.x / TILE), Math.floor(m.y / TILE))]?.safe) { m.x = ox; m.y = oy; } // monstros não entram na vila
      if (m.state !== 'chase') m.face = Math.atan2(m.vx, m.vy); }
    m.v.setMoving(moving, Math.hypot(m.vx, m.vy) / 60);
    root.position.copy(this.P(m.x, m.y));
    this.turn(root, m.face, dt);
    if (!far) m.v.update(dt, now);
  }

  private mobAttack(m: Mob, time: number, buff: Required<Buff>) {
    if (this.distTo(m) > 12 * Math.max(1, m.def.scale * 0.7) + 14) return; // saiu do alcance antes do golpe
    const ac = this.d.ac + buff.ac;
    const r = d20();
    const crit = r === 20;
    const hit = r !== 1 && (crit || r + m.def.atk >= ac);
    if (!this.target && !m.dead) this.target = m;
    const head = this.P(this.p.x, this.p.y, 2.0);
    if (!hit) { this.float(head, 'Esquivou', '#b8b8c8', 7); return; }
    let dmg = roll(m.def.dmg[0], m.def.dmg[1]);
    if (crit) dmg += roll(m.def.dmg[0], m.def.dmg[1]);
    dmg += m.def.dmgBonus;
    this.lastHit = time;
    player.hp -= dmg; sfx.hurt();
    this.float(head, '-' + dmg, crit ? '#ff5050' : '#ff8a8a', crit ? 11 : 9);
    this.pv.flash(); this.pv.hit();
    this.shake = 0.08;
    if (player.hp <= 0) this.die(time);
  }

  private die(time: number) {
    sfx.die();
    const race = RACE_BY_ID[player.raceId];
    if (race.mods.relentless && time > this.relentlessAt) {
      player.hp = 1; this.relentlessAt = time + 90000;
      this.float(this.P(this.p.x, this.p.y, 2.4), 'Resistência Implacável!', '#ffd23f', 8);
      return;
    }
    this.dead = true; this.pending = null;
    this.pv.setMoving(false); this.pv.die();
    this.target = null; this.chase = false; this.goal = null; this.marker.visible = false;
    bus.emit('death');
    this.after(3200, () => {
      const lost = Math.floor(player.gold * 0.1);
      player.gold -= lost;
      const d = derive(player);
      player.hp = d.maxHp; player.en = d.maxEn;
      if (this.loc !== this.over) this.setLoc(this.over);
      this.p.x = this.world.start.x; this.p.y = this.world.start.y;
      this.camPos.set(this.p.x / TILE, 0, this.p.y / TILE);
      this.pv.revive();
      for (const m of this.mobs) if (!m.dead && m.state === 'chase') m.state = 'back';
      this.dead = false; this.lastHit = -99999;
      bus.emit('respawn', lost);
    });
  }


  // ---------- arena selada ----------
  private updateArena(now: number) {
    const a = this.loc.arena;
    if (!a) return;
    if (a.gate) { const o = 0.4 + 0.2 * Math.sin(now / 220); a.gate.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = o); return; }
    if (this.dead) return;
    const boss = this.mobs.find((m) => m.boss && !m.ghost);
    if (!boss || boss.dead) return;
    const tx = this.p.x / TILE, ty = this.p.y / TILE, r = a.room;
    if (tx < r.x + 2 || tx > r.x + r.w - 2 || ty < r.y + 2 || ty > r.y + r.h - 2) return;
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 2.6, 1), mat = new THREE.MeshBasicMaterial({ color: 0xa466ff, transparent: true, opacity: 0.5, depthWrite: false });
    for (const t of a.ring) {
      this.loc.solid[t.y * this.loc.w + t.x] = 1;
      const m = new THREE.Mesh(geo, mat.clone()); m.position.set(t.x + 0.5, 1.3, t.y + 0.5); g.add(m);
    }
    this.loc.group.add(g); a.gate = g; this.shake = 0.3;
    bus.emit('banner', boss.def.name);
    bus.emit('log', 'As portas rúnicas se selam atrás de você! Somente a queda do chefe — ou a sua — irá rompê-las.', '#d9a8ff');
  }
  private openArena() {
    const a = this.loc.arena!;
    for (const t of a.ring) this.loc.solid[t.y * this.loc.w + t.x] = 0;
    if (a.gate) this.loc.group.remove(a.gate);
    a.gate = null;
    bus.emit('log', 'O selo rúnico se rompe. O caminho está livre.', '#7ee787');
  }

  // ---------- mecânicas de chefe ----------
  private phaseOf(m: Mob) { const r = m.hp / m.max; return r < 0.33 ? 2 : r < 0.66 ? 1 : 0; }

  private bossAI(m: Mob, now: number, dp: number): boolean {
    const bs = m.boss!, bd = BOSSES[m.def.id];
    const ph = this.phaseOf(m);
    if (ph > bs.phase) {
      bs.phase = ph; bs.next = now + 1400;
      bus.emit('log', bd.lines[ph - 1], '#ff9a6a');
      this.float(this.P(m.x, m.y, m.h + 1), '¡FASE ' + (ph + 1) + '!', '#ff6a3a', 12);
      this.ringFx(m.x, m.y, 0xff5a3a, 6);
    }
    if (bs.cast) return true;
    if (now < bs.next || dp > 460) return false;
    const live = this.mobs.filter((x) => x.owner === m && !x.dead).length;
    const opts = bd.abilities.filter((a) => (a.phase ?? 0) <= bs.phase && (bs.cds[a.id] ?? 0) <= now
      && !(a.kind === 'summon' && live >= 4) && !(a.kind === 'charge' && dp < 80) && !(a.kind === 'cone' && dp > (a.r ?? 90) * 1.5) && a.id !== bs.last);
    if (!opts.length) return false;
    this.startCast(m, opts[Math.floor(Math.random() * opts.length)]);
    return true;
  }

  private startCast(m: Mob, ab: BossAbility) {
    const bs = m.boss!, now = this.now;
    const ang = Math.atan2(this.p.y - m.y, this.p.x - m.x);
    m.face = Math.atan2(this.p.x - m.x, this.p.y - m.y);
    m.vx = m.vy = 0; m.v.setMoving(false);
    const dur = ab.cast * CAST_SCALE;
    const cast: Cast = { ab, start: now, end: now + dur, dur, cancelled: false };
    bs.cast = cast; bs.cds[ab.id] = now + ab.cd; bs.last = ab.id;
    const areas: Area[] = [];
    const r = ab.r ?? 60;
    if (ab.kind === 'circle') areas.push({ k: 'c', x: m.x, y: m.y, r });
    else if (ab.kind === 'meteor' || ab.kind === 'volley') {
      const n = ab.n ?? 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, d = i === 0 ? 0 : 40 + Math.random() * (ab.kind === 'volley' ? 150 : 130);
        let x = this.p.x + Math.cos(a) * d, y = this.p.y + Math.sin(a) * d;
        if (this.hits(x, y, 1)) { x = this.p.x; y = this.p.y; }
        areas.push({ k: 'c', x, y, r });
      }
    }
    else if (ab.kind === 'cone') areas.push({ k: 'cone', x: m.x, y: m.y, r, ang, half: ab.half ?? 0.6 });
    else if (ab.kind === 'line' || ab.kind === 'charge') areas.push({ k: 'rect', x: m.x, y: m.y, r: 0, ang, len: ab.len ?? 240, w: ab.w ?? 36 });
    else if (ab.kind === 'donut') areas.push({ k: 'donut', x: m.x, y: m.y, r, inner: ab.inner ?? 50 });
    else if (ab.kind === 'summon') areas.push({ k: 'c', x: m.x, y: m.y, r: 46 });

    const T = TILE;
    const mats = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = (a: Area): THREE.BufferGeometry => {
      if (a.k === 'c') return new THREE.CircleGeometry(a.r / T, 40).rotateX(-Math.PI / 2);
      if (a.k === 'donut') return new THREE.RingGeometry(a.inner! / T, a.r / T, 56).rotateX(-Math.PI / 2);
      const g = new THREE.BufferGeometry();
      if (a.k === 'rect') {
        const l = a.len! / T, w = a.w! / T / 2;
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -w, l, 0, -w, l, 0, w, 0, 0, -w, l, 0, w, 0, 0, w], 3));
      } else {
        const pts: number[] = [], n = 20, a0 = a.ang! - a.half!, a1 = a.ang! + a.half!, rad = a.r / T;
        for (let i = 0; i < n; i++) {
          const u = a0 + ((a1 - a0) * i) / n, w = a0 + ((a1 - a0) * (i + 1)) / n;
          pts.push(0, 0, 0, Math.cos(u) * rad, 0, Math.sin(u) * rad, Math.cos(w) * rad, 0, Math.sin(w) * rad);
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      }
      return g;
    };
    const parts = areas.map((a) => {
      const g = geo(a);
      const base = new THREE.Mesh(g, mats(0xff2a20, 0.2)), fill = new THREE.Mesh(g, mats(0xff6a2a, 0.5));
      const grp = new THREE.Group();
      grp.add(base, fill);
      if (a.k === 'c' || a.k === 'donut') {
        const edge = new THREE.Mesh(new THREE.RingGeometry(a.r / T - 0.07, a.r / T, 56).rotateX(-Math.PI / 2), mats(0xffd0a0, 0.85));
        grp.add(edge);
      }
      grp.position.copy(this.P(a.x, a.y, 0.22));
      if (a.k === 'rect') grp.rotation.y = -a.ang!;
      this.fxRoot.add(grp);
      return { a, grp, fill };
    });
    const dispose = () => {
      for (const p of parts) {
        this.fxRoot.remove(p.grp);
        p.grp.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) (mm.material as THREE.Material).dispose(); });
        (p.fill.geometry as THREE.BufferGeometry).dispose();
        p.grp.children.forEach((c) => { const mm = c as THREE.Mesh; if (mm.geometry !== p.fill.geometry) mm.geometry.dispose(); });
      }
    };
    let fired = false, fade = 0;
    this.fx.push({ update: (dt) => {
      if (!fired) {
        if (cast.cancelled || m.dead) { dispose(); if (bs.cast === cast) bs.cast = null; return false; }
        const k = Math.min(1, (this.now - cast.start) / cast.dur);
        for (const p of parts) {
          if (p.a.k === 'rect') p.fill.scale.set(k, 1, 1);
          else if (p.a.k === 'donut') p.fill.scale.setScalar(0.35 + 0.65 * k);
          else p.fill.scale.setScalar(Math.max(0.02, k));
          (p.fill.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * k + 0.12 * Math.sin(this.now / 70);
        }
        if (k < 1) return true;
        fired = true; bs.cast = null;
        bs.next = this.now + rand(800, 1500) / (1 + bs.phase * 0.2);
        this.fireCast(m, ab, areas);
        for (const p of parts) (p.fill.material as THREE.MeshBasicMaterial).opacity = 0.95;
        return true;
      }
      fade += dt / 0.28;
      for (const p of parts) p.grp.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) (mm.material as THREE.MeshBasicMaterial).opacity *= 0.85; });
      if (fade >= 1) { dispose(); return false; }
      return true;
    } });
  }

  private inArea(a: Area) {
    const dx = this.p.x - a.x, dy = this.p.y - a.y, d = Math.hypot(dx, dy), pr = 5;
    if (a.k === 'c') return d <= a.r + pr;
    if (a.k === 'donut') return d <= a.r + pr && d >= a.inner! - pr * 0 ;
    if (a.k === 'cone') {
      if (d > a.r + pr) return false;
      let da = Math.atan2(dy, dx) - a.ang!; da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) <= a.half! + (d < 14 ? 3 : 0.08);
    }
    const c = Math.cos(a.ang!), sn = Math.sin(a.ang!);
    const u = dx * c + dy * sn, v = -dx * sn + dy * c;
    return u >= -4 && u <= a.len! + 4 && Math.abs(v) <= a.w! / 2 + pr;
  }

  private fireCast(m: Mob, ab: BossAbility, areas: Area[]) {
    m.v.attack(); this.shake = Math.max(this.shake, 0.12);
    if (ab.kind === 'summon') {
      this.ringFx(m.x, m.y, 0xb070ff, 4);
      const n = ab.n ?? 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + Math.random();
        for (let t = 0; t < 8; t++) {
          const d = 36 + t * 8, x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d;
          if (!this.hits(x, y, 6)) { this.spawnAdd(m, ab.add!, x, y); break; }
        }
      }
      return;
    }
    for (const a of areas) {
      if (a.k === 'c') this.burst(this.P(a.x, a.y, 0.4), 0xff7a3a);
    }
    if (areas.some((a) => this.inArea(a))) this.bossHurt(m, ab);
    if (ab.kind === 'charge') {
      const a = areas[0]; let t = 0;
      const sp = a.len! / 0.22, rad = 4 * Math.max(1, m.def.scale * 0.6);
      m.face = Math.atan2(Math.cos(a.ang!), Math.sin(a.ang!));
      this.fx.push({ update: (dt) => { t += dt; if (m.dead) return false; this.move(m, Math.cos(a.ang!) * sp, Math.sin(a.ang!) * sp, dt, rad); return t < 0.22; } });
    }
  }

  private bossHurt(m: Mob, ab: BossAbility) {
    if (this.dead) return;
    const head = this.P(this.p.x, this.p.y, 2.0);
    if (this.now < this.dashUntil) { this.float(head, 'Esquivou!', '#8ab4ff', 9); return; }
    const dmg = roll(ab.dmg[0], ab.dmg[1]) + ab.dmg[2];
    this.lastHit = this.now;
    player.hp -= dmg; sfx.hurt();
    this.float(head, '-' + dmg, '#ff5050', 12);
    bus.emit('log', `${ab.name} atinge você: -${dmg}`, '#ff8a8a');
    this.pv.flash(); this.pv.hit(); this.shake = 0.22;
    if (player.hp <= 0) this.die(this.now);
  }

  private spawnAdd(owner: Mob, id: string, x: number, y: number) {
    const md = MOBS.find((q) => q.id === id)!;
    const v = mobVisual(md.id, md.scale);
    v.root.position.set(x / TILE, this.terrain.groundY(x, y), y / TILE);
    const g: Mob = {
      def: md, v, h: mobHeight(md.id, md.scale), x, y, hx: x, hy: y, face: 0, hp: md.hp, max: md.hp,
      state: 'chase', nextAtk: this.now + 900, slow: 0, stun: 0, dead: false, deadAt: 0, respawn: Infinity, wanderAt: 0, vx: 0, vy: 0,
      ghost: true, owner,
    };
    this.scene.add(v.root); this.mobs.push(g);
    this.burst(this.P(x, y, 0.8), 0xb070ff);
  }

  private bossReset(m: Mob) {
    const bs = m.boss!;
    if (bs.cast) { bs.cast.cancelled = true; bs.cast = null; }
    if (bs.phase || bs.last) { bs.phase = 0; bs.cds = {}; bs.last = ''; bs.next = 0; }
    for (const g of this.mobs) if (g.owner === m && !g.dead) { g.dead = true; g.deadAt = this.now - 1800; g.v.root.visible = false; }
  }

  private hudBoss(time: number) {
    let b: Mob | null = null;
    for (const m of this.mobs) if (m.boss && !m.dead && m.state === 'chase') { b = m; break; }
    if (!b) return null;
    const c = b.boss!.cast;
    return { name: b.def.name, hp: b.hp, max: b.max, phase: b.boss!.phase + 1, cast: c ? { name: c.ab.name, p: Math.min(1, (time - c.start) / c.dur) } : null };
  }

  // ---------- HUD ----------
  private emitHud(time: number) {
    const sk = (i: number) => {
      const s = this.skillAt(i);
      if (!s) return null;
      const left = Math.max(0, (this.cds[s.id] ?? 0) - time);
      return { id: s.id, name: s.name, icon: s.icon, desc: s.desc, cost: s.cost, unlock: s.unlock, cd: left / s.cd, left: left / 1000 };
    };
    const t = this.target && !this.target.dead ? this.target : null;
    const n = this.nearNpc();
    const pt = n ? null : this.nearPortal();
    const nf = n || pt ? null : this.nearFountain();
    bus.emit('hud', {
      hp: player.hp, maxHp: this.d.maxHp, en: player.en, maxEn: this.d.maxEn,
      xp: player.xp, xpCur: xpForCurrent(player.level), xpNext: xpForNext(player.level),
      skills: [sk(0), sk(1), sk(2), sk(3), sk(4), sk(5), sk(6), sk(7), sk(8)],
      pot: Math.max(0, this.potCd - time) / 6000,
      buffs: this.buffs.length,
      boss: this.hudBoss(time),
      pcast: this.pending ? Math.min(1, (time - this.pending.start) / (this.pending.end - this.pending.start)) : null,
      target: t ? { name: t.def.name, level: t.def.level, hp: t.hp, max: t.max, boss: !!t.def.boss } : null,
      npc: n ? `[E] Falar com ${n.name}` : pt ? (pt.kind === 'out' ? (this.loc.interior ? '[E] Sair' : '[E] Sair da masmorra') : pt.kind === 'door' ? `[E] Entrar: ${BUILDINGS.find((b) => b.id === pt.building)!.name}` : `[E] Entrar: ${DUNGEON_BY_ID[pt.dungeon].name}`) : nf ? `[E] Tocar na fonte de ${nf.name}` : null,
    });
  }
}
void hex;
