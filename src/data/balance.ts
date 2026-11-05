/** Ajuste fino de dano por classe (multiplicador), calibrado com `tools/balance.ts` (simulação de duelos nos níveis 2–10). */
export const CLASS_POWER: Record<string, number> = {
  barbarian: 0.8, bard: 1.25, cleric: 1.15, druid: 1.25, fighter: 1.12, monk: 0.9, paladin: 1.22, ranger: 1.0,
  rogue: 0.9, sorcerer: 0.95, warlock: 1.0, wizard: 0.8, necromancer: 0.92, eldknight: 1.05, bladesinger: 0.86, illusionist: 1.08,
};
