import { CLASS_DEFS } from '../../constants/classes';

// Nota: o plano referencia `CLASSES` mas o export real é `CLASS_DEFS`.
// Adaptado para o contrato real do arquivo.

test('Comandante existe com ability COMMANDER_RALLY', () => {
  const c = CLASS_DEFS.COMMANDER;
  expect(c).toBeDefined();
  expect(c.ability).toBe('COMMANDER_RALLY');
});

test('Comandante não treina DEF/CRIT/AGI', () => {
  const ts: any = CLASS_DEFS.COMMANDER.trainSpeed ?? {};
  expect(ts.defense).toBeUndefined();
  expect(ts.crit).toBeUndefined();
  expect(ts.agility).toBeUndefined();
});
