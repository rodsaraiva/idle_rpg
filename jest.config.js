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
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@testing-library/react-native|@lottiefiles/.*|lottie-react-native)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/src/__tests__/context/gameContext.offline.test.tsx'],
};
