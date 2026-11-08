// Simulação autoritativa dos monstros do mundo aberto: IA, vida, morte, respawn, dano e XP.
// Usa o MESMO código de dados/regras do cliente (src/), então os números batem nos dois lados.
import { BLOCKED, TILE, W, H, ZONES, generateWorld, zoneAt } from '../../src/chapters/chapter1';
import { MOBS, MobDef, eliteOf } from '../../src/data/monsters';
import { Buff, SkillDef, rand, roll, d20 } from '../../src/data/rules';
import { enchProc } from '../../src/data/enchants';
import { randGold } from '../../src/data/items';
import { Derived, PlayerState } from '../../src/game/state';
import { basicHit, calcDamage, eliteAt, killXp, skillAt, sumBuffs, worldSig } from '../../src/game/combat';
import type { HitMsg } from './protocol.js';

export interface SimPlayer {
  id: string; x: number; y: number; loc: string; dead: boolean;
  sheet: PlayerState | null; d: Derived | null;
  buffs: { until: number; buff: Buff }[]; cds: Record<string, number>;
  lastAtk: number; lastMn: number;
  party?: string;
  send(type: string, msg: unknown): void;
}

const IDLE = 0, CHASE = 1, BACK = 2;
const PARTY_RANGE = 900;   // membros do grupo dentro desse raio dividem a morte do monstro
const SLACK = 45;          // tolerância (px) à latência na validação de alcance
const SEE = 640;           // raio de interesse: monstros mais longe que isso não são enviados
const WAKE = 760;          // monstros só são simulados perto de algum jogador

interface Dot { left: number; next: number; dmg: number; by: string; col: number }
interface SMob {
  i: number; def: MobDef; elite: boolean;
  x: number; y: number; hx: number; hy: number; face: number; hp: number; max: number;
  state: number; tgt: string; nextAtk: number; windup: number; slow: number; stun: number;
  dead: boolean; respawnAt: number; wanderAt: number; vx: number; vy: number; rad: number;
  dots: Dot[]; contrib: Map<string, number>;
}

export class WorldSim {
  readonly mobs: SMob[] = [];
  readonly sig: string;
  private solid: Uint8Array;
  private byId = new Map<string, SimPlayer>();

  constructor() {
    const world = generateWorld();
    const blocked = new Set<number>(BLOCKED);
    this.solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.solid[y * W + x] = blocked.has(world.tiles[y][x]) ? 1 : 0;
    world.spawns.forEach((sp, i) => {
      const base = MOBS.find((m) => m.id === sp.mob)!;
      if (sp.boss || base.boss) return;                  // chefes continuam locais nesta fase
      const elite = eliteAt(i);
      const def = elite ? eliteOf(base) : base;
      this.mobs[i] = {
        i, def, elite, x: sp.x, y: sp.y, hx: sp.x, hy: sp.y, face: Math.random() * 6.28, hp: def.hp, max: def.hp,
        state: IDLE, tgt: '', nextAtk: 0, windup: 0, slow: 0, stun: 0, dead: false, respawnAt: 0, wanderAt: rand(0, 3000), vx: 0, vy: 0,
        rad: 4 * Math.max(1, def.scale * 0.6), dots: [], contrib: new Map(),
      };
    });
    this.sig = worldSig(world.spawns);
  }

  /** número de pontos de spawn do mundo (inclui o chefe, que o servidor não simula) */
  get spawnCount() { return this.mobs.length; }

