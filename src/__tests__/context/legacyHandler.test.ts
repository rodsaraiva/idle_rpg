import { checkLegacySeals } from '../../context/legacyHandler';

const withCleared = (ids: string[]): any => ({ gold: 50, heroes: [], completedMissionIds: ids, legacy: { level: 0, totalExp: 0, sealsEarned: [] } });

test('concede selo de zona uma única vez e nunca mexe em gold', () => {
  const s1 = checkLegacySeals(withCleared(['z2_costa_1']));
  expect(s1.legacy!.sealsEarned).toContain('seal_costa');
  expect(s1.gold).toBe(50); // invariante: sem gold passivo
  const s2 = checkLegacySeals(s1); // idempotente
  expect(s2.legacy!.sealsEarned.filter(x => x === 'seal_costa')).toHaveLength(1);
});

test('acumular exp promove nível', () => {
  // limpar marcos suficientes para cruzar legacyExpThreshold(0)
  const s = checkLegacySeals(withCleared(['z2_costa_1', 'z2_costa_2', 'z3_picos_1']));
  expect(s.legacy!.level).toBeGreaterThanOrEqual(1);
});
