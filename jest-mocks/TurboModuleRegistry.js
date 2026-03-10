const platformConstants = {
  reactNativeVersion: { major: 0, minor: 81, patch: 5 },
  os: 'android',
  forceTouchAvailable: false,
  isTesting: true,
  osVersion: '14.0',
  systemName: 'Android',
  interfaceIdiom: 'phone',
  isDisableAnimations: true,
  getConstants: () => platformConstants,
};

const deviceInfoConstants = {
  Dimensions: {
    window: { width: 375, height: 667, scale: 2, fontScale: 1 },
    screen: { width: 375, height: 667, scale: 2, fontScale: 1 },
  },
};

const uiManagerConstants = {
  customDirectEventTypes: {},
  customBubblingEventTypes: {},
  Constants: {},
};

const modules = {
  PlatformConstants: {
    ...platformConstants,
    getConstants: () => platformConstants,
  },
  ReactNativeFeatureFlags: { commonTestFlags: {} },
  DeviceInfo: { getConstants: () => deviceInfoConstants },
  UIManager: { getConstants: () => uiManagerConstants },
  SourceCode: { getConstants: () => ({ scriptURL: 'http://localhost:8081/index.bundle' }) },
  StatusBarManager: { getConstants: () => ({ HEIGHT: 20 }) },
  NativeAnimatedModule: {},
  Timing: {},
  I18nManager: { getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: false }) },
  KeyboardObserver: {},
};

module.exports = {
  get: (name) => modules[name] ?? null,
  getEnforcing: (name) => modules[name] ?? modules.PlatformConstants, // Using PlatformConstants as a generic fallback mock
};
