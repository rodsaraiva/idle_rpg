import { buyLegacyUpgrade } from '../../context/legacyHandler';
import { legacyRewardMultiplier } from '../../constants/legacyUpgrades';

const lvl = (level: number): any => ({ gold: 0, heroes: [], legacy: { level, totalExp: 0, sealsEarned: [] }, legacyUpgrades: {} });

test('comprar upgrade gasta ponto e aplica multiplicador de recompensa', () => {
  const s = buyLegacyUpgrade(lvl(1), 'reward_1');
  expect(s.legacyUpgrades!['reward_1']).toBe(1);
  expect(legacyRewardMultiplier(s)).toBeGreaterThan(1);
});

test('não compra sem pontos disponíveis', () => {
  const s = buyLegacyUpgrade(lvl(0), 'reward_1');
  expect(s.legacyUpgrades!['reward_1'] ?? 0).toBe(0); // sem mudança
});

test('upgrade nunca credita gold direto', () => {
  const s = buyLegacyUpgrade(lvl(3), 'reward_1');
  expect(s.gold).toBe(0);
});
