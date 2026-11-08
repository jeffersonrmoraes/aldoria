// Habilidades de arma: cada tipo (família) de arma dá 2 habilidades extras, nas casas 5 e 6 da barra (teclas 5 e 6).
// Elas trocam junto com a arma da mão direita e valem para qualquer classe (o dano segue a penalidade de arma fora da classe).
// Reaproveitam os mesmos tipos de habilidade (golpe, projétil, nova, cone, buff…) — por isso o servidor online as entende sem mudar o protocolo.
import { SkillDef } from './rules';

export type WeaponFamily = 'dagger' | 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'mace' | 'hammer' | 'pole' | 'kama' | 'scythe' | 'scepter'
  | 'bow' | 'crossbow' | 'wristbow' | 'wand' | 'staff' | 'book' | 'lute' | 'fists';

/** Tipo da arma pelo nome (mesma lógica de aparência em `weaponProp`, em `art/actors.ts`). */
export function weaponFamily(raw?: string): WeaponFamily {
  const n = (raw ?? '').toLowerCase();
  if (!n || /manopla|punho/.test(n)) return 'fists';
  if (/adaga|punhal/.test(n)) return 'dagger';
  if (/montante/.test(n)) return 'greatsword';
  if (/espada|cimitarra|rapieira|l[âa]mina/.test(n)) return 'sword';
  if (/machado grande/.test(n)) return 'greataxe';
  if (/machad/.test(n)) return 'axe';
  if (/martelo/.test(n)) return 'hammer';
  if (/ma[çc]a/.test(n)) return 'mace';
  if (/kama/.test(n)) return 'kama';
  if (/foice/.test(n)) return 'scythe';
  if (/bord[ãa]o|bast[ãa]o/.test(n)) return 'pole';
  if (/besta de pulso|bra[çc]adeira/.test(n)) return 'wristbow';
  if (/besta/.test(n)) return 'crossbow';
  if (/arco/.test(n)) return 'bow';
  if (/cajado/.test(n)) return 'staff';
  if (/cetro/.test(n)) return 'scepter';
  if (/varinha/.test(n)) return 'wand';
  if (/livro|grim[óo]rio|tomo/.test(n)) return 'book';
  if (/ala[úu]de|harpa/.test(n)) return 'lute';
  return 'sword';
}

export const FAMILY_NAMES: Record<WeaponFamily, string> = {
  dagger: 'Adaga', sword: 'Espada', greatsword: 'Montante', axe: 'Machado', greataxe: 'Machado Grande', mace: 'Maça', hammer: 'Martelo de Guerra',
  pole: 'Bordão', kama: 'Kama', scythe: 'Foice', scepter: 'Cetro', bow: 'Arco', crossbow: 'Besta', wristbow: 'Besta de Pulso', wand: 'Varinha',
  staff: 'Cajado', book: 'Livro', lute: 'Alaúde', fists: 'Punhos',
};

const W = (id: string, s: Omit<SkillDef, 'id' | 'unlock'> & { unlock?: number }): SkillDef => ({ id, unlock: 1, ...s });

