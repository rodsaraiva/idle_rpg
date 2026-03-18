import { createHero } from '../../src/utils/heroFactory';
import { Hero, ClassId } from '../../src/types';
import { CLASS_DEFS } from '../../src/constants/classes';
import { BASE_TRAIN_TIME_MS, TRAIN_INFLATION_FACTOR } from '../../src/constants/game';
import { computePointsFromMs } from '../../src/utils/trainingMath';

export interface TrainingFocus {
  days: number;
  focus: 'ATK' | 'HP' | 'MP' | 'BALANCED'; // BALANCED divide o tempo igualmente entre os 3
}

/**
 * Gera um herói que passou N dias treinando.
 * Simula o progresso considerando a velocidade de treino específica da classe e a inflação de tempo (Progressão Geométrica).
 */
export function generateTrainedHero(classId: ClassId, training: TrainingFocus): Hero {
  // 1. Gera o herói base com variância e atributos da classe
  const hero = createHero(classId);
  const classDef = CLASS_DEFS[classId];

  if (training.days <= 0) return hero;

  // 2. Converte dias para milissegundos
  const totalMs = training.days * 24 * 60 * 60 * 1000;

  // 3. Helper para calcular pontos ganhos para um atributo específico
  const calcPoints = (ms: number, type: 'hp' | 'atk' | 'mp') => {
    // Aplica o multiplicador de velocidade de treino da classe (menor = mais rápido)
    const speedMultiplier = classDef.trainSpeed?.[type] ?? 1;
    const effectiveBaseMs = BASE_TRAIN_TIME_MS * speedMultiplier;
    
    // Calcula quantos pontos conseguiu gerar nesse tempo usando a fórmula de PA do jogo
    const { points } = computePointsFromMs(effectiveBaseMs, TRAIN_INFLATION_FACTOR, ms);
    return points;
  };

  // 4. Distribui o tempo de treino
  let msHp = 0, msAtk = 0, msMp = 0;

  switch (training.focus) {
    case 'ATK':
      msAtk = totalMs;
      break;
    case 'HP':
      msHp = totalMs;
      break;
    case 'MP':
      msMp = totalMs;
      break;
    case 'BALANCED':
      const splitMs = totalMs / 3;
      msHp = splitMs;
      msAtk = splitMs;
      msMp = splitMs;
      break;
  }

  // 5. Aplica os pontos ganhos
  if (msHp > 0) hero.hpMax += calcPoints(msHp, 'hp');
  if (msAtk > 0) hero.atk += calcPoints(msAtk, 'atk');
  if (msMp > 0) hero.mp += calcPoints(msMp, 'mp');

  // Herói treinado começa com HP cheio
  hero.hpCurrent = hero.hpMax;

  return hero;
}
