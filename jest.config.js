module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Prevent preset from injecting react-native setup that may contain unsupported syntax
  setupFiles: [],
  moduleNameMapper: {
    '^react-native/jest/setup$': '<rootDir>/jest.react-native-setup.stub.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

