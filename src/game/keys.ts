// Teclas configuráveis (habilidades 1–9 e poções). Salvas no navegador (`aldoria-keys`), por aparelho.
export type KeyAction = `skill${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | 'potHeal' | 'potEnergy';
export const KEY_ACTIONS: KeyAction[] = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6', 'skill7', 'skill8', 'skill9', 'potHeal', 'potEnergy'];
export const KEY_LABEL: Record<KeyAction, string> = {
  skill1: 'Habilidade 1 (classe)', skill2: 'Habilidade 2 (classe)', skill3: 'Habilidade 3 (classe)', skill4: 'Habilidade racial',
  skill5: 'Habilidade da arma 1', skill6: 'Habilidade da arma 2', skill7: 'Casa livre 7', skill8: 'Casa livre 8', skill9: 'Casa livre 9',
  potHeal: 'Poção de Cura', potEnergy: 'Poção de Energia',
};
export const DEFAULT_KEYS: Record<KeyAction, string> = {
  skill1: '1', skill2: '2', skill3: '3', skill4: '4', skill5: '5', skill6: '6', skill7: '7', skill8: '8', skill9: '9', potHeal: 'h', potEnergy: 'j',
};
/** teclas que o jogo já usa para outra coisa (movimento, janelas, interação) */
export const RESERVED_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'i', 'c', 'k', 'l', 'm', 'e', 'enter', 'escape', 'f1', 'tab', 'shift', 'control', 'alt', 'meta', ' '];

const KEY = 'aldoria-keys';
let map: Record<KeyAction, string> = load();
function load(): Record<KeyAction, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const out = { ...DEFAULT_KEYS };
    for (const a of KEY_ACTIONS) if (typeof raw[a] === 'string' && raw[a]) out[a] = (raw[a] as string).toLowerCase();
    return out;
  } catch { return { ...DEFAULT_KEYS }; }
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* ignore */ } };

export const keyOf = (a: KeyAction) => map[a];
/** ação ligada a uma tecla (ou undefined) */
export const actionOf = (k: string): KeyAction | undefined => KEY_ACTIONS.find((a) => map[a] === k);
export const keyLabel = (k: string) => k.toUpperCase();
export const skillKeyLabel = (i: number) => keyLabel(map[`skill${i + 1}` as KeyAction]);

/** Troca a tecla de uma ação; se outra ação já a usa, as duas trocam de tecla. Retorna erro em texto ou null. */
export function setKey(a: KeyAction, k: string): string | null {
  k = k.toLowerCase();
  if (RESERVED_KEYS.includes(k)) return 'Essa tecla já é usada pelo jogo (movimento, janelas ou interação).';
  if (!(k.length === 1 || /^f([2-9]|1[0-2])$/.test(k))) return 'Tecla não permitida.';
  const other = actionOf(k);
  if (other && other !== a) map[other] = map[a];
  map[a] = k;
  persist();
  window.dispatchEvent(new Event('aldoria-keys'));
  return null;
}
export function resetKeys() { map = { ...DEFAULT_KEYS }; persist(); window.dispatchEvent(new Event('aldoria-keys')); }
