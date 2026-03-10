module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  testMatch: ['**/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/dist/', 
    '/src/__tests__/context/gameContext.offline.test.tsx',
    '/src/__tests__/components/',
    '/src/__tests__/hooks/useDragDropGrid.test.tsx',
    '/src/__tests__/hooks/useDragDropGrid.gridmove.test.tsx',
    '/src/__tests__/hooks/useDragDropGrid.measure_fail.test.tsx'
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
