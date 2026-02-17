module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/src/__tests__/**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/src/__tests__/context/gameContext.offline.test.tsx'],
  moduleNameMapper: {
    '^uuid$': '<rootDir>/jest-mocks/uuid.cjs.js',
  },
};

