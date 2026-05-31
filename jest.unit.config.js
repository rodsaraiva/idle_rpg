module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
      },
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@testing-library/react-native|@lottiefiles/.*|lottie-react-native)',
  ],
  testMatch: ['**/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/context/gameContext.offline.test.tsx',
  ],
  moduleNameMapper: {
    '^uuid$': '<rootDir>/jest-mocks/uuid.cjs.js',
    '^react-native$': '<rootDir>/jest-react-native-mock.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/jest-mocks/async-storage-mock.js',
    '^expo-haptics$': '<rootDir>/jest.react-native-setup.stub.js',
    '^expo-audio$': '<rootDir>/jest.react-native-setup.stub.js',
    '^expo-av$': '<rootDir>/jest.react-native-setup.stub.js',
    '^lottie-react-native$': '<rootDir>/jest.react-native-setup.stub.js',
    '^react-native-reanimated$': '<rootDir>/jest.react-native-setup.stub.js',
    '^react-native-gesture-handler$': '<rootDir>/jest.react-native-setup.stub.js',
  },
};