  // ---------- utilidades ----------
  private blockedPx(x: number, y: number) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return this.solid[ty * W + tx] === 1;
  }
  private hits(x: number, y: number, r: number) { return this.blockedPx(x - r, y - r) || this.blockedPx(x + r, y - r) || this.blockedPx(x - r, y + r) || this.blockedPx(x + r, y + r); }
  private safeAt(x: number, y: number) { return !!ZONES[zoneAt(Math.floor(x / TILE), Math.floor(y / TILE))]?.safe; }
  private targetable(p: SimPlayer) { return p.loc === 'world' && !p.dead && !!p.d && !this.safeAt(p.x, p.y); }
  private reach(m: SMob) { return 12 * Math.max(1, m.def.scale * 0.7); }
  private world(players: Iterable<SimPlayer>) { const l: SimPlayer[] = []; for (const p of players) if (p.loc === 'world') l.push(p); return l; }

  private near(m: { x: number; y: number }, list: SimPlayer[], r: number) { return list.filter((p) => Math.hypot(p.x - m.x, p.y - m.y) <= r); }
  private tell(list: SimPlayer[], m: SMob, type: string, msg: unknown) { for (const p of list) if (Math.hypot(p.x - m.x, p.y - m.y) <= SEE + 120) p.send(type, msg); }

  // ---------- laço da simulação ----------
  step(dt: number, now: number, players: Iterable<SimPlayer>) {
    const all = [...players];
    this.byId.clear();
    for (const p of all) this.byId.set(p.id, p);
    const wp = this.world(all);
    for (const m of this.mobs) {
      if (!m) continue;
      if (m.dead) {
        if (now >= m.respawnAt) { m.dead = false; m.hp = m.max; m.state = IDLE; m.tgt = ''; m.x = m.hx; m.y = m.hy; m.slow = m.stun = 0; m.dots.length = 0; m.contrib.clear(); }
        continue;
      }
      const anyNear = wp.some((p) => Math.abs(p.x - m.x) < WAKE && Math.abs(p.y - m.y) < WAKE);
      if (!anyNear) {
        // sem ninguém por perto: volta para casa e se cura (nada fica "preso" em combate)
        if (m.state !== IDLE || m.hp < m.max || m.x !== m.hx || m.y !== m.hy) { m.state = IDLE; m.hp = m.max; m.x = m.hx; m.y = m.hy; m.tgt = ''; m.dots.length = 0; m.contrib.clear(); m.vx = m.vy = 0; }
        continue;
      }
      this.tickDots(m, now, wp);
      if (m.dead) continue;
      this.think(m, dt, now, wp);
    }
  }

  private think(m: SMob, dt: number, now: number, wp: SimPlayer[]) {
    if (m.stun > now) { m.vx = m.vy = 0; return; }
    const sp = m.def.speed * (m.slow > now ? 0.5 : 1);
    const dh = Math.hypot(m.x - m.hx, m.y - m.hy);
    let tgt = m.tgt ? this.byId.get(m.tgt) : undefined;

    if (m.state === IDLE) {
      let best: SimPlayer | undefined, bd = m.def.aggro;
      for (const p of wp) { if (!this.targetable(p)) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < bd) { bd = d; best = p; } }
      if (best) { m.state = CHASE; m.tgt = best.id; tgt = best; }
      else if (now > m.wanderAt) {
        m.wanderAt = now + rand(1500, 4000);
        if (Math.random() < 0.45) { m.vx = m.vy = 0; }
        else { const a = Math.random() * Math.PI * 2; m.vx = Math.cos(a) * sp * 0.4; m.vy = Math.sin(a) * sp * 0.4; }
        if (dh > 40) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); m.vx = Math.cos(a) * sp * 0.4; m.vy = Math.sin(a) * sp * 0.4; }
      }
    }
    if (m.state === CHASE) {
      if (!tgt || !this.targetable(tgt) || dh > 230) { m.state = BACK; m.tgt = ''; }
      else {
        const dp = Math.hypot(tgt.x - m.x, tgt.y - m.y);
        m.face = Math.atan2(tgt.x - m.x, tgt.y - m.y);
        if (dp > this.reach(m)) { const a = Math.atan2(tgt.y - m.y, tgt.x - m.x); m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp; }
        else {
          m.vx = m.vy = 0;
          if (now >= m.nextAtk) { m.nextAtk = now + m.def.atkInterval; m.windup = now + 260; this.tell(wp, m, 'matk', { m: m.i }); }
        }
      }
    }
    if (m.windup && now >= m.windup) {
      m.windup = 0;
      const t = m.tgt ? this.byId.get(m.tgt) : undefined;
      if (t && this.targetable(t) && Math.hypot(t.x - m.x, t.y - m.y) <= this.reach(m) + 14) this.mobHits(m, t, now);
    }
    if (m.state === BACK) {
      if (dh < 8) { m.state = IDLE; m.hp = m.max; m.vx = m.vy = 0; m.contrib.clear(); }
      else {
        const a = Math.atan2(m.hy - m.y, m.hx - m.x);
        m.vx = Math.cos(a) * m.def.speed * 1.3; m.vy = Math.sin(a) * m.def.speed * 1.3;
        m.hp = Math.min(m.max, m.hp + m.max * 0.1 * dt);
      }
    }
    if (Math.hypot(m.vx, m.vy) > 1) {
      const ox = m.x, oy = m.y;
      const nx = m.x + m.vx * dt; if (!this.hits(nx, m.y, m.rad)) m.x = nx;
      const ny = m.y + m.vy * dt; if (!this.hits(m.x, ny, m.rad)) m.y = ny;
      if (this.safeAt(m.x, m.y)) { m.x = ox; m.y = oy; }   // monstros não entram nas vilas
      if (m.state !== CHASE) m.face = Math.atan2(m.vx, m.vy);
    }
  }

  /** golpe do monstro no jogador: d20 + ataque contra a CA declarada (+ bônus de buffs) */
  private mobHits(m: SMob, p: SimPlayer, now: number) {
    const ac = (p.d?.ac ?? 10) + sumBuffs(p.buffs, now).ac;
    const r = d20(), crit = r === 20;
    const hit = r !== 1 && (crit || r + m.def.atk >= ac);
    if (!hit) { p.send('hurt', { m: m.i, d: 0, c: 0 }); return; }
    let dmg = roll(m.def.dmg[0], m.def.dmg[1]);
    if (crit) dmg += roll(m.def.dmg[0], m.def.dmg[1]);
    dmg += m.def.dmgBonus;
    p.send('hurt', { m: m.i, d: dmg, c: crit ? 1 : 0 });
  }

  private tickDots(m: SMob, now: number, wp: SimPlayer[]) {
    for (let k = m.dots.length - 1; k >= 0; k--) {
      const d = m.dots[k];
      if (now < d.next) continue;
      d.next = now + 700; d.left--;
      if (d.left <= 0) m.dots.splice(k, 1);
      this.dealt(m, d.dmg, d.by, 'p', false, wp, d.col);
      if (m.dead) return;
    }
  }

  // ---------- dano recebido pelos monstros ----------
  private dealt(m: SMob, dmg: number, by: string, kind: HitMsg['k'], crit: boolean, wp: SimPlayer[], col?: number) {
    if (m.dead) return;
    m.hp -= dmg;
    m.contrib.set(by, (m.contrib.get(by) ?? 0) + dmg);
    const msg: HitMsg = { m: m.i, d: dmg, c: crit ? 1 : 0, k: kind, by, col };
    this.tell(wp, m, 'hit', msg);
    const src = this.byId.get(by);
    if (m.state !== CHASE && src && this.targetable(src)) { m.state = CHASE; m.tgt = by; }
    if (m.hp <= 0) this.kill(m, wp);
  }

  private kill(m: SMob, wp: SimPlayer[]) {
    m.dead = true; m.vx = m.vy = 0; m.windup = 0; m.state = IDLE; m.tgt = '';
    m.respawnAt = Date.now() + rand(18000, 28000);
    m.dots.length = 0;
    // quem deu dano + membros do grupo deles que estão por perto
    const got = new Set<string>(m.contrib.keys());
    for (const id of [...got]) {
      const a = this.byId.get(id);
      if (!a?.party) continue;
      for (const q of wp) if (q.party === a.party && q.loc === 'world' && !q.dead && Math.hypot(q.x - m.x, q.y - m.y) <= PARTY_RANGE) got.add(q.id);
    }
    for (const id of got) {
      const p = this.byId.get(id);
      if (!p || !p.sheet || !p.d || p.loc !== 'world' || !wp.includes(p)) continue;
      const xp = killXp(m.def, p.sheet.level, p.sheet.raceId, p.d.xpPct);
      const gold = Math.round(randGold(m.def.level) * (1 + p.d.goldPct));
      p.send('kill', { m: m.i, def: m.def.id, xp, gold, elite: m.elite ? 1 : 0 });
    }
    m.contrib.clear();
    // o XP vai só para quem participou (quem deu dano); todos veem a morte no próximo 'mobs' (≤100 ms)
  }

  private index(players: Iterable<SimPlayer>) { this.byId.clear(); for (const p of players) this.byId.set(p.id, p); }

  // ---------- ataques dos jogadores ----------
  private mobAt(i: unknown): SMob | null {
    const m = typeof i === 'number' ? this.mobs[i | 0] : undefined;
    return m && !m.dead ? m : null;
  }
  private ready(p: SimPlayer) { return p.loc === 'world' && !p.dead && !!p.d && !!p.sheet; }

  private nearestMob(p: SimPlayer, range: number) {
    let best: SMob | null = null, bd = range;
    for (const m of this.mobs) { if (!m || m.dead) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d <= bd) { bd = d; best = m; } }
    return best;
  }

  /** efeitos de encantamento da arma que disparam ao acertar */
  private procs(p: SimPlayer, m: SMob, wp: SimPlayer[], now: number) {
    const pr = enchProc(p.sheet?.equipped.mainhand?.ench);
    if (!pr || m.dead || Math.random() >= pr.chance) return;
    const COL = { fire: 0xff6a1a, frost: 0x9be7ff, bolt: 0xffe96a, poison: 0x7aff5a } as const;
    if (pr.kind === 'fire') {
      this.dealt(m, pr.dmg, p.id, 'p', false, wp, COL.fire);
      if (!m.dead) m.dots.push({ left: 4, next: now + 700, dmg: Math.max(1, Math.round(pr.dmg * 0.5)), by: p.id, col: COL.fire });
    } else if (pr.kind === 'frost') {
      m.slow = now + 3500; this.dealt(m, pr.dmg, p.id, 'p', false, wp, COL.frost);
    } else if (pr.kind === 'bolt') {
      let from = m; this.dealt(m, pr.dmg, p.id, 'p', false, wp, COL.bolt);
      const seen = new Set<SMob>([m]);
      for (let k = 0; k < 2; k++) {
        let nx: SMob | null = null, bd = 80;
        for (const t of this.mobs) { if (!t || t.dead || seen.has(t)) continue; const d = Math.hypot(t.x - from.x, t.y - from.y); if (d < bd) { bd = d; nx = t; } }
        if (!nx) break;
        seen.add(nx); this.dealt(nx, Math.round(pr.dmg * 0.7), p.id, 'p', false, wp, COL.bolt); from = nx;
      }
    } else if (!m.dead) m.dots.push({ left: 6, next: now + 600, dmg: pr.dmg, by: p.id, col: COL.poison });
  }

  /** acerto "pleno" de uma habilidade ou ataque: dano + procs de encanto */
  private strike(p: SimPlayer, m: SMob, dmg: number, crit: boolean, wp: SimPlayer[], now: number, kind: HitMsg['k'] = 'h') {
    if (m.dead) return;
    this.dealt(m, dmg, p.id, kind, crit, wp);
    if (!m.dead) this.procs(p, m, wp, now);
  }

  attack(p: SimPlayer, idx: unknown, players: Iterable<SimPlayer>) {
    const list = [...players]; this.index(list);
    if (!this.ready(p)) return;
    const now = Date.now(), d = p.d!;
    const m = this.mobAt(idx);
    if (!m) return;
    const buff = sumBuffs(p.buffs, now);
    if (now - p.lastAtk < (d.interval / (1 + buff.atkSpeed)) * 0.7) return;   // limite de cadência
    if (Math.hypot(m.x - p.x, m.y - p.y) > d.range * 1.1 + SLACK) return;       // fora de alcance
    p.lastAtk = now;
    const wp = this.world(list);
    let disadv = false;
    if (d.style !== 'melee') {
      const adj = this.mobs.some((x) => x && !x.dead && x.state === CHASE && Math.hypot(x.x - p.x, x.y - p.y) < 30);
      disadv = adj || Math.hypot(m.x - p.x, m.y - p.y) > d.range * 0.75;
    }
    const r = basicHit(d, p.sheet!, m.def.ac, buff.dmg, disadv);
    const delay = d.style === 'melee' ? 180 : 140 + Math.min(300, Math.hypot(m.x - p.x, m.y - p.y) * 1.2);
    setTimeout(() => {
      if (m.dead) return;
      if (r.hit) this.strike(p, m, r.dmg, r.crit, wp, Date.now());
      else this.tell(wp, m, 'hit', { m: m.i, d: 0, c: 0, k: 'm', by: p.id } satisfies HitMsg);
      if (!m.dead && m.state !== CHASE && this.targetable(p)) { m.state = CHASE; m.tgt = p.id; }
    }, delay);
  }

  skill(p: SimPlayer, i: unknown, idx: unknown, ang: unknown, players: Iterable<SimPlayer>) {
    const list = [...players]; this.index(list);
    if (!this.ready(p)) return;
    const slot = typeof i === 'number' ? i | 0 : -1;
    const sk: SkillDef | undefined = slot >= 0 && slot < 9 ? skillAt(p.sheet!, slot) : undefined;
    if (!sk) return;
    const now = Date.now(), d = p.d!;
    if (p.sheet!.level < sk.unlock) return;
    if ((p.cds[sk.id] ?? 0) - 250 > now) return;                // ainda em recarga (com folga de latência)
    p.cds[sk.id] = now + sk.cd;
    const wp = this.world(list);
    const buff = sumBuffs(p.buffs, now);
    const hits = sk.hits ?? 1;
    const hit = (m: SMob, h = 0, kind: HitMsg['k'] = 'h') => {
      const r = calcDamage(d, sk.mult ?? 1, buff.dmg);
      setTimeout(() => {
        if (m.dead) return;
        this.strike(p, m, r.dmg, r.crit, wp, Date.now(), kind);
        if (!m.dead && sk.stun) m.stun = Date.now() + sk.stun;
        if (!m.dead && sk.slow) m.slow = Date.now() + 3500;
      }, 180 + h * 140);
    };
    switch (sk.kind) {
      case 'strike': case 'bolt': case 'drain': {
        const range = (sk.range ?? (sk.kind === 'strike' ? 30 : 130)) + SLACK;
        let m = this.mobAt(idx);
        if (m && Math.hypot(m.x - p.x, m.y - p.y) > range) m = null;
        m ??= this.nearestMob(p, range);
        if (!m) { p.cds[sk.id] = 0; return; }
        for (let h = 0; h < hits; h++) hit(m, h, sk.kind === 'drain' ? 'd' : 'h');
        break;
      }
      case 'nova': {
        const rad = (sk.radius ?? 60) + SLACK * 0.5;
        for (const m of this.mobs) if (m && !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= rad) hit(m);
        break;
      }
      case 'cone': {
        const rad = (sk.radius ?? 80) + SLACK * 0.5;
        const t = this.mobAt(idx);
        const a0 = typeof ang === 'number' && Number.isFinite(ang) ? ang : t ? Math.atan2(t.y - p.y, t.x - p.x) : 0;
        for (const m of this.mobs) {
          if (!m || m.dead || Math.hypot(m.x - p.x, m.y - p.y) > rad) continue;
          const a = Math.atan2(m.y - p.y, m.x - p.x);
          if (Math.abs(Math.atan2(Math.sin(a - a0), Math.cos(a - a0))) > 0.8) continue;
          hit(m);
        }
        break;
      }
      case 'dash': {
        setTimeout(() => {
          const r = (sk.range ?? 30) + 8 + SLACK;
          for (const m of this.mobs) if (m && !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= r) hit(m);
        }, 170);
        break;
      }
      case 'buff': p.buffs = p.buffs.filter((b) => b.until > now).slice(-12); p.buffs.push({ until: now + (sk.dur ?? 8000), buff: sk.buff ?? {} }); break;
      default: break;     // cura e invocação não afetam monstros (o golpe dos aliados chega por 'mn')
    }
  }

  /** golpe de um aliado invocado (Necromante): no máximo 2 aliados, 1 golpe a cada ~1,15 s cada */
  minion(p: SimPlayer, idx: unknown, players: Iterable<SimPlayer>) {
    const list = [...players]; this.index(list);
    if (!this.ready(p) || p.sheet?.classId !== 'necromancer') return;
    const now = Date.now();
    if (now - p.lastMn < 450) return;
    const m = this.mobAt(idx);
    if (!m || Math.hypot(m.x - p.x, m.y - p.y) > 260) return;
    p.lastMn = now;
    const dmg = Math.max(1, roll(1, 6) + p.sheet!.level + Math.round(p.d!.dmgBonus * 0.6));
    const wp = this.world(list);
    setTimeout(() => { if (!m.dead) this.dealt(m, dmg, p.id, 'p', false, wp, 0x6aff9a); }, 220);
  }

  // ---------- snapshot por jogador ----------
  snapshot(p: SimPlayer): number[] {
    const out: number[] = [];
    for (const m of this.mobs) {
      if (!m) continue;
      if (Math.abs(m.x - p.x) > SEE || Math.abs(m.y - p.y) > SEE) continue;
      const moving = !m.dead && Math.hypot(m.vx, m.vy) > 1 ? 4 : 0;
      out.push(m.i, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.max(0, Math.round(m.hp)), (m.dead ? 1 : 0) | (m.state === CHASE ? 2 : 0) | moving, Math.round(m.face * 100) / 100);
    }
    return out;
  }
}
