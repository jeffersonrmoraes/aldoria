/** Barramento de eventos entre a cena do jogo (Three.js) e a interface (DOM). */
type Fn = (...a: any[]) => void;
class Bus {
  private m = new Map<string, Fn[]>();
  on(e: string, f: Fn) { (this.m.get(e) ?? this.m.set(e, []).get(e)!).push(f); return this; }
  emit(e: string, ...a: any[]) { for (const f of [...(this.m.get(e) ?? [])]) f(...a); return this; }
  off(e: string, f: Fn) { const l = this.m.get(e); if (l) this.m.set(e, l.filter((x) => x !== f)); return this; }
  removeAllListeners(e?: string) { if (e) this.m.delete(e); else this.m.clear(); return this; }
}
export const bus = new Bus();
