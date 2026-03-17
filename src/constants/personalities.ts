import { PersonalityId } from '../types';

export interface PersonalityDef {
  id: PersonalityId;
  displayName: string;
  description: string;
  emoji: string;
}

export const PERSONALITIES: Record<PersonalityId, PersonalityDef> = {
  AGGRESSIVE: {
    id: 'AGGRESSIVE',
    displayName: 'Sanguinário',
    description: 'Aumenta o peso para alvos com HP baixo e ignora a distância se puder matar neste turno.',
    emoji: '🩸',
  },
  PROTECTOR: {
    id: 'PROTECTOR',
    displayName: 'Guardião',
    description: 'Prioridade máxima a inimigos que atacaram aliados com pouco HP no último round.',
    emoji: '🛡️',
  },
  CAUTIOUS: {
    id: 'CAUTIOUS',
    displayName: 'Prudente',
    description: 'Prefere alvos que consiga atingir sem se mover ou que estejam isolados.',
    emoji: '🔍',
  },
  VENGEFUL: {
    id: 'VENGEFUL',
    displayName: 'Vingativo',
    description: 'Inimigo que causou dano a este herói no último turno recebe bônus imenso de prioridade.',
    emoji: '👁️',
  },
  OPPORTUNIST: {
    id: 'OPPORTUNIST',
    displayName: 'Oportunista',
    description: 'Prioriza alvos com HP baixo ou que não sejam da classe Tanque.',
    emoji: '🦊',
  },
};

export const PERSONALITY_LIST = Object.values(PERSONALITIES);
