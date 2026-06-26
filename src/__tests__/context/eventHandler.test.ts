import { refreshActiveEvent } from '../../context/eventHandler';
import { pickEvent, getEventSeed } from '../../constants/events';

const JAN = new Date(2026, 0, 15).getTime();
const FEB = new Date(2026, 1, 15).getTime();

test('refresh é idempotente dentro da mesma janela', () => {
  const s1 = refreshActiveEvent({ gold: 0, heroes: [] } as any, JAN);
  const s2 = refreshActiveEvent(s1, JAN);
  expect(s2.activeEvent).toBe(s1.activeEvent); // mesma referência: no-op
});

test('troca de janela seleciona evento determinístico do pool', () => {
  const s1 = refreshActiveEvent({ gold: 0, heroes: [] } as any, JAN);
  const s2 = refreshActiveEvent(s1, FEB);
  expect(s2.activeEvent!.id).toBe(pickEvent(getEventSeed(FEB)).id);
});
