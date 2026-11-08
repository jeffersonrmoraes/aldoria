// Aparência do personagem (editor de criação): cabelo, olhos, altura, roupa, cabeça, rosto.
// Tudo é puro/serializável (guardado no save). O desenho 3D fica em `src/art/actors.ts` (`applyLook`).
// Inspirado nas opções de aparência de D&D (cabelo, olhos, porte, trajes, adereços de cabeça, pinturas/cicatrizes).

export interface Opt { id: string; name: string }

export interface Look {
  hair: string;       // estilo do cabelo
  hairColor: string;  // cor (hex)
  eyes: string;       // formato dos olhos
  eyeColor: string;   // cor da íris (hex)
  height: number;     // 0 = baixo … 1 = alto (escala 0,90–1,10)
  outfit: string;     // paleta da roupa
  head: string;       // adereço de cabeça
  face: string;       // pelos/marcas no rosto
}

export const HAIR_STYLES: Opt[] = [
  { id: 'none', name: 'Careca' }, { id: 'short', name: 'Curto' }, { id: 'spiky', name: 'Espetado' }, { id: 'long', name: 'Longo' },
  { id: 'pony', name: 'Rabo de Cavalo' }, { id: 'bun', name: 'Coque' }, { id: 'mohawk', name: 'Moicano' }, { id: 'afro', name: 'Volumoso' },
  { id: 'bob', name: 'Chanel' }, { id: 'braids', name: 'Tranças' },
];
export const HAIR_COLORS = ['#2a1a10', '#5a3a1e', '#8a5a2a', '#c9a24a', '#f0dca0', '#d8602a', '#a02a2a', '#d0d0d8', '#3a4a8a', '#3a8a5a', '#8a3aa0', '#e060a0'];
export const EYE_SHAPES: Opt[] = [
  { id: 'round', name: 'Redondos' }, { id: 'big', name: 'Grandes' }, { id: 'narrow', name: 'Estreitos' }, { id: 'slit', name: 'Felinos' },
];
export const EYE_COLORS = ['#3a2a1a', '#7a4a22', '#2a6ad0', '#2a9a5a', '#7a8a3a', '#8a8a95', '#a02a2a', '#8a3aa0', '#e0b020', '#30c8d8'];
export const OUTFITS: Opt[] = [
  { id: 'default', name: 'Original' }, { id: 'crimson', name: 'Carmesim' }, { id: 'azure', name: 'Azul-real' }, { id: 'forest', name: 'Verde-floresta' },
  { id: 'shadow', name: 'Sombra' }, { id: 'ivory', name: 'Marfim' }, { id: 'gold', name: 'Dourado' }, { id: 'violet', name: 'Violeta' }, { id: 'ember', name: 'Brasa' },
];
export const OUTFIT_TINT: Record<string, string> = {
  crimson: '#e0706a', azure: '#6a9ae8', forest: '#78b878', shadow: '#6a6a78', ivory: '#fff4dc', gold: '#f0cc6a', violet: '#b08ae0', ember: '#f09a58',
};
export const HEADGEARS: Opt[] = [
  { id: 'default', name: 'Da Classe' }, { id: 'none', name: 'Sem nada' }, { id: 'headband', name: 'Faixa' }, { id: 'circlet', name: 'Tiara' },
  { id: 'hood', name: 'Capuz' }, { id: 'witch', name: 'Chapéu de Mago' }, { id: 'feather', name: 'Chapéu de Bardo' }, { id: 'helm', name: 'Elmo Aberto' },
  { id: 'horns', name: 'Elmo de Chifres' }, { id: 'crown', name: 'Coroa' },
];
export const FACES: Opt[] = [
  { id: 'none', name: 'Limpo' }, { id: 'beard', name: 'Barba' }, { id: 'goatee', name: 'Cavanhaque' }, { id: 'stache', name: 'Bigode' },
  { id: 'scar', name: 'Cicatriz' }, { id: 'paint', name: 'Pintura de Guerra' }, { id: 'freckles', name: 'Sardas' }, { id: 'patch', name: 'Tapa-olho' },
  { id: 'goggles', name: 'Óculos de Artífice' },
];

export const HEIGHT_MIN = 0.9, HEIGHT_MAX = 1.1;
export const heightScale = (h: number) => HEIGHT_MIN + Math.min(1, Math.max(0, h)) * (HEIGHT_MAX - HEIGHT_MIN);

export const defaultLook = (): Look => ({
  hair: 'short', hairColor: HAIR_COLORS[1], eyes: 'round', eyeColor: EYE_COLORS[1], height: 0.5, outfit: 'default', head: 'default', face: 'none',
});

const pick = (v: unknown, list: Opt[], d: string) => (typeof v === 'string' && list.some((o) => o.id === v) ? v : d);
const color = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);

/** Aceita qualquer coisa (save antigo, mensagem de rede) e devolve uma aparência válida. */
export function sanitizeLook(raw: unknown): Look {
  const d = defaultLook();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const h = Number(r.height);
  return {
    hair: pick(r.hair, HAIR_STYLES, d.hair), hairColor: color(r.hairColor, d.hairColor),
    eyes: pick(r.eyes, EYE_SHAPES, d.eyes), eyeColor: color(r.eyeColor, d.eyeColor),
    height: Number.isFinite(h) ? Math.min(1, Math.max(0, h)) : d.height,
    outfit: pick(r.outfit, OUTFITS, d.outfit), head: pick(r.head, HEADGEARS, d.head), face: pick(r.face, FACES, d.face),
  };
}

/** Sorteia uma aparência (botão 🎲). */
export function randomLook(rnd: () => number = Math.random): Look {
  const p = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return {
    hair: p(HAIR_STYLES).id, hairColor: p(HAIR_COLORS), eyes: p(EYE_SHAPES).id, eyeColor: p(EYE_COLORS), height: rnd(),
    outfit: p(OUTFITS).id, head: rnd() < 0.5 ? 'default' : p(HEADGEARS).id, face: rnd() < 0.5 ? 'none' : p(FACES).id,
  };
}
