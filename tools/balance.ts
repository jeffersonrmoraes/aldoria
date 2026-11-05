// Simulação de balanceamento: npx esbuild tools/balance.ts --bundle --platform=node --outfile=/tmp/balance.cjs && node /tmp/balance.cjs
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
(globalThis as any).window = globalThis;
import { CLASSES, CLASS_BY_ID } from '../src/data/classes';
import { MOBS } from '../src/data/monsters';
import { genItem, Slot, allowedOff } from '../src/data/items';
import { derive, newPlayer } from '../src/game/state';
import { roll, d20 } from '../src/data/rules';

const TARGET = (L: number) => MOBS.filter((m) => !m.boss && m.level <= L).sort((a, b) => b.level - a.level)[0];
function gear(cid: string, L: number, rar: 1 | 2 | 3) {
  const p = newPlayer('S', 'human', cid, '');
  p.level = L;
  const cls = CLASS_BY_ID[cid];
  const off = allowedOff(cls);
  for (const slot of ['mainhand', 'body', 'head', 'legs', 'offhand', 'accessory'] as Slot[]) {
    if (slot === 'offhand' && p.equipped.mainhand?.twoHanded) continue;
    try { const it = genItem({ slot, level: L, style: cls.style, rarity: rar, armorMax: cls.armor, off, cid, noEnchant: true }); p.equipped[slot] = it; } catch { /* sem item */ }
  }
  return p;
}
function fight(cid: string, L: number, rar: 1 | 2 | 3) {
  const p = gear(cid, L, rar); const cls = CLASS_BY_ID[cid]; const m0 = TARGET(L);
  const d = derive(p);
  let hp = d.maxHp, en = d.maxEn, mhp = m0.hp, t = 0, nextAtk = 0, nextMob = 0.6;
  const cds: number[] = [0, 0, 0];
  const skills = cls.skills.filter((s) => s.unlock <= L);
  let buffUntil = 0, buffDmg = 0, taken = 0;
  const dt = 0.05;
  while (mhp > 0 && hp > 0 && t < 120) {
    t += dt; en = Math.min(d.maxEn, en + d.regenEn * dt);
    const strike = (mult: number) => {
      const crit = d20() >= d.crit; let dm = roll(d.dice[0], d.dice[1]); if (crit) dm += roll(d.dice[0], d.dice[1]);
      return Math.max(1, Math.round((dm + d.dmgBonus + (t < buffUntil ? buffDmg : 0)) * mult * (1 + d.dmgPct)));
    };
    // habilidades (prioriza a de maior multiplicador disponível)
    for (let i = skills.length - 1; i >= 0; i--) {
      const s = skills[i];
      if (t < cds[i] || en < s.cost) continue;
      if (s.kind === 'buff') { if (t > buffUntil) { buffUntil = t + (s.dur ?? 10000) / 1000; buffDmg = s.buff?.dmg ?? 0; en -= s.cost; cds[i] = t + s.cd / 1000; } continue; }
      if (s.kind === 'heal') { if (hp < d.maxHp * 0.5) { hp = Math.min(d.maxHp, hp + (30 + L * 8)); en -= s.cost; cds[i] = t + s.cd / 1000; } continue; }
      if (s.kind === 'summon') { if (t > buffUntil) { buffUntil = t + 20; buffDmg = 3; en -= s.cost; cds[i] = t + s.cd / 1000; } continue; }
      const hits = s.hits ?? 1; for (let h = 0; h < hits; h++) mhp -= strike(s.mult ?? 1);
      if (s.kind === 'drain') hp = Math.min(d.maxHp, hp + 3);
      en -= s.cost; cds[i] = t + s.cd / 1000; nextAtk = Math.max(nextAtk, t + 0.5);
    }
    if (t >= nextAtk) {
      nextAtk = t + d.interval / 1000;
      let r = d20(); const hit = r !== 1 && (r >= d.crit || r + d.atk >= m0.ac);
      if (hit) mhp -= strike(1) + (d.offDice ? roll(d.offDice[0], d.offDice[1]) + d.offPlus : 0);
    }
    if (t >= nextMob) {
      nextMob = t + m0.atkInterval / 1000;
      const r = d20(); if (r !== 1 && (r === 20 || r + m0.atk >= d.ac)) { const dm = roll(m0.dmg[0], m0.dmg[1]) + m0.dmgBonus; hp -= dm; taken += dm; }
    }
  }
  return { ttk: t, lost: taken / d.maxHp, dead: hp <= 0, ac: d.ac, hp: d.maxHp, mob: m0.id };
}
const N = Number(process.env.N ?? 200);
const rarOf = (L: number): 1 | 2 | 3 => (L <= 2 ? 1 : L <= 6 ? 2 : 3);
const levels = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const res: Record<string, { ttk: number; lost: number }> = {};
for (const c of CLASSES) {
  let tt = 0, lost = 0, n = 0;
  for (const L of levels) for (let i = 0; i < N; i++) { const r = fight(c.id, L, rarOf(L)); tt += r.ttk / TARGET(L).hp * 100; lost += r.lost; n++; }
  res[c.id] = { ttk: tt / n, lost: lost / n };
}
const med = Object.values(res).map((r) => r.ttk).sort((a, b) => a - b)[Math.floor(CLASSES.length / 2)];
console.log('classe'.padEnd(13) + 'ttk(s/100hp)  perda%   fator-sugerido');
for (const c of CLASSES) { const r = res[c.id]; console.log(c.id.padEnd(13) + r.ttk.toFixed(2).padStart(10) + (r.lost * 100).toFixed(1).padStart(9) + (Math.min(1.35, Math.max(0.75, Math.pow(r.ttk / med, 0.8))).toFixed(2)).padStart(12)); }
