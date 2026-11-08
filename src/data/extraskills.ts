// Habilidades ativas extras: 4 para cada classe e 4 para cada tipo de arma.
// Não ocupam casas fixas da barra: o jogador as coloca nas 3 casas livres (teclas 7, 8 e 9) pela aba "Barra" da tecla K.
// Usam só tipos de habilidade que o servidor já executa (golpe, projétil, nova, cone, avanço, dreno, buff, cura).
import type { Buff, SkillDef, SkillKind } from './rules';
import type { WeaponFamily } from './weaponskills';

type Extra = { mult?: number; hits?: number; stun?: number; slow?: boolean; buff?: Buff; dur?: number; range?: number; radius?: number; color?: number; desc?: string };
type Row = [name: string, icon: string, kind: SkillKind, extra: Extra];

const BASE: Record<string, [cd: number, cost: number]> = {
  strike: [7000, 20], bolt: [6000, 20], nova: [11000, 28], cone: [9000, 24], dash: [10000, 24], buff: [22000, 22], heal: [12000, 26], drain: [8000, 22], summon: [20000, 30],
};
export const EXTRA_UNLOCK = [6, 9, 12, 15];

function describe(kind: SkillKind, e: Extra): string {
  const x = e.mult ? String(e.mult).replace('.', ',') : '';
  const stun = e.stun ? `, atordoa ${String(e.stun / 1000).replace('.', ',')} s` : '';
  const slow = e.slow ? ', retarda' : '';
  switch (kind) {
    case 'strike': return `Golpe${e.hits && e.hits > 1 ? ` em ${e.hits} acertos` : ''} (dano x${x}${stun}).`;
    case 'bolt': return `Ataque à distância${e.hits && e.hits > 1 ? ` em ${e.hits} projéteis` : ''} (dano x${x}).`;
    case 'nova': return `Explosão ao redor de você (dano x${x}${slow}${stun}).`;
    case 'cone': return `Ataque em cone à frente (dano x${x}${slow}${stun}).`;
    case 'dash': return `Avança e golpeia quem estiver no caminho (dano x${x}).`;
    case 'drain': return `Drena a vida do alvo (dano x${x}, recupera vida).`;
    case 'heal': return `Cura ferimentos (poder x${x}).`;
    case 'buff': {
      const b = e.buff ?? {}; const t: string[] = [];
      if (b.dmg) t.push(`+${b.dmg} de dano`); if (b.ac) t.push(`+${b.ac} de CA`); if (b.speed) t.push(`+${Math.round(b.speed * 100)}% de velocidade`);
      if (b.atkSpeed) t.push(`+${Math.round(b.atkSpeed * 100)}% de vel. de ataque`); if (b.regen) t.push('regeneração');
      return `${t.join(', ')} por ${Math.round((e.dur ?? 12000) / 1000)} s.`;
    }
    default: return '';
  }
}

function build(prefix: string, rows: Row[]): SkillDef[] {
  return rows.map(([name, icon, kind, e], t) => {
    const [cd, cost] = BASE[kind];
    const range = e.range ?? (kind === 'strike' || kind === 'dash' ? 30 : kind === 'bolt' || kind === 'drain' ? 125 : undefined);
    const radius = e.radius ?? (kind === 'nova' ? 60 + t * 6 : kind === 'cone' ? 65 : undefined);
    return {
      id: `${prefix}_x${t + 1}`, name, icon, unlock: EXTRA_UNLOCK[t], kind, desc: e.desc ?? describe(kind, e),
      cd: cd + t * 1500, cost: cost + t * 3, ...(e.mult ? { mult: e.mult } : {}), ...(e.hits ? { hits: e.hits } : {}), ...(e.stun ? { stun: e.stun } : {}),
      ...(e.slow ? { slow: true } : {}), ...(e.buff ? { buff: e.buff } : {}), ...(e.dur ? { dur: e.dur } : e.buff ? { dur: 14000 } : {}),
      ...(range ? { range } : {}), ...(radius ? { radius } : {}), ...(e.color ? { color: e.color } : {}),
    } as SkillDef;
  });
}

