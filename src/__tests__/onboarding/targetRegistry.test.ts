import { registerTarget, measureTarget } from '../../onboarding/targetRegistry';

describe('targetRegistry', () => {
  test('measureTarget retorna null para id não registrado', async () => {
    expect(await measureTarget('train-atk')).toBeNull();
  });

  test('registerTarget permite medir; unregister remove', async () => {
    const layout = { x: 10, y: 20, width: 100, height: 40 };
    const unregister = registerTarget('recruit-button', async () => layout);
    expect(await measureTarget('recruit-button')).toEqual(layout);
    unregister();
    expect(await measureTarget('recruit-button')).toBeNull();
  });

  test('último registro do mesmo id vence (tela remontada)', async () => {
    registerTarget('mission-1', async () => ({ x: 1, y: 1, width: 1, height: 1 }));
    registerTarget('mission-1', async () => ({ x: 2, y: 2, width: 2, height: 2 }));
    expect(await measureTarget('mission-1')).toEqual({ x: 2, y: 2, width: 2, height: 2 });
  });
});
