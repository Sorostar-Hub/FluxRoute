import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/frontend', '<rootDir>/tests'],
  moduleNameMapper: {
    '^@fluxroute/sdk$': '<rootDir>/packages/sdk/src',
    '^@fluxroute/solver$': '<rootDir>/packages/solver/src',
    '^@fluxroute/indexer$': '<rootDir>/packages/indexer/src',
  },
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'packages/**/src/**/*.{ts,tsx}',
    'frontend/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
};

export default config;
