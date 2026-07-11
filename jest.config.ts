import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit', '<rootDir>/packages/sdk'],
  moduleNameMapper: {
    '^@fluxroute/sdk$': '<rootDir>/packages/sdk/src',
    '^@fluxroute/solver$': '<rootDir>/packages/solver/src',
    '^@fluxroute/indexer$': '<rootDir>/packages/indexer/src',
  },
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'packages/sdk/src/utils/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
};

export default config;
