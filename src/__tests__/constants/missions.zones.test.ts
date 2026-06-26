import { MISSIONS } from '../../constants/missions';

test('escada cobre difficulty 6→10', () => {
  const diffs = MISSIONS.map(m => m.difficulty ?? 0);
  for (const d of [6, 7, 8, 9, 10]) expect(diffs).toContain(d);
});

test('zonas novas encadeiam via mission_cleared', () => {
  const z2 = MISSIONS.find(m => m.id === 'z2_costa_1')!;
  expect(z2.requirements?.some(r => r.type === 'mission_cleared')).toBe(true);
});

test('curva de recompensa é monotônica não-decrescente por difficulty', () => {
  // Sort by (difficulty, rewardMax) so that within same difficulty, lower rewards come first
  const byDiff = [...MISSIONS]
    .filter(m => m.difficulty)
    .sort((a, b) => a.difficulty! - b.difficulty! || a.rewardMax - b.rewardMax);
  for (let i = 1; i < byDiff.length; i++) {
    expect(byDiff[i].rewardMax).toBeGreaterThanOrEqual(byDiff[i - 1].rewardMax);
  }
});
