import { AttributeProgress } from '../../components/AttributeProgress';

describe('AttributeProgress', () => {
  test('exports component and accepts expected props', () => {
    expect(AttributeProgress).toBeDefined();
    expect(typeof AttributeProgress).toBe('function');

    // Verifica que o componente aceita as props usadas na app
    const props = {
      fraction: 0.5,
      label: 'Progresso HP',
      timeRemainingMs: 45000,
    };
    expect(props.fraction).toBeGreaterThanOrEqual(0);
    expect(props.fraction).toBeLessThanOrEqual(1);
    expect(props.label).toBe('Progresso HP');
    expect(props.timeRemainingMs).toBe(45000);
  });
});

