// Jogadores remotos: modelo 3D, nome e balão de fala, com interpolação suave.
import * as THREE from 'three';
import { SkinnedActor, playerActor } from '../art/actors';
import type { Look } from '../data/looks';
import { RemoteInfo } from './online';
import { SnapMsg } from './protocol';

interface Remote { info: RemoteInfo; v: SkinnedActor; label: HTMLDivElement; bubble: HTMLDivElement; x: number; y: number; tx: number; ty: number; face: number; tf: number; mv: boolean; seen: number; bubbleUntil: number }

const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class RemotePlayers {
  private map = new Map<string, Remote>();

  constructor(private scene: THREE.Scene, private labels: HTMLElement) {}

  private make(info: RemoteInfo): Remote {
    const v = playerActor(info.raceId, info.classId, info.tone, info.look as Look | undefined);
    const label = document.createElement('div');
    label.className = 'lb'; label.style.color = '#9fe3ff';
    const bubble = document.createElement('div');
    bubble.className = 'bubble'; bubble.style.display = 'none';
    const nm = document.createElement('div'); nm.textContent = `${info.name} · Nv ${info.level}`;
    label.append(bubble, nm);
    this.labels.appendChild(label);
    v.root.visible = false;
    this.scene.add(v.root);
    const x = info.x ?? 0, y = info.y ?? 0;
    return { info, v, label, bubble, x, y, tx: x, ty: y, face: 0, tf: 0, mv: false, seen: performance.now(), bubbleUntil: 0 };
  }

  add(info: RemoteInfo) {
    const old = this.map.get(info.id);
    if (old) { old.info = info; if (info.x != null) { old.tx = info.x; old.ty = info.y!; } return; }
    this.map.set(info.id, this.make(info));
  }

  remove(id: string) {
    const r = this.map.get(id);
    if (!r) return;
    this.scene.remove(r.v.root); r.label.remove();
    this.map.delete(id);
  }

  clear() { for (const id of [...this.map.keys()]) this.remove(id); }

  /** Substitui a lista (ao entrar ou trocar de mapa). */
  setRoster(list: RemoteInfo[]) {
    const keep = new Set(list.map((p) => p.id));
    for (const id of [...this.map.keys()]) if (!keep.has(id)) this.remove(id);
    for (const p of list) this.add(p);
  }

  snap(s: SnapMsg) {
    const now = performance.now();
    for (const [id, x, y, f, mv] of s) {
      const r = this.map.get(id);
      if (!r) continue;
      if (!r.v.root.visible && r.x === r.tx && r.y === r.ty && r.x === 0 && r.y === 0) { r.x = x; r.y = y; }
      r.tx = x; r.ty = y; r.tf = f; r.mv = !!mv; r.seen = now;
    }
  }

  say(id: string, text: string) {
    const r = this.map.get(id);
    if (!r) return;
    r.bubble.textContent = text.length > 60 ? text.slice(0, 57) + '…' : text;
    r.bubble.style.display = '';
    r.bubbleUntil = performance.now() + 6000;
  }

  update(dt: number, now: number, P: (x: number, y: number, h?: number) => THREE.Vector3, place: (el: HTMLElement, v: THREE.Vector3) => void) {
    const t = performance.now();
    for (const r of this.map.values()) {
      const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      if (d > 160) { r.x = r.tx; r.y = r.ty; }
      else if (d > 0.3) { const k = Math.min(1, dt * 9); r.x += dx * k; r.y += dy * k; }
      r.face += angDiff(r.face, r.tf) * Math.min(1, dt * 12);
      const moving = r.mv || d > 2;
      r.v.setMoving(moving);
      r.v.root.position.copy(P(r.x, r.y));
      r.v.root.rotation.y = r.face;
      r.v.root.visible = true;
      r.v.update(dt, now);
      place(r.label, P(r.x, r.y, 2.3));
      if (r.bubbleUntil && t > r.bubbleUntil) { r.bubble.style.display = 'none'; r.bubbleUntil = 0; }
    }
  }

  dispose() { this.clear(); }
}
