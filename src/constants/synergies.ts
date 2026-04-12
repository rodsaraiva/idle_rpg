import { ClassId } from '../types';
import type { SynergyId } from '../utils/battleEngine';

export interface SynergyDef {
  id: SynergyId;
  classes: [ClassId, ClassId];
  name: string;
  description: string;
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'LINHA_DE_FRENTE', classes: ['WARRIOR', 'HEALER'], name: 'Linha de Frente', description: 'Curar o Guerreiro o enfurece (+30% ATK por 1 turno)' },
  { id: 'MURALHA_E_FLECHA', classes: ['TANK', 'ARCHER'], name: 'Muralha e Flecha', description: 'Tanque atrai inimigos. Arqueiro ganha +1 alcance e +20 crit enquanto Tanque vivo' },
  { id: 'CAOS_ARCANO', classes: ['ROGUE', 'MAGE'], name: 'Caos Arcano', description: 'Mago disjunta defesas: alvos atacados perdem 50% de DEF por 1 turno' },
  { id: 'BASTIAO', classes: ['TANK', 'HEALER'], name: 'Bastião', description: 'Tanque abaixo de 50% HP libera cura em área no próximo cast do Curandeiro' },
  { id: 'EMBOSCADA', classes: ['WARRIOR', 'ROGUE'], name: 'Emboscada', description: 'Guerreiro e Ladino ignoram defesa nos rounds 1 e 2' },
  { id: 'ARTILHARIA', classes: ['ARCHER', 'MAGE'], name: 'Artilharia', description: 'Ataques à distância (≥2 hex) têm 50% de chance de respingar 50% do dano em vizinho' },
];

/** Returns synergy definitions active for a given team. */
export function getActiveSynergies(classIds: ClassId[]): SynergyDef[] {
  return SYNERGIES.filter(s =>
    classIds.includes(s.classes[0]) && classIds.includes(s.classes[1])
  );
}