// ---------------------------------------------------------------- classes
export const CLASS_EXTRA: Record<string, SkillDef[]> = {
  barbarian: build('c_barbarian', [
    ['Ataque Imprudente', '🪓', 'strike', { mult: 2.8 }], ['Pele Resistente', '🦬', 'buff', { buff: { ac: 3, regen: 2 }, dur: 16000 }],
    ['Pisão Sísmico', '🦶', 'nova', { mult: 1.7, stun: 900 }], ['Fúria Primal', '🔥', 'buff', { buff: { dmg: 6, atkSpeed: 0.15 }, dur: 14000 }]]),
  bard: build('c_bard', [
    ['Dissonância Sônica', '🔊', 'bolt', { mult: 2.2, color: 0xff7ad9 }], ['Trovão Estilhaçante', '💥', 'nova', { mult: 1.7, color: 0xffb0e8 }],
    ['Padrão Hipnótico', '🌀', 'nova', { mult: 1.0, stun: 1400, color: 0xc08aff }], ['Cura Coletiva', '🎼', 'heal', { mult: 2.0 }]]),
  cleric: build('c_cleric', [
    ['Arma Espiritual', '🔨', 'bolt', { mult: 2.3, color: 0xfff2a8 }], ['Bênção', '🙏', 'buff', { buff: { dmg: 3, ac: 2 }, dur: 16000 }],
    ['Coluna de Chamas', '🔥', 'nova', { mult: 2.0, color: 0xffd27a }], ['Cura Maior', '💞', 'heal', { mult: 2.2 }]]),
  druid: build('c_druid', [
    ['Raio Lunar', '🌙', 'bolt', { mult: 2.4, color: 0xc8d8ff }], ['Emaranhar', '🌱', 'nova', { mult: 1.2, slow: true, color: 0x7ae07a }],
    ['Pele de Árvore', '🌳', 'buff', { buff: { ac: 4 }, dur: 16000 }], ['Enxame de Insetos', '🐝', 'cone', { mult: 2.0, slow: true, color: 0xd8c85a }]]),
  fighter: build('c_fighter', [
    ['Golpe de Escudo', '🛡️', 'strike', { mult: 1.6, stun: 1000 }], ['Manobra de Varredura', '🌪️', 'cone', { mult: 1.9 }],
    ['Retomar Fôlego', '💨', 'heal', { mult: 1.6 }], ['Surto de Ação', '⚡', 'buff', { buff: { atkSpeed: 0.25, dmg: 2 }, dur: 10000 }]]),
  monk: build('c_monk', [
    ['Golpe Atordoante', '👊', 'strike', { mult: 1.8, stun: 1500 }], ['Rajada de Golpes', '🥋', 'strike', { mult: 0.8, hits: 3 }],
    ['Passo do Vento', '🌬️', 'dash', { mult: 1.9 }], ['Palma Vibrante', '🖐️', 'strike', { mult: 3.6 }]]),
  paladin: build('c_paladin', [
    ['Punição Divina', '⚡', 'strike', { mult: 2.7 }], ['Aura de Proteção', '🛡️', 'buff', { buff: { ac: 3, regen: 2 }, dur: 18000 }],
    ['Imposição de Mãos', '🤲', 'heal', { mult: 2.3 }], ['Nimbo Sagrado', '☀️', 'nova', { mult: 2.0, color: 0xfff2a8 }]]),
  ranger: build('c_ranger', [
    ['Tiro Mirado', '🎯', 'bolt', { mult: 2.6 }], ['Chuva de Flechas', '🏹', 'cone', { mult: 1.9 }],
    ['Armadilha de Espinhos', '🪤', 'nova', { mult: 1.4, slow: true, color: 0x7ae07a }], ['Passos Silenciosos', '🍃', 'buff', { buff: { speed: 0.3, dmg: 3 }, dur: 14000 }]]),
  rogue: build('c_rogue', [
    ['Golpe Duplo', '🗡️', 'strike', { mult: 1.0, hits: 2 }], ['Nuvem de Fumaça', '💨', 'nova', { mult: 1.0, slow: true, color: 0xbbbbbb }],
    ['Esquiva Sobrenatural', '🌫️', 'buff', { buff: { ac: 4, speed: 0.2 }, dur: 12000 }], ['Ataque Furtivo Mortal', '☠️', 'strike', { mult: 3.6 }]]),
  sorcerer: build('c_sorcerer', [
    ['Mãos Flamejantes', '🔥', 'cone', { mult: 2.0, color: 0xff7a3a }], ['Relâmpago', '⚡', 'bolt', { mult: 2.6, color: 0xbfe0ff }],
    ['Tempestade de Gelo', '❄️', 'nova', { mult: 1.9, slow: true, color: 0x9fe0ff }], ['Fúria Dracônica', '🐉', 'buff', { buff: { dmg: 6, atkSpeed: 0.1 }, dur: 14000 }]]),
  warlock: build('c_warlock', [
    ['Rajada Mística', '🟣', 'bolt', { mult: 2.3, color: 0xb36aff }], ['Fome de Hadar', '🌑', 'nova', { mult: 1.5, slow: true, color: 0x6a2aa0 }],
    ['Toque Vampírico', '🩸', 'drain', { mult: 2.3 }], ['Pacto Sombrio', '📜', 'buff', { buff: { dmg: 5, regen: 2 }, dur: 14000 }]]),
  wizard: build('c_wizard', [
    ['Mísseis Mágicos', '✨', 'bolt', { mult: 0.9, hits: 3, color: 0xb88aff }], ['Cone de Frio', '🧊', 'cone', { mult: 2.2, slow: true, color: 0x9fe0ff }],
    ['Escudo Arcano', '🔰', 'buff', { buff: { ac: 5 }, dur: 14000 }], ['Bola de Fogo', '☄️', 'nova', { mult: 2.6, color: 0xff7a3a }]]),
  necromancer: build('c_necromancer', [
    ['Raio Necrótico', '💀', 'bolt', { mult: 2.3, color: 0x6aff9a }], ['Drenar Vida', '🩸', 'drain', { mult: 2.5 }],
    ['Onda Putrefata', '☣️', 'nova', { mult: 1.6, slow: true, color: 0x7aa84a }], ['Armadura Macabra', '🦴', 'buff', { buff: { ac: 4, regen: 3 }, dur: 16000 }]]),
  eldknight: build('c_eldknight', [
    ['Golpe Arcano', '🔷', 'strike', { mult: 2.6, color: 0xb88aff }], ['Escudo Rúnico', '🔰', 'buff', { buff: { ac: 4, regen: 1 }, dur: 16000 }],
    ['Passo Nebuloso', '🌫️', 'dash', { mult: 1.8 }], ['Explosão de Energia', '💥', 'nova', { mult: 2.0, color: 0xb88aff }]]),
  bladesinger: build('c_bladesinger', [
    ['Dança Mortal', '💃', 'strike', { mult: 0.8, hits: 3 }], ['Canção da Lâmina', '🎶', 'buff', { buff: { atkSpeed: 0.2, ac: 2 }, dur: 14000 }],
    ['Passo Nebuloso', '🌫️', 'dash', { mult: 1.8 }], ['Lâmina Flamejante', '🔥', 'strike', { mult: 3.0, color: 0xff7a3a }]]),
  illusionist: build('c_illusionist', [
    ['Raio Fantasmagórico', '👻', 'bolt', { mult: 2.4, color: 0xd8a0ff }], ['Cores Dançantes', '🌈', 'cone', { mult: 1.2, stun: 1300, color: 0xff9ad9 }],
    ['Imagem Espelhada', '🪞', 'buff', { buff: { ac: 4, speed: 0.1 }, dur: 14000 }], ['Invisibilidade', '🫥', 'buff', { buff: { speed: 0.25, dmg: 5 }, dur: 12000 }]]),
};

