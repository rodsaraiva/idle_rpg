/**
 * pantheonFusion.rng.test.ts
 *
 * Verifica que createFusedHero aceita um rng injetável, tornando o resultado
 * deterministicamente testável. Usa makeRng (mulberry32) para semear o PRNG.
 *
 * ATENÇÃO: NÃO modifica pantheonHandler.test.ts. Este arquivo cobre apenas
 * a testabilidade da assinatura nova (rng opcional com default Math.random).
 */

import { createFusedHero } from '../../context/pantheonHandler';
import { makeRng } from '../../utils/math';
import { Hero, HeroTask } from '../../types';

function makeHero(overrides: Partial<Hero>): Hero {
  return {
    id: 'h1',
    name: 'Test',
    hpMax: 50,
    hpCurrent: 50,
    atk: 10,
    mp: 5,
    defense: 5,
    crit: 10,
    agility: 5,
    currentTask: HeroTask.IDLE,
    classId: 'WARRIOR',
    personality: 'AGGRESSIVE',
    trainingCount: { hp: 0, atk: 0, mp: 0 },
    trainingProgressMs: { hp: 0, atk: 0, mp: 0 },
    equippedItems: [],
    stars: 0,
    ...overrides,
  } as Hero;
}

const SOURCES: [Hero, Hero, Hero] = [
  makeHero({ id: 'a', classId: 'WARRIOR' }),
  makeHero({ id: 'b', classId: 'MAGE' }),
  makeHero({ id: 'c', classId: 'ARCHER' }),
];

describe('createFusedHero — rng injetável', () => {
  test('determinismo: mesmo seed → mesmo classId/personality/name', () => {
    const result1 = createFusedHero(SOURCES, makeRng(42));
    const result2 = createFusedHero(SOURCES, makeRng(42));

    expect(result1.classId).toBe(result2.classId);
    expect(result1.personality).toBe(result2.personality);
    expect(result1.name).toBe(result2.name);
  });

  test('seeds diferentes → resultados podem divergir (pelo menos um campo)', () => {
    const resultA = createFusedHero(SOURCES, makeRng(42));
    const resultB = createFusedHero(SOURCES, makeRng(99999));

    // Ao menos um dos campos deve diferir entre seeds distintos.
    const same =
      resultA.classId === resultB.classId &&
      resultA.personality === resultB.personality &&
      resultA.name === resultB.name;
    // Não garantimos que sempre diferem (colisão possível), mas com seeds tão
    // diferentes é estatisticamente esperado. Se falhar com azar, trocar seeds.
    expect(same).toBe(false);
  });

  test('valores fixos com seed 42 (golden values)', () => {
    const fused = createFusedHero(SOURCES, makeRng(42));

    // Ordem de consumo: classIdx → personality → name-word → suffix
    // Capturado após implementação: makeRng(42) produce MAGE / CAUTIOUS / "Eterno VII"
    expect(fused.classId).toBe('MAGE');
    expect(fused.personality).toBe('CAUTIOUS');
    expect(fused.name).toBe('Eterno VII');

    // id NÃO é seedado (uuidv4), portanto não asserimos.
  });

  test('valores fixos com seed 99999 (golden values)', () => {
    const fused = createFusedHero(SOURCES, makeRng(99999));

    expect(fused.classId).toBe('ARCHER');
    expect(fused.personality).toBe('CAUTIOUS');
    expect(fused.name).toBe('Primordial VII');
  });

  // id (uuidv4) NÃO é assertado — é independente do seed e mockado no ambiente de teste.
});
