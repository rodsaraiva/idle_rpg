// src/__tests__/config/storeConfig.test.ts
import app from '../../../app.json';
import eas from '../../../eas.json';

test('app.json tem identidade de pacote iOS/Android', () => {
  expect((app as any).expo.ios.bundleIdentifier).toBe('com.v4smc.idlerpg');
  expect((app as any).expo.android.package).toBe('com.v4smc.idlerpg');
  expect((app as any).expo.userInterfaceStyle).toBe('dark');
});

test('eas.json tem os 3 perfis de build', () => {
  for (const p of ['development', 'preview', 'production']) {
    expect((eas as any).build[p]).toBeDefined();
  }
});
