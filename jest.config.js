module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  setupFiles: ['<rootDir>/jest.native.setup.js'],
  moduleNameMapper: {
    '^react-native/Libraries/BatchedBridge/NativeModules$': '<rootDir>/jest-mocks/BatchedBridgeNativeModules.js',
    '^uuid$': '<rootDir>/jest-mocks/uuid.cjs.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/jest-mocks/async-storage-mock.js',
    '^react-native/Libraries/TurboModule/TurboModuleRegistry$': '<rootDir>/jest-mocks/TurboModuleRegistry.js',
    '.+Libraries/TurboModule/TurboModuleRegistry': '<rootDir>/jest-mocks/TurboModuleRegistry.js',
    '^react-native/Libraries/Utilities/NativePlatformConstantsIOS$': '<rootDir>/jest-mocks/NativePlatformConstantsIOS.js',
    '^react-native/src/private/specs_DEPRECATED/modules/NativePlatformConstantsIOS$': '<rootDir>/jest-mocks/NativePlatformConstantsIOS.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo-.*|@testing-library/react-native)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/src/__tests__/context/gameContext.offline.test.tsx'],
};
