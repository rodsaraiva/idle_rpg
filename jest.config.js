module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // ensure native environment globals are initialized before preset setup
  setupFiles: ['<rootDir>/jest.native.setup.js'],
  moduleNameMapper: {
    '^react-native/Libraries/BatchedBridge/NativeModules$': '<rootDir>/jest-mocks/BatchedBridgeNativeModules.js',
    '^uuid$': '<rootDir>/jest-mocks/uuid.cjs.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/jest-mocks/async-storage-mock.js',
    '^react-native/Libraries/TurboModule/TurboModuleRegistry$': '<rootDir>/jest-mocks/TurboModuleRegistry.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

