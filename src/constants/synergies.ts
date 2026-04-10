import { ClassId } from '../types';

export interface SynergyDef {
  classes: [ClassId, ClassId];
  name: string;
  description: string;
  bonus: { atkMultiplier?: number; defenseMultiplier?: number; healMultiplier?: number };
}

export const SYNERGIES: SynergyDef[] = [
  { classes: ['WARRIOR', 'HEALER'], name: 'Linha de Frente', description: 'Guerreiro + Curandeiro: +10% ATK', bonus: { atkMultiplier: 1.10 } },
  { classes: ['TANK', 'ARCHER'], name: 'Muralha e Flecha', description: 'Tanque + Arqueiro: +15% DEF para o time', bonus: { defenseMultiplier: 1.15 } },
  { classes: ['ROGUE', 'MAGE'], name: 'Caos Arcano', description: 'Ladino + Mago: +12% ATK', bonus: { atkMultiplier: 1.12 } },
  { classes: ['TANK', 'HEALER'], name: 'Bastião', description: 'Tanque + Curandeiro: +20% heal', bonus: { healMultiplier: 1.20 } },
  { classes: ['WARRIOR', 'ROGUE'], name: 'Emboscada', description: 'Guerreiro + Ladino: +8% ATK', bonus: { atkMultiplier: 1.08 } },
  { classes: ['ARCHER', 'MAGE'], name: 'Artilharia', description: 'Arqueiro + Mago: +10% ATK', bonus: { atkMultiplier: 1.10 } },
];

/** Calculate active synergies for a team */
export function getActiveSynergies(classIds: ClassId[]): SynergyDef[] {
  return SYNERGIES.filter(s =>
    classIds.includes(s.classes[0]) && classIds.includes(s.classes[1])
  );
}

/** Calculate combined multipliers from all active synergies */
export function getSynergyMultipliers(classIds: ClassId[]): { atk: number; defense: number; heal: number } {
  const active = getActiveSynergies(classIds);
  let atk = 1, defense = 1, heal = 1;
  for (const s of active) {
    if (s.bonus.atkMultiplier) atk *= s.bonus.atkMultiplier;
    if (s.bonus.defenseMultiplier) defense *= s.bonus.defenseMultiplier;
    if (s.bonus.healMultiplier) heal *= s.bonus.healMultiplier;
  }
  return { atk, defense, heal };
}