export const WEAPON_SKILLS: Record<WeaponFamily, [SkillDef, SkillDef]> = {
  dagger: [
    W('w_dagger_1', { name: 'Golpe Furtivo', desc: 'Estocada pelas costas (dano x2,1).', icon: '🗡️', cd: 5000, cost: 14, kind: 'strike', mult: 2.1, range: 30 }),
    W('w_dagger_2', { name: 'Arremessar Adaga', desc: 'Lança a adaga à distância (dano x1,5).', icon: '🎯', unlock: 4, cd: 4500, cost: 12, kind: 'bolt', mult: 1.5, range: 120, color: 0xdcdcdc }),
  ],
  sword: [
    W('w_sword_1', { name: 'Corte Cruzado', desc: 'Dois cortes rápidos (x0,9 cada).', icon: '⚔️', cd: 5000, cost: 16, kind: 'strike', mult: 0.9, hits: 2, range: 30 }),
    W('w_sword_2', { name: 'Redemoinho de Lâminas', desc: 'Gira a espada atingindo todos ao redor (x1,2).', icon: '🌀', unlock: 4, cd: 9000, cost: 24, kind: 'nova', mult: 1.2, radius: 55, color: 0xdfe6f0 }),
  ],
  greatsword: [
    W('w_greatsword_1', { name: 'Golpe Devastador', desc: 'Golpe de duas mãos que atordoa (x2,6, 0,7 s).', icon: '💥', cd: 8000, cost: 22, kind: 'strike', mult: 2.6, range: 32, stun: 700 }),
    W('w_greatsword_2', { name: 'Arco do Montante', desc: 'Corte em arco à frente (x1,6).', icon: '🌙', unlock: 4, cd: 7000, cost: 20, kind: 'cone', mult: 1.6, radius: 70, color: 0xcfd8e6 }),
  ],
  axe: [
    W('w_axe_1', { name: 'Machadada', desc: 'Golpe pesado de machado (dano x1,9).', icon: '🪓', cd: 4500, cost: 14, kind: 'strike', mult: 1.9, range: 30 }),
    W('w_axe_2', { name: 'Arremessar Machadinha', desc: 'Arremessa o machado (dano x1,6).', icon: '🎯', unlock: 4, cd: 5000, cost: 14, kind: 'bolt', mult: 1.6, range: 110, color: 0xc9c9c9 }),
  ],
  greataxe: [
    W('w_greataxe_1', { name: 'Racha-Crânio', desc: 'Golpe brutal de duas mãos (dano x2,9).', icon: '💀', cd: 9000, cost: 24, kind: 'strike', mult: 2.9, range: 32 }),
    W('w_greataxe_2', { name: 'Grito de Guerra', desc: '+5 de dano e +10% velocidade de ataque por 12s.', icon: '📣', unlock: 4, cd: 20000, cost: 20, kind: 'buff', dur: 12000, buff: { dmg: 5, atkSpeed: 0.1 } }),
  ],
  mace: [
    W('w_mace_1', { name: 'Golpe Atordoante', desc: 'Pancada que atordoa (x1,4, 1,2 s).', icon: '🔨', cd: 8000, cost: 18, kind: 'strike', mult: 1.4, range: 30, stun: 1200 }),
    W('w_mace_2', { name: 'Onda de Choque', desc: 'Bate no chão atordoando quem está perto (x1,0).', icon: '🌊', unlock: 4, cd: 11000, cost: 22, kind: 'nova', mult: 1.0, radius: 48, stun: 700, color: 0xffe08a }),
  ],
  hammer: [
    W('w_hammer_1', { name: 'Martelada Trovejante', desc: 'Martelada que atordoa (x2,4, 0,8 s).', icon: '⚡', cd: 9000, cost: 22, kind: 'strike', mult: 2.4, range: 30, stun: 800 }),
    W('w_hammer_2', { name: 'Terremoto', desc: 'Abala o chão, ferindo e retardando (x1,3).', icon: '🌋', unlock: 4, cd: 12000, cost: 26, kind: 'nova', mult: 1.3, radius: 70, slow: true, color: 0xb08a5a }),
  ],
  pole: [
    W('w_pole_1', { name: 'Varredura do Bordão', desc: 'Varre os inimigos à frente (x1,3).', icon: '🥢', cd: 6000, cost: 14, kind: 'cone', mult: 1.3, radius: 60, color: 0xe6d3a3 }),
    W('w_pole_2', { name: 'Postura Defensiva', desc: '+3 de CA por 10s.', icon: '🛡️', unlock: 4, cd: 18000, cost: 14, kind: 'buff', dur: 10000, buff: { ac: 3 } }),
  ],
  kama: [
    W('w_kama_1', { name: 'Golpe Ceifador', desc: 'Dois golpes curvos (x1,0 cada).', icon: '🌙', cd: 5000, cost: 16, kind: 'strike', mult: 1.0, hits: 2, range: 30 }),
    W('w_kama_2', { name: 'Dança da Lâmina Curva', desc: 'Giro de foices ao redor (x1,1).', icon: '🌀', unlock: 4, cd: 9000, cost: 22, kind: 'nova', mult: 1.1, radius: 50, color: 0xd9d9e8 }),
  ],
  scythe: [
    W('w_scythe_1', { name: 'Colheita Sombria', desc: 'Ceifa o alvo e rouba vida (x1,5).', icon: '🌑', cd: 6000, cost: 18, kind: 'drain', mult: 1.5, range: 60, color: 0x9bffc0 }),
    W('w_scythe_2', { name: 'Ceifada Lunar', desc: 'Corte amplo em arco (x1,7).', icon: '🌙', unlock: 4, cd: 8000, cost: 22, kind: 'cone', mult: 1.7, radius: 75, color: 0xcfe0ff }),
  ],
  scepter: [
    W('w_scepter_1', { name: 'Raio Necrótico', desc: 'Projétil sombrio (dano x1,9).', icon: '☠️', cd: 5000, cost: 16, kind: 'bolt', mult: 1.9, range: 130, color: 0x6aff9a }),
    W('w_scepter_2', { name: 'Mortalha', desc: 'Onda gélida que fere e retarda (x1,2).', icon: '👻', unlock: 4, cd: 11000, cost: 24, kind: 'nova', mult: 1.2, radius: 60, slow: true, color: 0x8fe0c0 }),
  ],
  bow: [
    W('w_bow_1', { name: 'Tiro Certeiro', desc: 'Flecha precisa de longo alcance (dano x2,0).', icon: '🏹', cd: 5000, cost: 16, kind: 'bolt', mult: 2.0, range: 230, color: 0xd9c08a }),
    W('w_bow_2', { name: 'Saraivada', desc: 'Três flechas rápidas (x0,8 cada).', icon: '🌧️', unlock: 4, cd: 8000, cost: 22, kind: 'bolt', mult: 0.8, hits: 3, range: 200, color: 0xd9c08a }),
  ],
  crossbow: [
    W('w_crossbow_1', { name: 'Virote Perfurante', desc: 'Virote potente (dano x2,3).', icon: '🎯', cd: 6000, cost: 18, kind: 'bolt', mult: 2.3, range: 210, color: 0xc9b07a }),
    W('w_crossbow_2', { name: 'Disparo Atordoante', desc: 'Virote que atordoa (x1,2, 0,9 s).', icon: '💫', unlock: 4, cd: 9000, cost: 18, kind: 'bolt', mult: 1.2, range: 190, stun: 900, color: 0xffe08a }),
  ],
  wristbow: [
    W('w_wristbow_1', { name: 'Rajada Rápida', desc: 'Três virotes seguidos (x0,7 cada).', icon: '🦾', cd: 6000, cost: 18, kind: 'bolt', mult: 0.7, hits: 3, range: 150, color: 0xc9b07a }),
    W('w_wristbow_2', { name: 'Virote Envenenado', desc: 'Virote que fere e retarda (x1,4).', icon: '🧪', unlock: 4, cd: 7000, cost: 16, kind: 'bolt', mult: 1.4, range: 150, slow: true, color: 0x7ae07a }),
  ],
  wand: [
    W('w_wand_1', { name: 'Dardos Místicos', desc: 'Três dardos de força (x0,7 cada).', icon: '✨', cd: 5000, cost: 16, kind: 'bolt', mult: 0.7, hits: 3, range: 140, color: 0xb06aff }),
    W('w_wand_2', { name: 'Raio Arcano', desc: 'Raio concentrado (dano x2,0).', icon: '⚡', unlock: 4, cd: 7000, cost: 20, kind: 'bolt', mult: 2.0, range: 150, color: 0x8ab4ff }),
  ],
  staff: [
    W('w_staff_1', { name: 'Bola de Fogo', desc: 'Esfera flamejante (dano x2,3).', icon: '🔥', cd: 6000, cost: 22, kind: 'bolt', mult: 2.3, range: 160, color: 0xff7a1a }),
    W('w_staff_2', { name: 'Nova Arcana', desc: 'Explosão de energia ao redor (x1,4).', icon: '💥', unlock: 4, cd: 11000, cost: 26, kind: 'nova', mult: 1.4, radius: 70, color: 0xb06aff }),
  ],
  book: [
    W('w_book_1', { name: 'Palavra de Poder', desc: 'Palavra que fere e atordoa (x1,2, 1,2 s).', icon: '📖', cd: 8000, cost: 18, kind: 'bolt', mult: 1.2, range: 130, stun: 1200, color: 0xffd23f }),
    W('w_book_2', { name: 'Escudo Arcano', desc: '+4 de CA por 12s.', icon: '🔰', unlock: 4, cd: 18000, cost: 16, kind: 'buff', dur: 12000, buff: { ac: 4 } }),
  ],
  lute: [
    W('w_lute_1', { name: 'Canção Inspiradora', desc: '+3 de dano e +10% velocidade de ataque por 12s.', icon: '🎶', cd: 20000, cost: 20, kind: 'buff', dur: 12000, buff: { dmg: 3, atkSpeed: 0.1 } }),
    W('w_lute_2', { name: 'Acorde Dissonante', desc: 'Onda sonora que atordoa (x1,0, 0,6 s).', icon: '🎸', unlock: 4, cd: 10000, cost: 20, kind: 'nova', mult: 1.0, radius: 55, stun: 600, color: 0xff7ae0 }),
  ],
  fists: [
    W('w_fists_1', { name: 'Rajada de Punhos', desc: 'Três socos rápidos (x0,8 cada).', icon: '🥊', cd: 5000, cost: 14, kind: 'strike', mult: 0.8, hits: 3, range: 28 }),
    W('w_fists_2', { name: 'Palma Vibrante', desc: 'Golpe de ki que atordoa (x2,2, 0,9 s).', icon: '🖐️', unlock: 4, cd: 9000, cost: 20, kind: 'strike', mult: 2.2, range: 28, stun: 900 }),
  ],
};
