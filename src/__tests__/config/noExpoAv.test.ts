// src/__tests__/config/noExpoAv.test.ts
import pkg from '../../../package.json';
test('expo-av não está mais nas dependências', () => {
  expect((pkg as any).dependencies['expo-av']).toBeUndefined();
});
