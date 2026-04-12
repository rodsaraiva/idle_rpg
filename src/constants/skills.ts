import { ClassId, Hero } from '../types';

export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  description: string;
  icon: string;
  cooldownRounds: number;    // 0 = sem cooldown fixo (trigger condicional), -1 = uma vez por batalha
  unlockThreshold: { stat: 'hp' | 'atk' | 'mp'; value: number };
}

export const SKILL_DEFS: SkillDef[] = [
  // === WARRIOR (stat-chave: atk) ===
  {
    id: 'WARRIOR_GOLPE_PESADO',
    classId: 'WARRIOR',
    name: 'Golpe Pesado',
    description: 'A cada 3 rounds, desfere um golpe com 150% de ATK que ignora 30% da defesa.',
    icon: '⚔️',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'WARRIOR_GRITO_DE_GUERRA',
    classId: 'WARRIOR',
    name: 'Grito de Guerra',
    description: 'Quando aliado cai abaixo de 40% HP, aliados em 2 hex ganham +20% ATK por 2 rounds.',
    icon: '📯',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'WARRIOR_FURIA',
    classId: 'WARRIOR',
    name: 'Fúria',
    description: 'Abaixo de 30% HP, ganha +50% ATK permanente mas perde 20% DEF.',
    icon: '🔥',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === TANK (stat-chave: hp) ===
  {
    id: 'TANK_PROVOCAR',
    classId: 'TANK',
    name: 'Provocar',
    description: 'No início do combate, atrai inimigos com taunt +80 por 3 rounds.',
    icon: '🛡️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'hp', value: 20 },
  },
  {
    id: 'TANK_MURALHA',
    classId: 'TANK',
    name: 'Muralha',
    description: 'Adjacente a 2+ aliados, reduz dano recebido em 25% por 2 rounds.',
    icon: '🧱',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'hp', value: 50 },
  },
  {
    id: 'TANK_ULTIMO_SUSPIRO',
    classId: 'TANK',
    name: 'Último Suspiro',
    description: 'Ao morrer, aliados ganham +30% DEF por 2 rounds.',
    icon: '💀',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'hp', value: 100 },
  },

  // === ROGUE (stat-chave: atk) ===
  {
    id: 'ROGUE_GOLPE_FURTIVO',
    classId: 'ROGUE',
    name: 'Golpe Furtivo',
    description: 'Primeiro ataque do combate causa dano dobrado com crítico garantido.',
    icon: '🗡️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'ROGUE_VENENO',
    classId: 'ROGUE',
    name: 'Veneno',
    description: '30% de chance de aplicar veneno (DoT) no alvo por 2 rounds.',
    icon: '🧪',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'ROGUE_EXECUCAO',
    classId: 'ROGUE',
    name: 'Execução',
    description: 'Contra alvo com <20% HP, dano x2.5 ignorando defesa.',
    icon: '💀',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === ARCHER (stat-chave: atk) ===
  {
    id: 'ARCHER_TIRO_CERTEIRO',
    classId: 'ARCHER',
    name: 'Tiro Certeiro',
    description: 'A cada 3 rounds, ignora evasão e ganha +30% chance de crítico.',
    icon: '🎯',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'atk', value: 20 },
  },
  {
    id: 'ARCHER_CHUVA_DE_FLECHAS',
    classId: 'ARCHER',
    name: 'Chuva de Flechas',
    description: 'A cada 5 rounds, 50% do ATK em todos os inimigos em área de 2 hex.',
    icon: '🌧️',
    cooldownRounds: 5,
    unlockThreshold: { stat: 'atk', value: 50 },
  },
  {
    id: 'ARCHER_TIRO_PERFURANTE',
    classId: 'ARCHER',
    name: 'Tiro Perfurante',
    description: 'Contra alvo com DEF > 20, ignora 60% da defesa.',
    icon: '🏹',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'atk', value: 100 },
  },

  // === MAGE (stat-chave: mp) ===
  {
    id: 'MAGE_BOLA_DE_FOGO',
    classId: 'MAGE',
    name: 'Bola de Fogo',
    description: 'A cada 3 rounds, 80% do ATK no alvo + 40% em adjacentes.',
    icon: '🔥',
    cooldownRounds: 3,
    unlockThreshold: { stat: 'mp', value: 20 },
  },
  {
    id: 'MAGE_ESCUDO_ARCANO',
    classId: 'MAGE',
    name: 'Escudo Arcano',
    description: 'Ao receber dano, reduz 50% do próximo dano. Cooldown de 4 rounds.',
    icon: '🔮',
    cooldownRounds: 4,
    unlockThreshold: { stat: 'mp', value: 50 },
  },
  {
    id: 'MAGE_METEORO',
    classId: 'MAGE',
    name: 'Meteoro',
    description: 'Uma vez por batalha com 3+ inimigos vivos, 100% ATK em área de 3 hex.',
    icon: '☄️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'mp', value: 100 },
  },

  // === HEALER (stat-chave: mp) ===
  {
    id: 'HEALER_CURA_MAIOR',
    classId: 'HEALER',
    name: 'Cura Maior',
    description: 'Aliado abaixo de 40% HP recebe cura de 50% do HP máximo.',
    icon: '💚',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'mp', value: 20 },
  },
  {
    id: 'HEALER_PURIFICACAO',
    classId: 'HEALER',
    name: 'Purificação',
    description: 'Remove debuffs de aliado e cura 20% HP.',
    icon: '✨',
    cooldownRounds: 0,
    unlockThreshold: { stat: 'mp', value: 50 },
  },
  {
    id: 'HEALER_RESSURREICAO',
    classId: 'HEALER',
    name: 'Ressurreição',
    description: 'Uma vez por batalha, revive aliado caído com 30% HP.',
    icon: '🕊️',
    cooldownRounds: -1,
    unlockThreshold: { stat: 'mp', value: 100 },
  },
];

/** Returns skills for a given class */
export function getClassSkills(classId: ClassId): SkillDef[] {
  return SKILL_DEFS.filter(s => s.classId === classId);
}

/** Returns unlocked skills for a hero based on trainingCount */
export function getUnlockedSkills(hero: Hero): SkillDef[] {
  if (!hero.classId || !hero.trainingCount) return [];
  const classSkills = getClassSkills(hero.classId);

  return classSkills.filter(skill => {
    const statKey = skill.unlockThreshold.stat;
    const trained = hero.trainingCount?.[statKey] ?? 0;
    return trained >= skill.unlockThreshold.value;
  });
}

/** Returns all skills for a hero with unlock status */
export function getSkillsWithStatus(hero: Hero): { skill: SkillDef; unlocked: boolean; progress: number }[] {
  if (!hero.classId) return [];
  const classSkills = getClassSkills(hero.classId);

  return classSkills.map(skill => {
    const statKey = skill.unlockThreshold.stat;
    const trained = hero.trainingCount?.[statKey] ?? 0;
    const threshold = skill.unlockThreshold.value;
    return {
      skill,
      unlocked: trained >= threshold,
      progress: Math.min(1, trained / threshold),
    };
  });
}