// ---------------------------------------------------------------- armas
export const WEAPON_EXTRA: Record<WeaponFamily, SkillDef[]> = {
  dagger: build('w_dagger', [['Lâminas Gêmeas', '🗡️', 'strike', { mult: 0.9, hits: 2 }], ['Veneno na Lâmina', '🧪', 'buff', { buff: { dmg: 3, atkSpeed: 0.1 }, dur: 14000 }], ['Dança das Adagas', '🌀', 'nova', { mult: 1.5 }], ['Golpe na Nuca', '☠️', 'strike', { mult: 3.4 }]]),
  sword: build('w_sword', [['Estocada Veloz', '🤺', 'dash', { mult: 1.7 }], ['Postura de Duelista', '🛡️', 'buff', { buff: { ac: 3, dmg: 2 }, dur: 14000 }], ['Golpe Ascendente', '⚔️', 'strike', { mult: 2.6 }], ['Tempestade de Aço', '🌪️', 'nova', { mult: 2.0 }]]),
  greatsword: build('w_greatsword', [['Investida Pesada', '🐂', 'dash', { mult: 2.0 }], ['Golpe Rachador', '🪓', 'strike', { mult: 3.0 }], ['Postura Imponente', '🏰', 'buff', { buff: { ac: 3, dmg: 3 }, dur: 14000 }], ['Execução', '⚰️', 'strike', { mult: 4.0 }]]),
  axe: build('w_axe', [['Golpe Duplo de Machado', '🪓', 'strike', { mult: 1.1, hits: 2 }], ['Arremesso Giratório', '🌀', 'bolt', { mult: 2.2 }], ['Corte Selvagem', '🩸', 'cone', { mult: 1.9 }], ['Sede de Sangue', '😤', 'buff', { buff: { dmg: 4, atkSpeed: 0.12 }, dur: 12000 }]]),
  greataxe: build('w_greataxe', [['Machadada Sísmica', '💢', 'nova', { mult: 1.8, stun: 800 }], ['Corte Ceifador', '🌙', 'cone', { mult: 2.2 }], ['Frenesi', '😡', 'buff', { buff: { dmg: 6, atkSpeed: 0.15 }, dur: 12000 }], ['Decapitar', '💀', 'strike', { mult: 4.2 }]]),
  mace: build('w_mace', [['Golpe Sagrado', '✨', 'strike', { mult: 2.2 }], ['Martelar o Escudo', '🛡️', 'strike', { mult: 1.5, stun: 1000 }], ['Bênção da Maça', '🙏', 'buff', { buff: { ac: 2, dmg: 3 }, dur: 14000 }], ['Estrondo', '🌊', 'nova', { mult: 1.6, slow: true }]]),
  hammer: build('w_hammer', [['Martelo Flamejante', '🔥', 'strike', { mult: 2.6 }], ['Chuva de Faíscas', '✴️', 'cone', { mult: 1.8 }], ['Forja Interior', '⚒️', 'buff', { buff: { ac: 3, dmg: 3 }, dur: 14000 }], ['Queda do Martelo', '☄️', 'nova', { mult: 2.4, stun: 900 }]]),
  pole: build('w_pole', [['Golpe Giratório', '🌀', 'nova', { mult: 1.4 }], ['Rasteira', '🦵', 'strike', { mult: 1.4, stun: 1000 }], ['Postura da Garça', '🪶', 'buff', { buff: { speed: 0.2, ac: 2 }, dur: 14000 }], ['Chuva de Golpes', '🥢', 'strike', { mult: 0.8, hits: 3 }]]),
  kama: build('w_kama', [['Colheita Ágil', '🌾', 'cone', { mult: 1.7 }], ['Corte Duplo da Kama', '⚔️', 'strike', { mult: 0.9, hits: 2 }], ['Fluxo do Ki', '🧘', 'buff', { buff: { atkSpeed: 0.18, speed: 0.1 }, dur: 14000 }], ['Giro Ceifador', '🌪️', 'nova', { mult: 1.9 }]]),
  scythe: build('w_scythe', [['Ceifa de Almas', '💀', 'cone', { mult: 2.0 }], ['Corte Espectral', '👻', 'bolt', { mult: 2.2, color: 0x9affc8 }], ['Colheita Sombria', '🩸', 'drain', { mult: 2.2 }], ['Toque da Morte', '☠️', 'strike', { mult: 3.8 }]]),
  scepter: build('w_scepter', [['Comando Real', '👑', 'buff', { buff: { dmg: 3, ac: 2 }, dur: 14000 }], ['Raio Escarlate', '🔴', 'bolt', { mult: 2.3, color: 0xff6a6a }], ['Decreto de Poder', '📜', 'nova', { mult: 1.7, stun: 800 }], ['Cetro do Juízo', '⚖️', 'strike', { mult: 3.2 }]]),
  bow: build('w_bow', [['Tiro Duplo', '🏹', 'bolt', { mult: 1.1, hits: 2 }], ['Flecha Perfurante', '🎯', 'bolt', { mult: 2.8 }], ['Chuva de Flechas', '🌧️', 'cone', { mult: 1.9 }], ['Olho de Falcão', '🦅', 'buff', { buff: { dmg: 4, atkSpeed: 0.12 }, dur: 14000 }]]),
  crossbow: build('w_crossbow', [['Virote Pesado', '🔩', 'bolt', { mult: 2.7 }], ['Saraivada', '🏹', 'bolt', { mult: 0.9, hits: 3 }], ['Virote Explosivo', '💣', 'nova', { mult: 1.8 }], ['Mira Firme', '🎯', 'buff', { buff: { dmg: 5, ac: 1 }, dur: 14000 }]]),
  wristbow: build('w_wristbow', [['Disparo Rápido', '⚡', 'bolt', { mult: 0.8, hits: 3 }], ['Virote Envenenado', '🧪', 'bolt', { mult: 2.2, color: 0x7ae07a }], ['Salto Tático', '🤸', 'dash', { mult: 1.6 }], ['Mãos Firmes', '🖐️', 'buff', { buff: { atkSpeed: 0.2, dmg: 2 }, dur: 12000 }]]),
  wand: build('w_wand', [['Raio Arcano', '🔆', 'bolt', { mult: 2.3, color: 0xb88aff }], ['Explosão Menor', '💥', 'nova', { mult: 1.6, color: 0xb88aff }], ['Foco Mental', '🧠', 'buff', { buff: { dmg: 4, atkSpeed: 0.1 }, dur: 14000 }], ['Descarga Final', '⚡', 'bolt', { mult: 3.2, color: 0xe0c8ff }]]),
  staff: build('w_staff', [['Bola de Energia', '🔮', 'bolt', { mult: 2.5, color: 0xb88aff }], ['Cajado Giratório', '🌀', 'nova', { mult: 1.5 }], ['Canalizar Mana', '💧', 'buff', { buff: { dmg: 4, regen: 3 }, dur: 14000 }], ['Cataclismo Arcano', '☄️', 'nova', { mult: 2.6, color: 0xff9ad9 }]]),
  book: build('w_book', [['Página Flamejante', '📖', 'bolt', { mult: 2.2, color: 0xff7a3a }], ['Anotações Arcanas', '📝', 'buff', { buff: { dmg: 3, ac: 2 }, dur: 14000 }], ['Runa Explosiva', '💠', 'nova', { mult: 1.9, color: 0xb88aff }], ['Palavra Proibida', '📕', 'bolt', { mult: 3.2, color: 0xff6aa8 }]]),
  lute: build('w_lute', [['Acorde Dissonante', '🎸', 'cone', { mult: 1.8, color: 0xff7ad9 }], ['Melodia Encantadora', '🎶', 'nova', { mult: 1.0, stun: 1200, color: 0xc08aff }], ['Canção de Batalha', '🎵', 'buff', { buff: { dmg: 3, atkSpeed: 0.12 }, dur: 14000 }], ['Crescendo', '🎼', 'bolt', { mult: 2.8, color: 0xffe08a }]]),
  fists: build('w_fists', [['Combo de Socos', '👊', 'strike', { mult: 0.8, hits: 3 }], ['Soco Ascendente', '🥊', 'strike', { mult: 2.2, stun: 900 }], ['Punho de Ferro', '🔩', 'buff', { buff: { dmg: 4, ac: 1 }, dur: 14000 }], ['Onda de Impacto', '🌊', 'cone', { mult: 2.2 }]]),
};

export const EXTRA_BY_ID: Record<string, SkillDef> = {};
for (const l of Object.values(CLASS_EXTRA)) for (const s of l) EXTRA_BY_ID[s.id] = s;
for (const l of Object.values(WEAPON_EXTRA)) for (const s of l) EXTRA_BY_ID[s.id] = s;
